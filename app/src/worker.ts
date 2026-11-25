// The heavy part of the tree export, off the page's thread: generate the tree, write the FBX, the materials, the
// prefab and the package. Pictures come in as bytes and go into the package as they are.
import { generateTree } from '@tree-tool/trees/generator';
import { presetLods, presetParams, species } from '@tree-tool/trees/species';
import type { ShaderProfile } from '@tree-tool/trees/export/profiles';
import { treePackage, type TreePackageInput } from '@tree-tool/trees/export/unity-package';

export interface ExportRequest {
    species: string; preset: string; seed: number; prefab: boolean;
    profile: ShaderProfile;
    textures: TreePackageInput['textures'];
}

export type ExportReply =
    | { ok: true; filename: string; bytes: Uint8Array; paths: string[]; ms: Record<string, number> }
    | { ok: false; error: string };

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
    try {
        const r = e.data;
        const sp = species(r.species);
        const id = `${r.species}_${r.preset.replace(/-/g, '_')}_${r.seed}`.replace(/-/g, '_');
        const t0 = performance.now();
        const build = generateTree(presetParams(r.species, r.preset), { ...sp.materials, cti: false }, r.seed, presetLods(sp, r.preset));
        const t1 = performance.now();
        const pkg = await treePackage({ id, build, profile: r.profile, textures: r.textures, prefab: r.prefab });
        const ms = { generate: Math.round(t1 - t0), fbx: Math.round(pkg.timings.fbxMs!), package: Math.round(pkg.timings.packageMs!) };
        const reply: ExportReply = { ok: true, filename: pkg.filename, bytes: pkg.bytes, paths: pkg.paths, ms };
        (self as unknown as Worker).postMessage(reply, [pkg.bytes.buffer]);
    } catch (err) {
        (self as unknown as Worker).postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) } satisfies ExportReply);
    }
};
