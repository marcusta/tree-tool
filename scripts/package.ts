// A tree's .unitypackage with no Blender and no Unity (packages/trees/export/), from the command line.
//
//   bun run package -- catalogue --assets <Unity project>/Assets [--out packages/trees/export/catalogue/nm]
//   bun run package -- <species>/<preset> --out <folder> [--seed <n>] [--catalogue <dir>]
//
// `catalogue` reads each species' NatureManufacture materials from a project that has the pack and writes one shader
// profile per species: the template material (shader + texture GUIDs, only the properties its shader declares) with
// the species' own settings on top. Its pictures that are no pack's (drawn in the repo, our tinted copies) become
// `needs`: slots the user fills with their own pictures. Only GUIDs and names go in, never a licensed byte: this is
// the catalogue a server would serve. Building a package is what the browser runs (app/).
// The catalogue also gets an index.ts that imports every profile, for the app and the package's users.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateTree } from '../packages/trees/generator';
import { presetLods, presetParams, SPECIES, species } from '../packages/trees/species';
import type { AssetRef, MaterialRecipe, ShaderProfile } from '../packages/trees/export/profiles';
import { treePackage } from '../packages/trees/export/unity-package';

const args = process.argv.slice(2);
const value = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const DEFAULT_CATALOGUE = path.join(import.meta.dir, '..', 'packages', 'trees', 'export', 'catalogue', 'nm');

if (args[0] === 'catalogue') {
    const assets = value('assets');
    if (!assets) { console.error('Usage: bun run package -- catalogue --assets <project>/Assets [--out <dir>]'); process.exit(1); }
    catalogue(assets, value('out') ?? DEFAULT_CATALOGUE);
} else {
    await build();
}

// ---- catalogue ------------------------------------------------------------------------------------

function catalogue(assets: string, out: string) {
    const files = new Map<string, string[]>();
    const walk = (dir: string) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) walk(p);
            else files.set(e.name, [...files.get(e.name) ?? [], p]);
        }
    };
    walk(assets);
    const guidOf = (file: string) => /guid: ([0-9a-f]{32})/.exec(readFileSync(`${file}.meta`, 'utf8'))![1]!;
    const pack = (p: string) => path.relative(assets, p).split(path.sep)[0]!;
    const ours = (p: string) => path.relative(assets, p).split(path.sep).includes('GolfMap');
    const byGuid = new Map<string, string>();
    for (const [name, ps] of files) if (name.endsWith('.meta')) for (const p of ps) {
        const m = /guid: ([0-9a-f]{32})/.exec(readFileSync(p, 'utf8'));
        if (m) byGuid.set(m[1]!, p.slice(0, -5));
    }
    const refOf = (s: string): AssetRef | null => {
        const m = /\{fileID: (\d+)(?:, guid: ([0-9a-f]{32}), type: (\d+))?\}/.exec(s);
        if (!m || !m[2]) return null;
        const file = byGuid.get(m[2]);
        return { fileID: Number(m[1]), guid: m[2], type: Number(m[3]), ...(file ? { name: path.basename(file) } : {}) };
    };
    const texture = (name: string) => ['.png', '.tga', '.tif', '.psd', '.jpg', '.exr'].flatMap(ext => files.get(name + ext) ?? []).sort()[0];

    /** The pack's template material as a recipe, keeping only what its shader declares. */
    const template = (from: string): { recipe: MaterialRecipe; pack: string } => {
        // As GolfMapTreeModels.FindByName, but the pack's own copy, never a course's tuned variant.
        const found = (files.get(`${from}.mat`) ?? []).filter(p => p.includes('NatureManufacture')).sort()[0];
        if (!found) throw Error(`No NatureManufacture material ${from}.mat under ${assets}`);
        const mat = readFileSync(found, 'utf8');
        const shader = refOf(/m_Shader: (\{[^}]*\})/.exec(mat)![1]!)!;
        const shaderFile = byGuid.get(shader.guid);
        if (!shaderFile) throw Error(`No shader with guid ${shader.guid}`);
        const source = readFileSync(shaderFile, 'utf8');
        const block = source.slice(source.indexOf('Properties'), source.indexOf('SubShader'));
        const declared = new Set([...block.matchAll(/^\s*(?:\[[^\]]*\]\s*)*(_\w+)\s*\(/gm)].map(m => m[1]!));
        const r: MaterialRecipe = {
            shader: { ...shader, name: path.basename(shaderFile) }, keywords: /m_ShaderKeywords: ?(.*)/.exec(mat)![1]!.trim(),
            renderQueue: Number(/m_CustomRenderQueue: (-?\d+)/.exec(mat)![1]), textures: {}, floats: {}, colors: {},
        };
        for (const m of mat.matchAll(/^    - (_\w+):\n        m_Texture: (\{[^}]*\})/gm)) if (declared.has(m[1]!)) r.textures[m[1]!] = refOf(m[2]!);
        for (const m of mat.matchAll(/^    - (_\w+): (-?[\d.e-]+)$/gm)) if (declared.has(m[1]!)) r.floats[m[1]!] = Number(m[2]);
        for (const m of mat.matchAll(/^    - (_\w+): \{r: ([^,]+), g: ([^,]+), b: ([^,]+), a: ([^}]+)\}/gm))
            if (declared.has(m[1]!)) r.colors[m[1]!] = [Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5])];
        return { recipe: r, pack: pack(found) };
    };

    mkdirSync(out, { recursive: true });
    const written: Record<string, unknown> = {};
    for (const id of Object.keys(SPECIES)) {
        const sp = species(id);
        const needs: NonNullable<ShaderProfile['needs']> = [];
        const packs = new Set<string>();
        const part = (key: 'bark' | 'leaves'): MaterialRecipe => {
            const spec = sp.unity[key] as unknown as {
                from: string; textures?: Record<string, string>; ctiNormals?: Record<string, string>; ownTextures?: Record<string, string>;
                floats?: Record<string, number>; colors?: Record<string, number[]>;
            };
            const { recipe, pack: p } = template(spec.from);
            packs.add(p);
            for (const [prop, name] of Object.entries(spec.textures ?? {})) {
                const file = texture(name);
                if (!file || ours(file)) { recipe.textures[prop] = null; needs.push({ part: key, property: prop, what: `${name} (our copy, not in a pack)` }); }
                else { recipe.textures[prop] = { fileID: 2800000, guid: guidOf(file), type: 3, name: path.basename(file) } ; packs.add(pack(file)); }
            }
            for (const [prop, name] of Object.entries(spec.ctiNormals ?? {})) {
                recipe.textures[prop] = null;
                needs.push({ part: key, property: prop, what: `a normal map made from ${name} (a CTI pack's picture, repacked)` });
            }
            for (const [prop, file] of Object.entries(spec.ownTextures ?? {})) {
                recipe.textures[prop] = null;
                if (file) needs.push({ part: key, property: prop, what: `${file}.png (drawn by golf-map's pipeline/tree_atlas.py, in atlas/)` });
            }
            for (const [prop, v] of Object.entries(spec.floats ?? {})) recipe.floats[prop] = v;
            for (const [prop, rgb] of Object.entries(spec.colors ?? {})) recipe.colors[prop] = [rgb[0]!, rgb[1]!, rgb[2]!, recipe.colors[prop]?.[3] ?? 1];
            return recipe;
        };
        const profile: ShaderProfile = {
            id: `nm-${id}`, label: `NatureManufacture: ${sp.unity.bark.from} + ${sp.unity.leaves.from}`, channels: 'nm',
            materials: { bark: part('bark'), leaves: part('leaves') },
            ...(needs.length ? { needs } : {}),
        };
        writeFileSync(path.join(out, `${id}.json`), JSON.stringify(profile, null, 1) + '\n');
        written[id] = { packs: [...packs], needs: needs.length };
    }
    writeIndex(out, Object.keys(written));
    console.log(JSON.stringify({ out, species: written }, null, 1));
}

/** index.ts: every profile in the folder by species id, so Bun and the browser load the catalogue the same way. */
function writeIndex(out: string, ids: string[]) {
    const name = (id: string) => id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
    const lines = [
        "// Written by `bun run package -- catalogue`: every species' profile in this folder, by species id.",
        "import type { ShaderProfile } from '../../profiles';",
        ...ids.map(id => `import ${name(id)} from './${id}.json';`),
        '',
        'export const NM_CATALOGUE = {',
        ...ids.map(id => `    '${id}': ${name(id)},`),
        '} as unknown as Record<string, ShaderProfile>;',
        '',
    ];
    writeFileSync(path.join(out, 'index.ts'), lines.join('\n'));
}

// ---- one package ----------------------------------------------------------------------------------

async function build() {
    const [speciesId, preset] = (args[0] ?? '').split('/');
    const out = value('out');
    if (!speciesId || !preset || !out) {
        console.error('Usage: bun run package -- <species>/<preset> --out <folder> [--seed <n>] [--catalogue <dir>]');
        process.exit(1);
    }
    const seed = Number(value('seed') ?? 1);
    const profile = JSON.parse(readFileSync(path.join(value('catalogue') ?? DEFAULT_CATALOGUE, `${speciesId}.json`), 'utf8')) as ShaderProfile;
    const sp = species(speciesId);
    if (sp.presets[preset]?.ctiMaterials) console.warn('Note: this preset uses CTI materials; the package links the NM profile.');
    const id = `${speciesId}_${preset.replace(/-/g, '_')}_${seed}`;
    const t0 = performance.now();
    const tree = generateTree(presetParams(speciesId, preset), { ...sp.materials, cti: false }, seed, presetLods(sp, preset));
    const t1 = performance.now();
    const pkg = await treePackage({ id, build: tree, profile });
    mkdirSync(out, { recursive: true });
    writeFileSync(path.join(out, pkg.filename), pkg.bytes);
    writeFileSync(path.join(out, `${id}.fbx`), pkg.fbxBytes);
    console.log(JSON.stringify({
        id, package: path.join(out, pkg.filename), packageKB: Math.round(pkg.bytes.length / 1024), assets: pkg.paths,
        ms: { generate: Math.round(t1 - t0), fbx: Math.round(pkg.timings.fbxMs!), materialsPrefabTarGzip: Math.round(pkg.timings.packageMs!) },
        needs: profile.needs ?? [],
    }, null, 1));
}
