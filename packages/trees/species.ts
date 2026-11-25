// The tree species the generator knows (species.json): for each its materials, the Unity materials it is drawn
// with, the pictures the web editor shows, and its presets. A preset lies over the species' defaults, which lie
// over the generator's.
import { resolveParams, type DeepPartial, type TreeLodSpec, type TreeMaterials, type TreeParams } from './generator';
import file from './species.json';

export interface UnityMaterialSpec {
    /** The NatureManufacture material copied as a template. */
    from: string;
    /** Shader property -> texture asset name, set on the copy. */
    textures?: Record<string, string>;
    /** Shader property -> number, set on the copy (a cut-out threshold that fits the atlas). */
    floats?: Record<string, number>;
    /** Shader property -> a normal map in Forst's CTI packing (x in alpha, y in green), converted for the NM shader. */
    ctiNormals?: Record<string, string>;
    /** Shader property -> [r, g, b], set on the copy. */
    colors?: Record<string, number[]>;
    /** Shader property -> a picture the build brings itself (`GolfMap Tree Atlas <atlas>`), or '' for no texture. */
    ownTextures?: Record<string, string>;
}

export interface TreeSpecies {
    name: string;
    materials: TreeMaterials;
    unity: { bark: UnityMaterialSpec; leaves: UnityMaterialSpec };
    /** Files under a Unity project's Assets folder. */
    web: { bark?: string; barkNormal?: string; leaves?: string };
    /** A leaf atlas drawn in the repo (atlas/<atlas>.png; golf-map's pipeline/tree_atlas.py draws it) in place of a pack's:
     *  it goes with the build as textures/GolfMap Tree Atlas <atlas>.png and is the web editor's leaf picture. */
    atlas?: string;
    /** A tileable bark image authored in atlas/, in place of a pack texture. */
    barkAtlas?: string;
    defaults: DeepPartial<TreeParams>;
    /** The species' own detail levels, nearest first, in place of the generator's: a bush whose branches hide in
     *  its needles needs thinner tubes than a tree. */
    lods?: TreeLodSpec[];
    /** Presets with a different mesh budget from the rest of this species. */
    presetLods?: { presets: string[]; levels: TreeLodSpec[] }[];
    presets: Record<string, DeepPartial<TreeParams> & {
        /** Shared Forst materials relative to the active Unity course. One leaf material per LOD. */
        ctiMaterials?: { bark: string; leaves: string[] };
    }>;
}

export const SPECIES = file.species as unknown as Record<string, TreeSpecies>;

export function species(id: string): TreeSpecies {
    const found = SPECIES[id];
    if (!found) throw Error(`No tree species '${id}' (${Object.keys(SPECIES).join(', ')})`);
    return found;
}

/** The species' own tree before any preset. */
export const speciesParams = (id: string): TreeParams => resolveParams(species(id).defaults);

export function presetLods(sp: TreeSpecies, preset: string): TreeLodSpec[] | undefined {
    return sp.presetLods?.find(group => group.presets.includes(preset))?.levels ?? sp.lods;
}

export function presetParams(speciesId: string, preset: string): TreeParams {
    const sp = species(speciesId);
    const over = sp.presets[preset];
    if (!over) throw Error(`${sp.name} has no preset '${preset}' (${Object.keys(sp.presets).join(', ')})`);
    return resolveParams(over, resolveParams(sp.defaults));
}
