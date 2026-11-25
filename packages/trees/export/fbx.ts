// A binary FBX 7.4 writer for generated trees, with no Blender: runs in a browser or a web worker as it does in Bun.
// It writes what blender/tools/tree_fbx.py writes (the reference): one mesh per LOD named <id>_LOD<k> with two
// materials in the order bark, leaves, three uv sets, one colour set, the generator's own normals, and the stem
// samples as empty nodes (GolfMapStem_<i> / GolfMapFork_<i>) for the trunk colliders. Axes as Blender's export with
// the space transform baked: generator (x, y, z) with z up -> FBX (x, z, -y), Y up, metres (UnitScaleFactor 100).
// Arrays are written unpacked; the .unitypackage around the file is gzipped as a whole.
import type { TreeBuild, TreeMesh, V3 } from '../generator';

type Prop =
    | { t: 'C'; v: boolean } | { t: 'I'; v: number } | { t: 'L'; v: bigint } | { t: 'D'; v: number }
    | { t: 'S'; v: string } | { t: 'R'; v: Uint8Array } | { t: 'i'; v: Int32Array } | { t: 'd'; v: Float64Array };

export interface FbxNode { name: string; props: Prop[]; children: FbxNode[] }

const node = (name: string, props: Prop[] = [], children: FbxNode[] = []): FbxNode => ({ name, props, children });
const I = (v: number): Prop => ({ t: 'I', v });
const L = (v: number): Prop => ({ t: 'L', v: BigInt(v) });
const D = (v: number): Prop => ({ t: 'D', v });
const S = (v: string): Prop => ({ t: 'S', v });
const C = (v: boolean): Prop => ({ t: 'C', v });

/** A `P` line of a Properties70 block. */
function p(name: string, type: string, label: string, flags: string, ...values: (number | string | bigint)[]): FbxNode {
    const rest = values.map((x): Prop => typeof x === 'string' ? S(x) : typeof x === 'bigint' ? { t: 'L', v: x }
        : type === 'int' || type === 'enum' || type === 'bool' ? I(x) : D(x));
    return node('P', [S(name), S(type), S(label), S(flags), ...rest]);
}
const props70 = (...ps: FbxNode[]) => node('Properties70', [], ps);

// ---- encoding ----------------------------------------------------------------------------------

const HEAD = new TextEncoder().encode('Kaydara FBX Binary  \0\x1a\0');
const FILE_ID = new Uint8Array([0x28, 0xb3, 0x2a, 0xeb, 0xb6, 0x24, 0xcc, 0xc2, 0xbf, 0xc8, 0xb0, 0x2a, 0xa9, 0x2b, 0xfc, 0xf1]);
const FOOT_ID = new Uint8Array([0xfa, 0xbc, 0xab, 0x09, 0xd0, 0xc8, 0xd4, 0x66, 0xb1, 0x76, 0xfb, 0x83, 0x1c, 0xf7, 0x26, 0x7e]);
const FOOT_MAGIC = new Uint8Array([0xf8, 0x5a, 0x8c, 0x6a, 0xde, 0xf5, 0xd9, 0x7e, 0xec, 0xe9, 0x0c, 0xe3, 0x75, 0x8f, 0x29, 0x0b]);
const VERSION = 7400;
const SENTINEL = 13;
const utf8 = new TextEncoder();

function propSize(p: Prop): number {
    switch (p.t) {
        case 'C': return 2;
        case 'I': return 5;
        case 'L': case 'D': return 9;
        case 'S': return 5 + utf8.encode(p.v).length;
        case 'R': return 5 + p.v.length;
        case 'i': return 13 + p.v.length * 4;
        case 'd': return 13 + p.v.length * 8;
    }
}

/** Bytes of a node with its children; `last` = the last child of its parent (no sentinel when childless and bare). */
function nodeSize(n: FbxNode, last: boolean): number {
    let size = 13 + utf8.encode(n.name).length + n.props.reduce((s, p) => s + propSize(p), 0);
    if (n.children.length) size += n.children.reduce((s, c, i) => s + nodeSize(c, i === n.children.length - 1), 0) + SENTINEL;
    else if (!n.props.length && !last) size += SENTINEL;
    return size;
}

class Out {
    bytes: Uint8Array;
    view: DataView;
    at = 0;
    constructor(size: number) { this.bytes = new Uint8Array(size); this.view = new DataView(this.bytes.buffer); }
    u8(v: number) { this.view.setUint8(this.at, v); this.at += 1; }
    u32(v: number) { this.view.setUint32(this.at, v, true); this.at += 4; }
    raw(b: Uint8Array) { this.bytes.set(b, this.at); this.at += b.length; }
    zeros(n: number) { this.at += n; }
}

function writeProp(o: Out, p: Prop) {
    o.u8(p.t.charCodeAt(0));
    switch (p.t) {
        case 'C': o.u8(p.v ? 1 : 0); break;
        case 'I': o.view.setInt32(o.at, p.v, true); o.at += 4; break;
        case 'L': o.view.setBigInt64(o.at, p.v, true); o.at += 8; break;
        case 'D': o.view.setFloat64(o.at, p.v, true); o.at += 8; break;
        case 'S': case 'R': { const b = p.t === 'S' ? utf8.encode(p.v) : p.v; o.u32(b.length); o.raw(b); break; }
        case 'i': case 'd': {
            const width = p.t === 'i' ? 4 : 8;
            o.u32(p.v.length); o.u32(0); o.u32(p.v.length * width);
            for (const x of p.v) {
                if (p.t === 'i') o.view.setInt32(o.at, x, true); else o.view.setFloat64(o.at, x, true);
                o.at += width;
            }
            break;
        }
    }
}

function writeNode(o: Out, n: FbxNode, last: boolean) {
    const end = o.at + nodeSize(n, last);
    o.u32(end);
    o.u32(n.props.length);
    o.u32(n.props.reduce((s, p) => s + propSize(p), 0));
    const name = utf8.encode(n.name);
    o.u8(name.length);
    o.raw(name);
    for (const p of n.props) writeProp(o, p);
    if (n.children.length) {
        n.children.forEach((c, i) => writeNode(o, c, i === n.children.length - 1));
        o.zeros(SENTINEL);
    } else if (!n.props.length && !last) o.zeros(SENTINEL);
    if (o.at !== end) throw Error(`FBX node ${n.name}: wrote ${o.at - end + nodeSize(n, last)} of ${nodeSize(n, last)} bytes`);
}

/** The file for top-level nodes, with the header and the footer Autodesk's reader expects. */
export function encodeFbx(top: FbxNode[]): Uint8Array {
    let body = HEAD.length + 4 + top.reduce((s, n, i) => s + nodeSize(n, i === top.length - 1), 0) + SENTINEL;
    const beforePad = body + FOOT_ID.length + 4;
    const pad = ((beforePad + 15) & ~15) - beforePad || 16;
    const o = new Out(beforePad + pad + 4 + 120 + FOOT_MAGIC.length);
    o.raw(HEAD);
    o.u32(VERSION);
    top.forEach((n, i) => writeNode(o, n, i === top.length - 1));
    o.zeros(SENTINEL);
    o.raw(FOOT_ID);
    o.zeros(4 + pad);
    o.u32(VERSION);
    o.zeros(120);
    o.raw(FOOT_MAGIC);
    if (o.at !== o.bytes.length) throw Error('FBX size mismatch');
    return o.bytes;
}

// ---- the tree scene ------------------------------------------------------------------------------

/** Per-vertex data a shader profile adds to the generator's mesh (see profiles.ts). */
export interface ShaderChannels {
    /** uv sets 2 and 3 (per vertex, 2 floats each); null = zeros. */
    uv2: Float32Array | null;
    uv3: Float32Array | null;
    /** RGBA per vertex, 0..1. */
    rgba: Float32Array;
}

export interface TreeFbxInput {
    id: string;
    build: TreeBuild;
    materials: { bark: string; leaves: string };
    channels: (lod: TreeMesh, k: number) => ShaderChannels;
}

/** Generator space (z up) -> FBX Y up, as Blender's export with the space transform baked. */
function toYUp(xyz: ArrayLike<number>): Float64Array {
    const out = new Float64Array(xyz.length);
    for (let i = 0; i < xyz.length; i += 3) {
        out[i] = xyz[i]!;
        out[i + 1] = xyz[i + 2]!;
        out[i + 2] = -xyz[i + 1]!;
    }
    return out;
}

function geometry(uid: number, name: string, lod: TreeMesh, ch: ShaderChannels): FbxNode {
    const tris = lod.bark.length + lod.leaves.length;
    const pvi = new Int32Array(tris);
    const index = new Int32Array(tris);
    let w = 0;
    for (const list of [lod.bark, lod.leaves]) for (let i = 0; i < list.length; i++, w++) {
        index[w] = list[i]!;
        pvi[w] = i % 3 === 2 ? ~list[i]! : list[i]!;
    }
    const mats = new Int32Array(tris / 3);
    mats.fill(1, lod.bark.length / 3);
    const n = lod.positions.length / 3;
    const uvSet = (k: number, label: string, data: ArrayLike<number> | null) => node('LayerElementUV', [I(k)], [
        node('Version', [I(101)]), node('Name', [S(label)]),
        node('MappingInformationType', [S('ByPolygonVertex')]), node('ReferenceInformationType', [S('IndexToDirect')]),
        node('UV', [{ t: 'd', v: data ? Float64Array.from(data) : new Float64Array(n * 2) }]), node('UVIndex', [{ t: 'i', v: index }]),
    ]);
    const element = (type: string, k: number) => node('LayerElement', [], [node('Type', [S(type)]), node('TypedIndex', [I(k)])]);
    return node('Geometry', [L(uid), S(`${name}\0\x01Geometry`), S('Mesh')], [
        props70(),
        node('GeometryVersion', [I(124)]),
        node('Vertices', [{ t: 'd', v: toYUp(lod.positions) }]),
        node('PolygonVertexIndex', [{ t: 'i', v: pvi }]),
        node('LayerElementNormal', [I(0)], [
            node('Version', [I(101)]), node('Name', [S('')]),
            node('MappingInformationType', [S('ByPolygonVertex')]), node('ReferenceInformationType', [S('IndexToDirect')]),
            node('Normals', [{ t: 'd', v: toYUp(lod.normals) }]), node('NormalsIndex', [{ t: 'i', v: index }]),
        ]),
        node('LayerElementColor', [I(0)], [
            node('Version', [I(101)]), node('Name', [S('Col')]),
            node('MappingInformationType', [S('ByPolygonVertex')]), node('ReferenceInformationType', [S('IndexToDirect')]),
            node('Colors', [{ t: 'd', v: Float64Array.from(ch.rgba) }]), node('ColorIndex', [{ t: 'i', v: index }]),
        ]),
        uvSet(0, 'UVMap', lod.uv), uvSet(1, 'UV2', ch.uv2), uvSet(2, 'UV3', ch.uv3),
        node('LayerElementMaterial', [I(0)], [
            node('Version', [I(101)]), node('Name', [S('')]),
            node('MappingInformationType', [S('ByPolygon')]), node('ReferenceInformationType', [S('IndexToDirect')]),
            node('Materials', [{ t: 'i', v: mats }]),
        ]),
        node('Layer', [I(0)], [node('Version', [I(100)]), element('LayerElementNormal', 0), element('LayerElementColor', 0),
            element('LayerElementUV', 0), element('LayerElementMaterial', 0)]),
        node('Layer', [I(1)], [node('Version', [I(100)]), element('LayerElementUV', 1)]),
        node('Layer', [I(2)], [node('Version', [I(100)]), element('LayerElementUV', 2)]),
    ]);
}

function model(uid: number, name: string, kind: 'Mesh' | 'Null', at?: V3): FbxNode {
    const ps = [p('DefaultAttributeIndex', 'int', 'Integer', '', 0), p('InheritType', 'enum', '', '', 1)];
    if (at) ps.unshift(p('Lcl Translation', 'Lcl Translation', '', 'A', at[0], at[2], -at[1]));
    return node('Model', [L(uid), S(`${name}\0\x01Model`), S(kind)], [
        node('Version', [I(232)]), props70(...ps), node('MultiLayer', [I(0)]), node('MultiTake', [I(0)]),
        node('Shading', [C(true)]), node('Culling', [S('CullingOff')]),
    ]);
}

function material(uid: number, name: string): FbxNode {
    return node('Material', [L(uid), S(`${name}\0\x01Material`), S('')], [
        node('Version', [I(102)]), node('ShadingModel', [S('Phong')]), node('MultiLayer', [I(0)]),
        props70(p('DiffuseColor', 'Color', '', 'A', 0.8, 0.8, 0.8)),
    ]);
}

/** The tree as an FBX file: what Unity imports as a model with one LODGroup child per <id>_LOD<k>. */
export function treeFbx(input: TreeFbxInput): Uint8Array {
    const { id, build } = input;
    let next = 1000;
    const uid = () => next++;
    const objects: FbxNode[] = [];
    const links: [number, number][] = [];
    const bark = uid(), leaves = uid();
    objects.push(material(bark, input.materials.bark), material(leaves, input.materials.leaves));
    let nulls = 0;
    build.stem.forEach((s, i) => {
        const name = `${s.startsFork ? 'GolfMapFork' : 'GolfMapStem'}_${i}`;
        const attr = uid(), m = uid();
        nulls++;
        objects.push(node('NodeAttribute', [L(attr), S(`${name}\0\x01NodeAttribute`), S('Null')], [node('TypeFlags', [S('Null')]), props70()]));
        objects.push(model(m, name, 'Null', s.point));
        links.push([m, 0], [attr, m]);
    });
    build.lods.forEach((lod, k) => {
        const name = `${id}_LOD${k}`;
        const g = uid(), m = uid();
        objects.push(geometry(g, name, lod, input.channels(lod, k)), model(m, name, 'Mesh'));
        links.push([m, 0], [g, m], [bark, m], [leaves, m]);
    });
    const meshes = build.lods.length;
    const counted = (type: string, count: number) => node('ObjectType', [S(type)], [node('Count', [I(count)])]);
    return encodeFbx([
        node('FBXHeaderExtension', [], [
            node('FBXHeaderVersion', [I(1003)]), node('FBXVersion', [I(VERSION)]), node('EncryptionType', [I(0)]),
            node('Creator', [S('tree-tool')]),
        ]),
        node('FileId', [{ t: 'R', v: FILE_ID }]),
        node('CreationTime', [S('1970-01-01 10:00:00:000')]),
        node('Creator', [S('tree-tool')]),
        node('GlobalSettings', [], [node('Version', [I(1000)]), props70(
            p('UpAxis', 'int', 'Integer', '', 1), p('UpAxisSign', 'int', 'Integer', '', 1),
            p('FrontAxis', 'int', 'Integer', '', 2), p('FrontAxisSign', 'int', 'Integer', '', 1),
            p('CoordAxis', 'int', 'Integer', '', 0), p('CoordAxisSign', 'int', 'Integer', '', 1),
            p('OriginalUpAxis', 'int', 'Integer', '', -1), p('OriginalUpAxisSign', 'int', 'Integer', '', 1),
            p('UnitScaleFactor', 'double', 'Number', '', 100), p('OriginalUnitScaleFactor', 'double', 'Number', '', 100),
        )]),
        node('Documents', [], [node('Count', [I(1)]), node('Document', [L(1), S('Scene'), S('Scene')], [
            props70(), node('RootNode', [L(0)]),
        ])]),
        node('References'),
        node('Definitions', [], [
            node('Version', [I(100)]), node('Count', [I(1 + nulls + meshes * 2 + nulls + 2)]),
            counted('GlobalSettings', 1), counted('NodeAttribute', nulls), counted('Geometry', meshes),
            counted('Model', nulls + meshes), counted('Material', 2),
        ]),
        node('Objects', [], objects),
        node('Connections', [], links.map(([a, b]) => node('C', [S('OO'), L(a), L(b)]))),
        node('Takes', [], [node('Current', [S('')])]),
    ]);
}
