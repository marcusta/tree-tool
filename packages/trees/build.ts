// Builds the package for its users: dist/ holds one ES module per entry (shared code in chunks, the JSON inlined)
// and the type declarations. Users that run TypeScript from node_modules are not assumed: Vite, for one, does not.
// Inside this repo the app and the tests read the source (the `source` export condition).
import { rmSync } from 'node:fs';
import path from 'node:path';

const dir = import.meta.dir;
const ENTRIES = [
    'generator.ts', 'species.ts', 'controls.ts', 'export-settings.ts', 'models.ts',
    'export/fbx.ts', 'export/prefab.ts', 'export/profiles.ts', 'export/unity-package.ts', 'export/catalogue/nm/index.ts',
];

rmSync(path.join(dir, 'dist'), { recursive: true, force: true });
const out = await Bun.build({
    entrypoints: ENTRIES.map(e => path.join(dir, e)),
    root: dir, outdir: path.join(dir, 'dist'), splitting: true, target: 'browser', format: 'esm',
    naming: { entry: '[dir]/[name].[ext]', chunk: 'chunks/[name]-[hash].[ext]' },
});
if (!out.success) { for (const log of out.logs) console.error(log); process.exit(1); }

const tsc = Bun.spawnSync([path.join(dir, '..', '..', 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.exe' : 'tsc'), '-p', path.join(dir, 'tsconfig.build.json')], { stdout: 'inherit', stderr: 'inherit' });
if (tsc.exitCode !== 0) process.exit(tsc.exitCode ?? 1);
console.log(`dist: ${out.outputs.length} modules + declarations`);
