// A .unitypackage written without Unity, in a browser or Bun: a gzipped tar with one folder per asset GUID holding
// `asset`, `asset.meta` and `pathname`. For a tree: its FBX (meta: our materials mapped onto the FBX's material
// names, LOD heights, normals as the generator made them, the LOD meshes' file ids pinned), one .mat per part from the
// shader profile's recipe, the pictures the user brought for any slot, and the prefab with LODs and GSPro colliders.
// GUIDs come from the tree id, so importing a tree again replaces its assets instead of adding copies.
import type { TreeBuild } from '../generator';
import { treeFbx } from './fbx';
import { fbxMeshFileId, prefabYaml } from './prefab';
import { channelsFor, type AssetRef, type MaterialRecipe, type ShaderProfile } from './profiles';

const utf8 = new TextEncoder();

/** A stable Unity GUID (32 hex digits) for a name. */
export async function guidFor(name: string): Promise<string> {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(name)));
    return Array.from(hash.slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

const ref = (r: AssetRef | null) => r ? `{fileID: ${r.fileID}, guid: ${r.guid}, type: ${r.type}}` : '{fileID: 0}';
const num = (x: number) => Number.isInteger(x) ? String(x) : String(Math.fround(x));

/** A material asset in Unity 2018.2's text form. */
export function materialYaml(name: string, recipe: MaterialRecipe): string {
    const lines = [
        '%YAML 1.1', '%TAG !u! tag:unity3d.com,2011:', '--- !u!21 &2100000', 'Material:',
        '  serializedVersion: 6', '  m_ObjectHideFlags: 0', '  m_PrefabParentObject: {fileID: 0}', '  m_PrefabInternal: {fileID: 0}',
        `  m_Name: ${name}`, `  m_Shader: ${ref(recipe.shader)}`, `  m_ShaderKeywords: ${recipe.keywords}`,
        '  m_LightmapFlags: 4', '  m_EnableInstancingVariants: 1', '  m_DoubleSidedGI: 0', `  m_CustomRenderQueue: ${recipe.renderQueue}`,
        '  stringTagMap: {}', '  disabledShaderPasses: []', '  m_SavedProperties:', '    serializedVersion: 3', '    m_TexEnvs:',
    ];
    for (const [prop, tex] of Object.entries(recipe.textures)) lines.push(`    - ${prop}:`, `        m_Texture: ${ref(tex)}`,
        '        m_Scale: {x: 1, y: 1}', '        m_Offset: {x: 0, y: 0}');
    lines.push('    m_Floats:');
    for (const [prop, v] of Object.entries(recipe.floats)) lines.push(`    - ${prop}: ${num(v)}`);
    lines.push('    m_Colors:');
    for (const [prop, [r, g, b, a]] of Object.entries(recipe.colors)) lines.push(`    - ${prop}: {r: ${num(r)}, g: ${num(g)}, b: ${num(b)}, a: ${num(a)}}`);
    return lines.join('\n') + '\n';
}

const nativeMeta = (guid: string, mainObject = 2100000) =>
    `fileFormatVersion: 2\nguid: ${guid}\nNativeFormatImporter:\n  externalObjects: {}\n  mainObjectFileID: ${mainObject}\n  userData: \n  assetBundleName: \n  assetBundleVariant: \n`;

const textMeta = (guid: string) =>
    `fileFormatVersion: 2
guid: ${guid}
TextScriptImporter:
  externalObjects: {}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;

/** How a picture is used, which sets its import: colour (sRGB), cutout (sRGB, alpha kept through the mips so thin
 *  leaves do not vanish at a distance, as OwnTextures does today), normal map, or linear data (masks, smoothness). */
export type TextureKind = 'color' | 'cutout' | 'normal' | 'linear';

/** A guess from the shader property's name; the user can change it. */
export function textureKind(property: string, part: 'bark' | 'leaves'): TextureKind {
    if (/bump|normal/i.test(property)) return 'normal';
    if (/^_MainTex$|albedo|basecolor|diffuse/i.test(property)) return part === 'leaves' && property === '_MainTex' ? 'cutout' : 'color';
    return 'linear';
}

export function textureMeta(guid: string, kind: TextureKind, maxSize = 4096): string {
    const cutout = kind === 'cutout' ? 1 : 0;
    return [
        'fileFormatVersion: 2', `guid: ${guid}`, 'TextureImporter:', '  fileIDToRecycleName: {}', '  externalObjects: {}', '  serializedVersion: 7',
        '  mipmaps:', '    mipMapMode: 0', '    enableMipMap: 1', `    sRGBTexture: ${kind === 'color' || kind === 'cutout' ? 1 : 0}`, '    linearTexture: 0',
        '    fadeOut: 0', '    borderMipMap: 0', `    mipMapsPreserveCoverage: ${cutout}`, `    alphaTestReferenceValue: ${cutout ? 0.3 : 0.5}`,
        '    mipMapFadeDistanceStart: 1', '    mipMapFadeDistanceEnd: 3',
        '  bumpmap:', '    convertToNormalMap: 0', '    externalNormalMap: 0', '    heightScale: 0.25', '    normalMapFilter: 0',
        '  isReadable: 0', '  grayScaleToAlpha: 0', '  textureFormat: 1', `  maxTextureSize: ${maxSize}`,
        '  textureSettings:', '    serializedVersion: 2', '    filterMode: -1', '    aniso: -1', '    mipBias: -100', '    wrapU: -1', '    wrapV: -1', '    wrapW: -1',
        '  nPOTScale: 1', '  lightmap: 0', '  compressionQuality: 50', '  alphaUsage: 1', `  alphaIsTransparency: ${cutout}`,
        `  textureType: ${kind === 'normal' ? 1 : 0}`, '  textureShape: 1',
        '  platformSettings:', '  - serializedVersion: 2', '    buildTarget: DefaultTexturePlatform', `    maxTextureSize: ${maxSize}`, '    resizeAlgorithm: 0',
        '    textureFormat: -1', '    textureCompression: 1', '    compressionQuality: 50', '    crunchedCompression: 0', '    allowsAlphaSplitting: 0', '    overridden: 0',
        '  userData: ', '  assetBundleName: ', '  assetBundleVariant: ', '',
    ].join('\n');
}

/** The FBX's importer settings: our materials in place of the FBX's own, the generator's normals, no compression, and
 *  each LOD mesh's file id pinned so the prefab can name it. */
export function fbxMeta(guid: string, materials: Record<string, string>, lodHeights: number[], meshes: string[] = []): string {
    const remap = Object.entries(materials).sort(([a], [b]) => a < b ? -1 : 1).flatMap(([name, matGuid]) => [
        '  - first:', '      type: UnityEngine:Material', '      assembly: UnityEngine.CoreModule', `      name: ${name}`,
        `    second: {fileID: 2100000, guid: ${matGuid}, type: 2}`]);
    return [
        'fileFormatVersion: 2', `guid: ${guid}`, 'ModelImporter:', '  serializedVersion: 23',
        ...(meshes.length ? ['  fileIDToRecycleName:', ...meshes.map((m, k) => `    ${fbxMeshFileId(k)}: ${m}`)] : []),
        '  externalObjects:', ...remap,
        '  materials:', '    importMaterials: 1', '    materialName: 0', '    materialSearch: 1', '    materialLocation: 1',
        '  animations:', '    isReadable: 0',
        '  meshes:', '    lODScreenPercentages:', ...lodHeights.map(h => `    - ${h}`),
        '    globalScale: 1', '    meshCompression: 0', '    addColliders: 0', '    importVisibility: 0', '    importBlendShapes: 0',
        '    importCameras: 0', '    importLights: 0', '    swapUVChannels: 0', '    generateSecondaryUV: 0', '    useFileUnits: 1',
        '    optimizeMeshForGPU: 1', '    keepQuads: 0', '    weldVertices: 1', '    preserveHierarchy: 0', '    indexFormat: 0',
        '    useFileScale: 1',
        '  tangentSpace:', '    normalSmoothAngle: 60', '    normalImportMode: 0', '    tangentImportMode: 3', '    normalCalculationMode: 4',
        '  importAnimation: 0', '  animationType: 0', '  userData: ', '  assetBundleName: ', '  assetBundleVariant: ', '',
    ].join('\n');
}

// ---- tar + gzip ----------------------------------------------------------------------------------

export interface PackageAsset { path: string; guid: string; asset: Uint8Array; meta: string }

function tarHeader(name: string, size: number): Uint8Array {
    const h = new Uint8Array(512);
    const put = (s: string, at: number) => h.set(utf8.encode(s), at);
    if (utf8.encode(name).length > 100) throw Error(`tar name too long: ${name}`);
    put(name, 0);
    put('0000644\0', 100); put('0000000\0', 108); put('0000000\0', 116);
    put(size.toString(8).padStart(11, '0') + '\0', 124);
    put('00000000000\0', 136);
    put('        ', 148);
    put('0', 156);
    put('ustar\0', 257); put('00', 263);
    const sum = h.reduce((s, b) => s + b, 0);
    put(sum.toString(8).padStart(6, '0') + '\0 ', 148);
    return h;
}

function tar(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
    const size = files.reduce((s, f) => s + 512 + Math.ceil(f.data.length / 512) * 512, 1024);
    const out = new Uint8Array(size);
    let at = 0;
    for (const f of files) {
        out.set(tarHeader(f.name, f.data.length), at);
        out.set(f.data, at + 512);
        at += 512 + Math.ceil(f.data.length / 512) * 512;
    }
    return out;
}

async function gzip(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
    const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unityPackage(assets: PackageAsset[]): Promise<Uint8Array> {
    const files = assets.flatMap(a => [
        { name: `${a.guid}/asset`, data: a.asset },
        { name: `${a.guid}/asset.meta`, data: utf8.encode(a.meta) },
        { name: `${a.guid}/pathname`, data: utf8.encode(a.path) },
    ]);
    return gzip(tar(files));
}

// ---- a tree --------------------------------------------------------------------------------------

/** A picture the user brings for one material slot: packed into the package and set on the material. */
export interface OwnTexture { fileName: string; bytes: Uint8Array; kind: TextureKind }

export interface TreePackageInput {
    id: string;
    build: TreeBuild;
    profile: ShaderProfile;
    /** Where it lands in the project, under Assets/. */
    folder?: string;
    lodHeights?: number[];
    /** Per part and shader property: the user's own picture, or null to leave the slot empty. Other slots keep the
     *  profile's reference into the pack. */
    textures?: Partial<Record<'bark' | 'leaves', Record<string, OwnTexture | null>>>;
    /** The prefab with LODGroup and GSPro colliders (default true). */
    prefab?: boolean;
    /** Who made the pictures the package carries and under which licence: written as CREDITS.txt beside the tree. */
    credits?: string;
}

export interface TreePackage { filename: string; bytes: Uint8Array; fbxBytes: Uint8Array; paths: string[]; timings: Record<string, number> }

/** A tree's .unitypackage: the FBX, its two materials (linked to the user's pack by GUID, or to pictures they brought)
 *  and the prefab with LODs and colliders. */
export async function treePackage(input: TreePackageInput): Promise<TreePackage> {
    const { id, build, profile } = input;
    const folder = input.folder ?? `Assets/TreeTool/${id}`;
    const lodHeights = input.lodHeights ?? [0.45, 0.18, 0.012];
    const t0 = performance.now();
    const names = { bark: `${id} bark`, leaves: `${id} leaves` };
    const fbxBytes = treeFbx({ id, build, materials: names, channels: channelsFor(profile) });
    const t1 = performance.now();
    const fbxGuid = await guidFor(`${folder}/${id}.fbx`);
    const assets: PackageAsset[] = [];
    const mats = await Promise.all((['bark', 'leaves'] as const).map(async part => {
        const path = `${folder}/Materials/${names[part]}.mat`;
        const recipe = { ...profile.materials[part], textures: { ...profile.materials[part].textures } };
        for (const [property, own] of Object.entries(input.textures?.[part] ?? {})) {
            if (!own) { recipe.textures[property] = null; continue; }
            const texPath = `${folder}/Textures/${own.fileName}`;
            const guid = await guidFor(texPath);
            if (!assets.some(a => a.guid === guid)) assets.push({ path: texPath, guid, asset: own.bytes, meta: textureMeta(guid, own.kind) });
            recipe.textures[property] = { fileID: 2800000, guid, type: 3 };
        }
        return { part, name: names[part], path, guid: await guidFor(path), recipe };
    }));
    const meshes = build.lods.map((_, k) => `${id}_LOD${k}`);
    assets.push(
        { path: `${folder}/${id}.fbx`, guid: fbxGuid, asset: fbxBytes,
            meta: fbxMeta(fbxGuid, Object.fromEntries(mats.map(m => [m.name, m.guid])), lodHeights, meshes) },
        ...mats.map(m => ({ path: m.path, guid: m.guid, asset: utf8.encode(materialYaml(m.name, m.recipe)), meta: nativeMeta(m.guid) })),
    );
    if (input.prefab !== false) {
        const path = `${folder}/${id}.prefab`, guid = await guidFor(path);
        const yaml = prefabYaml({ id, build, fbxGuid, materials: [mats[0]!.guid, mats[1]!.guid], lodHeights });
        assets.push({ path, guid, asset: utf8.encode(yaml), meta: nativeMeta(guid, 100100000) });
    }
    if (input.credits) {
        const path = `${folder}/CREDITS.txt`, guid = await guidFor(path);
        assets.push({ path, guid, asset: utf8.encode(input.credits), meta: textMeta(guid) });
    }
    const bytes = await unityPackage(assets);
    const t2 = performance.now();
    return { filename: `${id}.unitypackage`, bytes, fbxBytes, paths: assets.map(a => a.path), timings: { fbxMs: t1 - t0, packageMs: t2 - t1 } };
}
