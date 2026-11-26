// The heavy part of the tree export, off the page's thread: generate the tree, write the FBX, the materials, the
// prefab and the package. Pictures come in as bytes and go into the package as they are.
import { generateTree } from '@tree-tool/trees/generator';
import { presetLods, presetParams, species } from '@tree-tool/trees/species';
import { applyControls } from '@tree-tool/trees/export-settings';
import type { ShaderProfile } from '@tree-tool/trees/export/profiles';
import { treePackage, type TreePackageInput } from '@tree-tool/trees/export/unity-package';
import { treeId } from './tree-id';

export interface ExportRequest {
    species: string; preset: string; seed: number; prefab: boolean;
    /** Slider path -> value, where it differs from the preset. */
    changes: Record<string, number>;
    profile: ShaderProfile;
    textures: TreePackageInput['textures'];
    credits?: string;
}

export type ExportReply =
    | { ok: true; filename: string; bytes: Uint8Array; paths: string[]; ms: Record<string, number> }
    | { ok: false; error: string };

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
    try {
        const r = e.data;
        const sp = species(r.species);
        const t0 = performance.now();
        const params = presetParams(r.species, r.preset);
        applyControls(params, r.changes);
        const build = generateTree(params, { ...sp.materials, cti: false }, r.seed, presetLods(sp, r.preset));
        const t1 = performance.now();
        const pkg = await treePackage({ id: treeId(r), build, profile: r.profile, textures: r.textures, prefab: r.prefab, credits: r.credits });
        const ms = { generate: Math.round(t1 - t0), fbx: Math.round(pkg.timings.fbxMs!), package: Math.round(pkg.timings.packageMs!) };
        const reply: ExportReply = { ok: true, filename: pkg.filename, bytes: pkg.bytes, paths: pkg.paths, ms };
        (self as unknown as Worker).postMessage(reply, [pkg.bytes.buffer]);
    } catch (err) {
        (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) } satisfies ExportReply);
    }
};
