// The tree's prefab in Unity 2018.2's text form, written without Unity: a LODGroup with one renderer per LOD (the FBX's
// meshes by file id, our materials) and GSPro's colliders on a child 'GolfMap Colliders', the same ones
// GolfMapTreeModels.AddPhysics makes: a capsule per stem segment on GSPwood, one crown capsule on GSPleaves. The two
// physic materials are referenced by GUID: they ship in GSPro's base project, the same GUID in every course project.
import type { TreeBuild, TreeMesh, V3 } from '../generator';
import type { AssetRef } from './profiles';

export const GSPRO_PHYSICS = {
    wood: { fileID: 13400000, guid: '4bb4ffe7a76f7ae43934da251cd69068', type: 2 },
    leaves: { fileID: 13400000, guid: '9b2414cf10ffefa4ea827aac234d1438', type: 2 },
} satisfies Record<string, AssetRef>;

/** Generator space (z up, right-handed) to Unity's (y up, left-handed), as Unity imports the FBX. */
export const toUnity = (p: V3): V3 => [-p[0], p[2], -p[1]];

type Q = [number, number, number, number];

/** Unity's Quaternion.FromToRotation(Vector3.up, d). */
function fromUp(d: V3): Q {
    const n = Math.hypot(d[0], d[1], d[2]) || 1;
    const x = d[2] / n, z = -d[0] / n, w = 1 + d[1] / n;
    const m = Math.hypot(x, z, w) || 1;
    return [x / m, 0, z / m, w / m];
}

export interface Capsule {
    /** A child of the collider holder ('Stem <i>'), or null for a capsule on the holder itself (the crown). */
    name: string | null;
    position: V3; rotation: Q;
    radius: number; height: number; direction: number; center: V3;
    material: 'wood' | 'leaves';
}

/** The colliders AddPhysics builds, from the generator's stem samples and LOD0's leaves. */
export function treeColliders(build: TreeBuild): Capsule[] {
    const out: Capsule[] = [];
    const stem = build.stem;
    if (stem.length > 0) {
        let previous = toUnity(stem[0]!.point);
        for (let i = 1; i < stem.length; i++) {
            const s = stem[i]!;
            if (s.startsFork) { previous = toUnity(s.point); continue; }
            const a = previous, b = toUnity(s.point);
            previous = b;
            const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const radius = (stem[i - 1]!.radiusM + s.radiusM) * 0.5;
            out.push({
                name: `Stem ${i}`, position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rotation: fromUp(d),
                radius, height: Math.hypot(d[0], d[1], d[2]) + 2 * radius, direction: 1, center: [0, 0, 0], material: 'wood',
            });
        }
    }
    // Needles alone, so a shot under a high crown can pass on either side of the stem.
    const crown = bounds(build.lods[0]!, build.lods[0]!.leaves);
    if (crown) {
        const { center, size } = crown;
        const axis = size[1] >= size[0] && size[1] >= size[2] ? 1 : size[0] >= size[2] ? 0 : 2;
        out.push({
            name: null, position: [0, 0, 0], rotation: [0, 0, 0, 1], direction: axis, center, material: 'leaves',
            radius: 0.43 * Math.min(size[(axis + 1) % 3]!, size[(axis + 2) % 3]!), height: 0.9 * size[axis]!,
        });
    }
    return out;
}

/** Unity-space bounds of the vertices the indices use (all of them with no indices). */
function bounds(mesh: TreeMesh, indices?: number[]): { center: V3; size: V3 } | null {
    const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
    const take = (v: number) => {
        const p = toUnity([mesh.positions[v * 3]!, mesh.positions[v * 3 + 1]!, mesh.positions[v * 3 + 2]!]);
        for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k]!, p[k]!); hi[k] = Math.max(hi[k]!, p[k]!); }
    };
    if (indices) { if (indices.length === 0) return null; for (const v of indices) take(v); }
    else for (let v = 0; v < mesh.positions.length / 3; v++) take(v);
    return { center: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] };
}

// ---- YAML -----------------------------------------------------------------------------------------

const f = (x: number) => String(Math.fround(x) === 0 ? 0 : Math.fround(x));
const v3 = (p: readonly number[]) => `{x: ${f(p[0]!)}, y: ${f(p[1]!)}, z: ${f(p[2]!)}}`;
const q4 = (q: Q) => `{x: ${f(q[0])}, y: ${f(q[1])}, z: ${f(q[2])}, w: ${f(q[3])}}`;
const ref = (r: AssetRef) => `{fileID: ${r.fileID}, guid: ${r.guid}, type: ${r.type}}`;
const local = (id: string) => `{fileID: ${id}}`;

export interface PrefabInput {
    id: string;
    build: TreeBuild;
    /** The FBX's GUID; its meshes are 4300000 + 2k (fbxMeshFileIds). */
    fbxGuid: string;
    /** Material GUIDs, bark then leaves. */
    materials: [string, string];
    lodHeights: number[];
    colliders?: boolean;
}

/** The file ids the FBX's meta pins for <id>_LOD<k>'s mesh, so a prefab can refer to them before Unity imports it. */
export const fbxMeshFileId = (k: number) => 4300000 + 2 * k;

export function prefabYaml(input: PrefabInput): string {
    const { id, build } = input;
    let n = 0;
    const fid = (classId: number) => `${classId}${String(++n).padStart(12, '0')}`;
    const docs: string[] = [];
    const head = (classId: number, fileId: string, type: string, hide = 1) =>
        `--- !u!${classId} &${fileId}\n${type}:\n  m_ObjectHideFlags: ${hide}\n  m_CorrespondingSourceObject: {fileID: 0}\n  m_PrefabInternal: {fileID: 100100000}\n`;
    const gameObject = (go: string, name: string, components: string[], hide = 1) => docs.push(head(1, go, 'GameObject', hide) +
        `  serializedVersion: 6\n  m_Component:\n${components.map(c => `  - component: ${local(c)}\n`).join('')}` +
        `  m_Layer: 0\n  m_Name: ${name}\n  m_TagString: Untagged\n  m_Icon: {fileID: 0}\n  m_NavMeshLayer: 0\n  m_StaticEditorFlags: 0\n  m_IsActive: 1\n`);
    const transform = (tr: string, go: string, father: string, order: number, children: string[], pos: V3 = [0, 0, 0], rot: Q = [0, 0, 0, 1]) =>
        docs.push(head(4, tr, 'Transform') + `  m_GameObject: ${local(go)}\n  m_LocalRotation: ${q4(rot)}\n  m_LocalPosition: ${v3(pos)}\n` +
            `  m_LocalScale: {x: 1, y: 1, z: 1}\n  m_Children:${children.length ? '\n' + children.map(c => `  - ${local(c)}\n`).join('') : ' []\n'}` +
            `  m_Father: ${local(father)}\n  m_RootOrder: ${order}\n  m_LocalEulerAnglesHint: {x: 0, y: 0, z: 0}\n`);
    const capsule = (c: Capsule, go: string, id: string) => docs.push(head(136, id, 'CapsuleCollider') +
        `  m_GameObject: ${local(go)}\n  m_Material: ${ref(GSPRO_PHYSICS[c.material])}\n  m_IsTrigger: 0\n  m_Enabled: 1\n` +
        `  m_Radius: ${f(c.radius)}\n  m_Height: ${f(c.height)}\n  m_Direction: ${c.direction}\n  m_Center: ${v3(c.center)}\n`);

    const rootGo = fid(1), rootTr = fid(4), lodGroup = fid(205);
    const children: string[] = [];
    const renderers: string[] = [];
    build.lods.forEach((_, k) => {
        const go = fid(1), tr = fid(4), mf = fid(33), mr = fid(23);
        children.push(tr); renderers.push(mr);
        gameObject(go, `${id}_LOD${k}`, [tr, mf, mr], 0);
        transform(tr, go, rootTr, k, []);
        docs.push(head(33, mf, 'MeshFilter') + `  m_GameObject: ${local(go)}\n  m_Mesh: {fileID: ${fbxMeshFileId(k)}, guid: ${input.fbxGuid}, type: 3}\n`);
        docs.push(head(23, mr, 'MeshRenderer') + `  m_GameObject: ${local(go)}\n` + RENDERER +
            `  m_Materials:\n${input.materials.map(g => `  - {fileID: 2100000, guid: ${g}, type: 2}\n`).join('')}` + RENDERER_TAIL);
    });

    const colliders = input.colliders === false ? [] : treeColliders(build);
    if (colliders.length > 0) {
        const holderGo = fid(1), holderTr = fid(4);
        const onHolder = colliders.filter(c => c.name === null).map(c => ({ c, id: fid(136) }));
        const parts = colliders.filter(c => c.name !== null).map((c, i) => ({ c, i, go: fid(1), tr: fid(4), col: fid(136) }));
        gameObject(holderGo, 'GolfMap Colliders', [holderTr, ...onHolder.map(h => h.id)]);
        transform(holderTr, holderGo, rootTr, children.length, parts.map(p => p.tr));
        children.push(holderTr);
        for (const h of onHolder) capsule(h.c, holderGo, h.id);
        for (const p of parts) {
            gameObject(p.go, p.c.name!, [p.tr, p.col]);
            transform(p.tr, p.go, holderTr, p.i, [], p.c.position, p.c.rotation);
            capsule(p.c, p.go, p.col);
        }
    }

    // LODGroup.RecalculateBounds: the renderers' joint bounds, sized by their longest side.
    const all = build.lods.map(l => bounds(l)!);
    const lo = [0, 1, 2].map(k => Math.min(...all.map(b => b.center[k]! - b.size[k]! / 2)));
    const hi = [0, 1, 2].map(k => Math.max(...all.map(b => b.center[k]! + b.size[k]! / 2)));
    docs.push(head(205, lodGroup, 'LODGroup') + `  m_GameObject: ${local(rootGo)}\n  serializedVersion: 2\n` +
        `  m_LocalReferencePoint: ${v3(lo.map((l, k) => (l + hi[k]!) / 2))}\n  m_Size: ${f(Math.max(...lo.map((l, k) => hi[k]! - l)))}\n` +
        `  m_FadeMode: 0\n  m_AnimateCrossFading: 0\n  m_LODs:\n` +
        renderers.map((r, k) => `  - screenRelativeHeight: ${f(input.lodHeights[Math.min(k, input.lodHeights.length - 1)]!)}\n    fadeTransitionWidth: 0\n    renderers:\n    - renderer: ${local(r)}\n`).join('') +
        `  m_Enabled: 1\n`);
    gameObject(rootGo, id, [rootTr, lodGroup], 0);
    transform(rootTr, rootGo, '0', 0, children);

    return '%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n--- !u!1001 &100100000\nPrefab:\n  m_ObjectHideFlags: 1\n  serializedVersion: 2\n' +
        '  m_Modification:\n    m_TransformParent: {fileID: 0}\n    m_Modifications: []\n    m_RemovedComponents: []\n' +
        `  m_SourcePrefab: {fileID: 0}\n  m_RootGameObject: ${local(rootGo)}\n  m_IsPrefabAsset: 1\n` + docs.join('');
}

const RENDERER = [
    'm_Enabled: 1', 'm_CastShadows: 1', 'm_ReceiveShadows: 1', 'm_DynamicOccludee: 1', 'm_MotionVectors: 1', 'm_LightProbeUsage: 1',
    'm_ReflectionProbeUsage: 1', 'm_RenderingLayerMask: 4294967295',
].map(l => `  ${l}\n`).join('');
const RENDERER_TAIL = [
    'm_StaticBatchInfo:', '  firstSubMesh: 0', '  subMeshCount: 0', 'm_StaticBatchRoot: {fileID: 0}', 'm_ProbeAnchor: {fileID: 0}',
    'm_LightProbeVolumeOverride: {fileID: 0}', 'm_ScaleInLightmap: 1', 'm_PreserveUVs: 0', 'm_IgnoreNormalsForChartDetection: 0',
    'm_ImportantGI: 0', 'm_StitchLightmapSeams: 0', 'm_SelectedEditorRenderState: 3', 'm_MinimumChartSize: 4', 'm_AutoUVMaxDistance: 0.5',
    'm_AutoUVMaxAngle: 89', 'm_LightmapParameters: {fileID: 0}', 'm_SortingLayerID: 0', 'm_SortingLayer: 0', 'm_SortingOrder: 0',
].map(l => `  ${l}\n`).join('');
