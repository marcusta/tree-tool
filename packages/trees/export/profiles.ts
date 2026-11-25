// Shader profiles: what a tree shader needs from a generated tree. Two halves:
//  - channels: the per-vertex data the shader's wind and shading read (vertex colour, uv sets 2 and 3), computed here
//    from the generator's mesh, the same numbers blender/tools/tree_fbx.py writes;
//  - materials: a recipe per part that names the shader and the pack's textures by their Unity GUIDs only. The package
//    carries no shader and no texture: the materials resolve once it is imported into a project that has the pack.
// A profile is data (the catalogue a server could keep); the channel code is the only part that is code.
import type { TreeMesh } from '../generator';
import type { ShaderChannels } from './fbx';

/** A Unity object reference by file id and GUID, as a .mat or .prefab writes it. */
export interface AssetRef { fileID: number; guid: string; type: number; /** The file in the pack, for people to read. */ name?: string }

export interface MaterialRecipe {
    /** The shader, by reference: never packaged. */
    shader: AssetRef;
    keywords: string;
    renderQueue: number;
    /** Shader property -> texture (null = none). */
    textures: Record<string, AssetRef | null>;
    floats: Record<string, number>;
    colors: Record<string, [number, number, number, number]>;
}

export interface ShaderProfile {
    id: string;
    label: string;
    channels: 'nm' | 'cti';
    materials: { bark: MaterialRecipe; leaves: MaterialRecipe };
    /** Slots the catalogue cannot link into a pack (a picture of our own, a tinted copy): the user brings them. */
    needs?: { part: 'bark' | 'leaves'; property: string; what: string }[];
}

/** Rounds like Blender's byte colour (what the reference FBX holds). */
const byte = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255) / 255;

/** NatureManufacture tree shaders: shiver strength in vertex alpha, the bark's detail uvs in uv set 3. Uv set 2 is
 *  a copy of the first, as Blender's new uv layer is in the reference. */
export function nmChannels(lod: TreeMesh): ShaderChannels {
    const n = lod.positions.length / 3;
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) rgba[i * 4 + 3] = byte(lod.alpha[i]!);
    return { uv2: Float32Array.from(lod.uv), uv3: Float32Array.from(lod.uv3), rgba };
}

export function channelsFor(profile: ShaderProfile): (lod: TreeMesh) => ShaderChannels {
    if (profile.channels === 'nm') return nmChannels;
    throw Error(`The ${profile.channels} channels are not ported from tree_fbx.py yet.`);
}
