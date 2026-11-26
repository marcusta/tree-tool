// The tree-tool-models repo's check and index, run by its workflow with this repo checked out beside it:
//
//   bun scripts/models.ts check <models dir>                 every models/<id>/ checked; exit 1 on any error
//   bun scripts/models.ts index <models dir> --out <file>    the same check, then index.json for the app
//
// A model is a folder of files (packages/trees/models.ts says which and what they must be).
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { checkModel, indexEntry, type ModelIndex } from '../packages/trees/models';

const [command, dir, ...rest] = process.argv.slice(2);
if ((command !== 'check' && command !== 'index') || !dir) {
    console.error('bun scripts/models.ts check <models dir> | index <models dir> --out <file>');
    process.exit(2);
}
const out = rest.indexOf('--out') >= 0 ? rest[rest.indexOf('--out') + 1] : undefined;
if (command === 'index' && !out) { console.error('index needs --out <file>'); process.exit(2); }

const index: ModelIndex = { version: 1, models: [] };
let failed = 0;
const ids = readdirSync(dir).filter(name => !name.startsWith('.') && statSync(path.join(dir, name)).isDirectory()).sort();
for (const id of ids) {
    const folder = path.join(dir, id);
    const files: Record<string, Uint8Array> = {};
    const nested: string[] = [];
    for (const name of readdirSync(folder)) {
        if (statSync(path.join(folder, name)).isDirectory()) nested.push(name);
        else files[name] = new Uint8Array(readFileSync(path.join(folder, name)));
    }
    const { model, errors } = checkModel(id, files);
    if (nested.length) errors.push(`no folders inside a model: ${nested.join(', ')}`);
    if (errors.length || !model) {
        failed++;
        console.log(`✗ ${id}`);
        for (const e of errors) console.log(`    ${e}`);
        // GitHub shows these on the pull request's files
        if (process.env.GITHUB_ACTIONS) for (const e of errors) console.log(`::error file=${path.join(dir, id, 'model.json').replace(/\\/g, '/')}::${e}`);
        continue;
    }
    console.log(`✓ ${id}: ${model.name} (${model.license})`);
    index.models.push(indexEntry(id, model, files));
}
console.log(`${ids.length - failed} of ${ids.length} models pass`);
if (failed) process.exit(1);
if (command === 'index') {
    mkdirSync(path.dirname(out!), { recursive: true });
    writeFileSync(out!, JSON.stringify(index, null, 1) + '\n');
    console.log(`wrote ${out}`);
}
