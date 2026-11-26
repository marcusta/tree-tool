/**
 * Tree tool: a tree as a .unitypackage, built in the browser. Nothing goes to a server.
 *
 * - The tree: species, preset, seed and the sliders (TREE_CONTROL_GROUPS), drawn with three.js as they move. The page's
 *   address always holds the tree (link.ts), so copying it shares the tree.
 * - Shader and textures: a species' profile comes from the catalogue (packages/trees/export/catalogue/: shader and
 *   texture GUIDs of the pack the tree is made for, never a pack's file), so the package resolves in a project that has
 *   the pack. Any slot can take a picture instead: the user's own, a shared model's, or one of the atlases drawn in this
 *   repo, which fill the slots a species names them for. A profile JSON of the same shape stands for one's own shader.
 * - Shared models: the index the tree-tool-models repo publishes (MODELS_URL); a model brings its settings, pictures
 *   and profile, and its credits go into the package. "Share" checks a new model as that repo's pull requests are
 *   checked and hands the files to GitHub.
 */
import { generateTree, triangles, type TreeBuild, type TreeParams } from '@tree-tool/trees/generator';
import { presetLods, presetParams, SPECIES, species } from '@tree-tool/trees/species';
import { readParam, TREE_CONTROL_GROUPS, writeParam } from '@tree-tool/trees/controls';
import { applyControls, type TreeExportSettings } from '@tree-tool/trees/export-settings';
import type { ShaderProfile } from '@tree-tool/trees/export/profiles';
import { textureKind, type TextureKind } from '@tree-tool/trees/export/unity-package';
import { NM_CATALOGUE } from '@tree-tool/trees/export/catalogue/nm';
import {
    checkModel, checkProfile, creditsText, MODEL_LICENSES, modelSlug, textureFile, type ModelIndex, type ModelIndexEntry, type ModelLicense,
    type SharedModel,
} from '@tree-tool/trees/models';
import { createPreview, type View } from './preview';
import { fromHash, toHash } from './link';
import { treeId } from './tree-id';
import type { ExportReply, ExportRequest } from './worker';

const MODELS_URL: string = import.meta.env.VITE_MODELS_URL ?? 'https://marcusta.github.io/tree-tool-models/';
const MODELS_REPO: string = import.meta.env.VITE_MODELS_REPO ?? 'marcusta/tree-tool-models';
const STORAGE_KEY = 'tree-tool';

/** Leaf and bark atlases drawn in this repo (our own pictures), by name. */
const ATLASES: Record<string, string> = Object.fromEntries(
    Object.entries(import.meta.glob('../../packages/trees/atlas/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>)
        .map(([file, url]) => [file.split('/').pop()!.replace(/\.png$/, ''), url]));
const ATLAS_PREFIX = 'GolfMap Tree Atlas ';
/** Drawn with stand-in needles rather than leaves when their pack's picture is not here. */
const CONIFERS = new Set(['pine', 'spruce', 'juniper']);

type Part = 'bark' | 'leaves';
const PARTS = ['bark', 'leaves'] as const;
/** A picture in a slot: the user's file, a shared model's, or a drawn atlas. Bytes are fetched when first needed. */
interface Pick { fileName: string; kind: TextureKind; from: 'user' | 'model' | 'atlas'; url: string; bytes?: Uint8Array }
type Picks = Record<Part, Record<string, Pick | 'none'>>;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
function el(tag: string, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElement {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
}

// ---- state ------------------------------------------------------------------------------------------------------
const firstSpecies = Object.keys(SPECIES)[0]!;
const state = { species: firstSpecies, preset: Object.keys(SPECIES[firstSpecies]!.presets)[0]!, seed: 1, lod: 0, params: presetParams(firstSpecies, Object.keys(SPECIES[firstSpecies]!.presets)[0]!) };
const view: View = { yawDeg: 20, pitchDeg: 8, distanceM: 38, targetZ: 9 };
let picks: Picks = { bark: {}, leaves: {} };
let custom: { profile: ShaderProfile; from: 'user' | 'model'; bytes: Uint8Array } | null = null;
/** The shared model last loaded; its credits go along while its pictures or profile are in use. */
let model: ModelIndexEntry | null = null;
let index: ModelIndexEntry[] = [];
let build: TreeBuild | null = null;
let buildMs = 0;

const profile = (): ShaderProfile | undefined => custom?.profile ?? NM_CATALOGUE[state.species];

function changes(): Record<string, number> {
    const base = presetParams(state.species, state.preset), out: Record<string, number> = {};
    for (const g of TREE_CONTROL_GROUPS) for (const c of g.controls) {
        const v = readParam(state.params, c.path);
        if (v !== readParam(base, c.path)) out[c.path] = v;
    }
    return out;
}
const settings = (): TreeExportSettings => ({ species: state.species, preset: state.preset, seed: state.seed, changes: changes() });

function applySettings(s: TreeExportSettings): void {
    Object.assign(state, { species: s.species, preset: s.preset, seed: s.seed });
    const params: TreeParams = presetParams(s.species, s.preset);
    applyControls(params, s.changes);
    state.params = params;
}

/** Are the model's pictures or profile in the tree (then its credits go along, and the link names it)? */
const modelInUse = (): boolean => !!model && (custom?.from === 'model' ||
    PARTS.some(part => Object.values(picks[part]).some(p => p !== 'none' && p.from === 'model')));
/** Is the tree still the model's: its pictures in use, or its settings unchanged? */
const modelShown = (): boolean => modelInUse() || (!!model && JSON.stringify(settings()) === JSON.stringify(model.tree));

/** The species' own pictures: slots its Unity material fills with a drawn atlas, or leaves empty. */
function speciesPicks(): Picks {
    const out: Picks = { bark: {}, leaves: {} };
    const p = NM_CATALOGUE[state.species];
    if (!p) return out;
    for (const part of PARTS) for (const [prop, name] of Object.entries(species(state.species).unity[part].ownTextures ?? {})) {
        if (!(prop in p.materials[part].textures)) continue;
        if (name === '') { out[part][prop] = 'none'; continue; }
        const atlas = name.startsWith(ATLAS_PREFIX) ? name.slice(ATLAS_PREFIX.length) : '';
        if (ATLASES[atlas]) out[part][prop] = { fileName: `${atlas}.png`, kind: textureKind(prop, part), from: 'atlas', url: ATLASES[atlas]! };
    }
    return out;
}

async function bytesOf(pick: Pick): Promise<Uint8Array> {
    if (!pick.bytes) {
        const r = await fetch(pick.url);
        if (!r.ok) throw Error(`could not load ${pick.fileName}`);
        pick.bytes = new Uint8Array(await r.arrayBuffer());
    }
    return pick.bytes;
}

function save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings(), lod: state.lod, view, model: modelInUse() ? model!.id : undefined })); } catch { /* no storage */ }
}

// ---- preview ----------------------------------------------------------------------------------------------------
let viewSaved = 0;
const preview = createPreview($<HTMLCanvasElement>('scene'), view, () => { clearTimeout(viewSaved); viewSaved = window.setTimeout(save, 300); });

/** The slot a shader takes its main picture from: _MainTex, else the first colour slot. */
function mainSlot(part: Part): string | undefined {
    const textures = profile()?.materials[part].textures ?? {};
    return '_MainTex' in textures ? '_MainTex' : Object.keys(textures).find(p => ['color', 'cutout'].includes(textureKind(p, part)));
}
function previewPictures(): void {
    const url = (part: Part) => { const slot = mainSlot(part), p = slot ? picks[part][slot] : undefined; return p && p !== 'none' ? p.url : null; };
    preview.setPictures(url('bark'), url('leaves'), CONIFERS.has(state.species));
}

function rebuild(): void {
    const t0 = performance.now();
    const sp = species(state.species);
    build = generateTree(state.params, { ...sp.materials, cti: false }, state.seed, presetLods(sp, state.preset));
    buildMs = performance.now() - t0;
    showLod();
}
function showLod(): void {
    if (!build) return;
    preview.show(build.lods[Math.min(state.lod, build.lods.length - 1)]!);
    const tris = build.lods.map(triangles);
    const leafPicture = (() => { const s = mainSlot('leaves'), p = s ? picks.leaves[s] : undefined; return p && p !== 'none'; })();
    $('stats').textContent = [
        `height     ${build.heightM.toFixed(1)} m`,
        `limbs      ${build.counts.limbs}   side ${build.counts.sides}   twigs ${build.counts.twigs}`,
        `cards      ${build.counts.cards}`,
        `triangles  ${tris.join(' / ')}`,
        `built in   ${buildMs.toFixed(0)} ms`,
        ...(leafPicture ? [] : [`${CONIFERS.has(state.species) ? 'needles' : 'leaves'}: a stand-in picture here; the pack's show in Unity`]),
    ].join('\n');
    $('panel').dataset.stats = JSON.stringify({ ...build.counts, heightM: build.heightM, triangles: tris });
}

let pending = false;
/** Something about the tree changed: rebuild on the next frame, and keep the address and storage up to date. */
function changed(): void {
    history.replaceState(null, '', toHash(settings(), modelInUse() ? model!.id : undefined));
    save();
    renderModels();
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; rebuild(); });
}

// ---- tree panel -------------------------------------------------------------------------------------------------
const speciesSel = $<HTMLSelectElement>('species'), presetSel = $<HTMLSelectElement>('preset'), seedIn = $<HTMLInputElement>('seed');
const lodSel = $<HTMLSelectElement>('lod');
for (const [id, sp] of Object.entries(SPECIES)) speciesSel.add(new Option(sp.name, id));

const sliders: { path: string; input: HTMLInputElement; out: HTMLElement }[] = [];
for (const group of TREE_CONTROL_GROUPS) {
    const box = el('details', { className: 'group' }, el('summary', {}, group.title));
    for (const c of group.controls) {
        const input = el('input', { type: 'range', min: String(c.min), max: String(c.max), step: String(c.step) }) as HTMLInputElement;
        input.dataset.param = c.path;
        const out = el('span', { className: 'value' });
        input.oninput = () => { writeParam(state.params, c.path, Number(input.value)); out.textContent = input.value; changed(); };
        box.append(el('label', { className: 'row', title: c.hint }, el('span', { className: 'label' }, c.label), input, out));
        sliders.push({ path: c.path, input, out });
    }
    $('sliders').append(box);
}

function refreshTreePanel(): void {
    speciesSel.value = state.species;
    presetSel.replaceChildren(...Object.keys(species(state.species).presets).map(p => new Option(p, p)));
    presetSel.value = state.preset;
    seedIn.value = String(state.seed);
    lodSel.value = String(state.lod);
    for (const { path, input, out } of sliders) {
        const v = readParam(state.params, path);
        input.value = String(v);
        out.textContent = String(Number(v.toFixed(2)));
    }
}

speciesSel.onchange = () => {
    state.species = speciesSel.value;
    state.preset = Object.keys(species(state.species).presets)[0]!;
    state.params = presetParams(state.species, state.preset);
    custom = null;
    $<HTMLInputElement>('profile-file').value = '';
    picks = speciesPicks();
    refreshAll();
    frameTree();
};
presetSel.onchange = () => {
    state.preset = presetSel.value;
    state.params = presetParams(state.species, state.preset);
    refreshTreePanel();
    changed();
    frameTree();
};
seedIn.oninput = () => { state.seed = Math.max(1, Math.floor(Number(seedIn.value) || 1)); changed(); };
$('another').onclick = () => { state.seed += 1; seedIn.value = String(state.seed); changed(); };
lodSel.onchange = () => { state.lod = Number(lodSel.value); save(); showLod(); };
$('reset').onclick = () => { state.params = presetParams(state.species, state.preset); refreshTreePanel(); changed(); };
$('copy-link').onclick = async () => {
    try { await navigator.clipboard.writeText(location.href); $('link-status').textContent = 'copied'; }
    catch { $('link-status').textContent = 'copy the address bar'; }
    setTimeout(() => { $('link-status').textContent = ''; }, 1500);
};

/** Frame the whole tree once it is built. */
function frameTree(): void {
    requestAnimationFrame(() => requestAnimationFrame(() => { if (build) preview.frame(build.heightM, reach(build)); }));
}
/** How far the tree reaches from its stem, metres. */
function reach(b: TreeBuild): number {
    const p = b.lods[b.lods.length - 1]!.positions;
    let r = 0;
    for (let i = 0; i < p.length; i += 3) r = Math.max(r, Math.hypot(p[i]!, p[i + 1]!));
    return r;
}

// ---- shader and textures ----------------------------------------------------------------------------------------
function renderSlots(): void {
    const p = profile();
    const label = $('profile-label');
    if (!p) { label.textContent = 'no profile in the catalogue for this species: load your own'; $('slots').replaceChildren(); return; }
    label.textContent = custom ? `${p.label} (${custom.from === 'model' ? `from ${model?.name}` : 'your file'})` : p.label;
    const rows: HTMLElement[] = [];
    for (const part of PARTS) {
        const recipe = p.materials[part];
        rows.push(el('tr', {}, el('th', { colSpan: 2 }, `${part}: ${recipe.shader.name ?? recipe.shader.guid}`)));
        for (const [prop, ref] of Object.entries(recipe.textures)) {
            if (/^_texcoord/.test(prop)) continue;
            const need = p.needs?.find(n => n.part === part && n.property === prop);
            const pick = picks[part][prop];
            const state = pick === 'none' ? el('span', { className: 'muted' }, 'left empty')
                : pick ? el('span', { className: 'own' }, `${pick.from === 'user' ? 'yours' : pick.from === 'model' ? 'shared model' : 'drawn atlas'}: ${pick.fileName} (${pick.kind})`)
                : ref ? el('span', { className: 'muted' }, `pack: ${ref.name ?? ref.guid}`)
                : need ? el('span', { className: 'need' }, `needed: ${need.what}`)
                : el('span', { className: 'muted' }, 'empty');
            const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,.tga,.tif,.tiff,.psd,.exr' }) as HTMLInputElement;
            file.dataset.slot = `${part}.${prop}`;
            const kind = el('select') as HTMLSelectElement;
            for (const k of ['color', 'cutout', 'normal', 'linear'] as TextureKind[]) kind.add(new Option(k, k));
            kind.value = pick && pick !== 'none' ? pick.kind : textureKind(prop, part);
            file.onchange = async () => {
                const f = file.files?.[0];
                if (!f) return;
                const bytes = new Uint8Array(await f.arrayBuffer());
                picks[part][prop] = { fileName: f.name, bytes, kind: kind.value as TextureKind, from: 'user', url: URL.createObjectURL(f) };
                refreshAll();
            };
            kind.onchange = () => { const cur = picks[part][prop]; if (cur && cur !== 'none') { cur.kind = kind.value as TextureKind; renderSlots(); } };
            const reset = el('button', { type: 'button', title: 'Back to the profile' }, 'reset');
            reset.onclick = () => { delete picks[part][prop]; refreshAll(); };
            const empty = el('button', { type: 'button', title: 'No picture in this slot' }, 'empty');
            empty.onclick = () => { picks[part][prop] = 'none'; refreshAll(); };
            rows.push(el('tr', {}, el('td', { className: 'prop' }, prop), el('td', {}, state, el('div', { className: 'slot-actions' }, file, kind, reset, empty))));
        }
    }
    $('slots').replaceChildren(el('table', {}, ...rows));
}

$<HTMLInputElement>('profile-file').onchange = async () => {
    const f = $<HTMLInputElement>('profile-file').files?.[0];
    if (!f) return;
    try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const p: unknown = JSON.parse(new TextDecoder().decode(bytes));
        const problems = checkProfile(p);
        if (problems.length) throw Error(problems.join('; '));
        custom = { profile: p as ShaderProfile, from: 'user', bytes };
        picks = { bark: {}, leaves: {} };
        refreshAll();
    } catch (e) { $('status').textContent = `Not a profile: ${e instanceof Error ? e.message : e}`; }
};

// ---- shared models ----------------------------------------------------------------------------------------------
const fileUrl = (entry: ModelIndexEntry, file: string) => new URL(`models/${entry.id}/${file}`, MODELS_URL).href;

function renderModels(): void {
    const list = $('models');
    const current = modelShown() ? model : null;
    $('model-current').replaceChildren(...(current ? [
        el('span', { className: 'own' }, `${current.name} by ${current.author}, ${MODEL_LICENSES[current.license].name}`),
        ...(modelInUse() ? [Object.assign(el('button', { type: 'button', title: 'Drop the model\'s pictures and profile' }, 'Drop its pictures'),
            { onclick: () => { clearModel(); } })] : []),
    ] : []));
    if (!index.length) return;
    list.replaceChildren(...index.map(entry => {
        const thumb = entry.preview ? el('img', { src: fileUrl(entry, entry.preview), alt: '', loading: 'lazy' }) : el('span', { className: 'thumb' });
        const b = el('button', { type: 'button', className: `model${current?.id === entry.id ? ' current' : ''}`, title: entry.description ?? '' },
            thumb, el('span', {}, entry.name, el('small', {}, `${entry.author} · ${MODEL_LICENSES[entry.license].name} · ${species(entry.tree.species).name}`)));
        b.dataset.model = entry.id;
        b.onclick = () => { void loadModel(entry); };
        return b;
    }));
}

async function loadIndex(): Promise<void> {
    try {
        const r = await fetch(new URL('index.json', MODELS_URL), { cache: 'no-cache' });
        if (!r.ok) throw Error(`${r.status}`);
        index = ((await r.json()) as ModelIndex).models.filter(m => SPECIES[m.tree.species]?.presets[m.tree.preset]);
        if (!index.length) $('models').replaceChildren(el('span', { className: 'muted' }, 'No shared models yet. Be the first: see "Share this tree".'));
        renderModels();
    } catch (e) {
        $('models').replaceChildren(el('span', { className: 'error' }, `Could not load the shared models (${(e as Error).message}).`));
    }
}

/** A shared model's tree, pictures and profile; `keep` keeps settings from a link that came with it. */
async function loadModel(entry: ModelIndexEntry, keep?: TreeExportSettings): Promise<void> {
    $('model-current').replaceChildren(el('span', { className: 'muted' }, `loading ${entry.name}...`));
    try {
        applySettings(keep ?? entry.tree);
        custom = null;
        if (entry.profile) {
            const bytes = new Uint8Array(await (await fetch(fileUrl(entry, entry.profile))).arrayBuffer());
            custom = { profile: JSON.parse(new TextDecoder().decode(bytes)) as ShaderProfile, from: 'model', bytes };
        }
        picks = custom ? { bark: {}, leaves: {} } : speciesPicks();
        for (const [slot, value] of Object.entries(entry.textures ?? {})) {
            const [part, prop] = slot.split('.') as [Part, string];
            const t = textureFile(value);
            picks[part][prop] = { fileName: t.file, kind: t.kind ?? textureKind(prop, part), from: 'model', url: fileUrl(entry, t.file) };
        }
        model = entry;
        refreshAll();
        frameTree();
    } catch (e) {
        $('model-current').replaceChildren(el('span', { className: 'error' }, `Could not load ${entry.name}: ${(e as Error).message}`));
    }
}

function clearModel(): void {
    if (custom?.from === 'model') custom = null;
    for (const part of PARTS) for (const [prop, p] of Object.entries(picks[part])) if (p !== 'none' && p.from === 'model') delete picks[part][prop];
    if (!custom) { const base = speciesPicks(); for (const part of PARTS) picks[part] = { ...base[part], ...picks[part] }; }
    model = null;
    refreshAll();
}

// ---- the package ------------------------------------------------------------------------------------------------
const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let download: string | null = null;
const buildBtn = $<HTMLButtonElement>('build');

buildBtn.onclick = async () => {
    const p = profile();
    if (!p) return;
    buildBtn.disabled = true;
    $('status').textContent = 'building...';
    $('result').textContent = '';
    const t0 = performance.now();
    try {
        const textures: ExportRequest['textures'] = { bark: {}, leaves: {} };
        for (const part of PARTS) for (const [prop, pick] of Object.entries(picks[part]))
            textures[part]![prop] = pick === 'none' ? null : { fileName: pick.fileName, bytes: (await bytesOf(pick)).slice(), kind: pick.kind };
        const missing = (p.needs ?? []).filter(n => !picks[n.part][n.property]);
        const credits = modelInUse() ? creditsText(model!, `${location.origin}${location.pathname}#model=${model!.id}`) : undefined;
        worker.onmessage = (e: MessageEvent<ExportReply>) => {
            buildBtn.disabled = false;
            const r = e.data;
            if (!r.ok) { $('status').textContent = `failed: ${r.error}`; return; }
            if (download) URL.revokeObjectURL(download);
            download = URL.createObjectURL(new Blob([r.bytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
            const a = el('a', { href: download, download: r.filename }, `Download ${r.filename}`);
            a.dataset.testid = 'download';
            $('status').replaceChildren(a, ` ${Math.round(r.bytes.length / 1024)} kB in ${Math.round(performance.now() - t0)} ms`);
            $('result').textContent = [
                `generate ${r.ms.generate} ms, fbx ${r.ms.fbx} ms, materials + prefab + tar + gzip ${r.ms.package} ms`,
                '', 'Assets:', ...r.paths.map(x => `  ${x}`),
                ...(missing.length ? ['', 'Still empty (bring a picture for these):', ...missing.map(n => `  ${n.part}.${n.property}: ${n.what}`)] : []),
            ].join('\n');
        };
        worker.postMessage({ ...settings(), prefab: $<HTMLInputElement>('prefab').checked, profile: p, textures, credits } satisfies ExportRequest);
    } catch (e) {
        buildBtn.disabled = false;
        $('status').textContent = `failed: ${(e as Error).message}`;
    }
};

// ---- share as a pull request ------------------------------------------------------------------------------------
const licenseSel = $<HTMLSelectElement>('share-license');
for (const [id, l] of Object.entries(MODEL_LICENSES)) licenseSel.add(new Option(l.name, id));
const repoLink = $<HTMLAnchorElement>('models-repo');
repoLink.href = `https://github.com/${MODELS_REPO}`;
repoLink.textContent = MODELS_REPO;
const SHARE_KEY = 'tree-tool-share';
try {
    const saved = JSON.parse(localStorage.getItem(SHARE_KEY) ?? '{}') as { author?: string; license?: string };
    if (saved.author) $<HTMLInputElement>('share-author').value = saved.author;
    if (saved.license && saved.license in MODEL_LICENSES) licenseSel.value = saved.license;
} catch { /* defaults */ }

function downloadButton(name: string, bytes: Uint8Array | Blob, type: string): HTMLElement {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes as Uint8Array<ArrayBuffer>], { type });
    const a = el('a', { href: URL.createObjectURL(blob), download: name }, name);
    a.dataset.testid = `share-file-${name}`;
    return a;
}

$('share-check').onclick = async () => {
    const out = $('share-result');
    const name = $<HTMLInputElement>('share-name').value.trim(), author = $<HTMLInputElement>('share-author').value.trim();
    const license = licenseSel.value as ModelLicense, source = $<HTMLInputElement>('share-source').value.trim();
    const description = $<HTMLTextAreaElement>('share-description').value.trim();
    try { localStorage.setItem(SHARE_KEY, JSON.stringify({ author, license })); } catch { /* ignore */ }
    const id = modelSlug(name);
    const problems: string[] = [];
    if (!name) problems.push('Give the tree a name.');
    if (index.some(m => m.id === id)) problems.push(`A shared model is already called "${id}": choose another name.`);

    const files: Record<string, Uint8Array> = {};
    const textures: Record<string, { file: string; kind: TextureKind }> = {};
    const left: string[] = [];
    for (const part of PARTS) for (const [prop, pick] of Object.entries(picks[part])) {
        if (pick === 'none' || pick.from === 'atlas') continue;
        if (pick.from === 'model') { left.push(`${part}.${prop} (${pick.fileName} belongs to ${model?.name})`); continue; }
        const file = pick.fileName.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[-.]+/, '');
        if (!/\.(png|jpe?g)$/i.test(file)) { problems.push(`${pick.fileName}: shared models take PNG or JPEG pictures.`); continue; }
        if (files[file]) { problems.push(`Two slots use ${file}: shared models need one name per picture.`); continue; }
        files[file] = await bytesOf(pick);
        textures[`${part}.${prop}`] = { file, kind: pick.kind };
    }
    const m: SharedModel = { name, ...(description ? { description } : {}), author, license, ...(source ? { source } : {}), tree: settings() };
    if (Object.keys(textures).length) m.textures = textures;
    if (custom?.from === 'user') { m.profile = 'profile.json'; files['profile.json'] = custom.bytes; }
    else if (custom?.from === 'model') left.push(`the shader profile (it belongs to ${model?.name})`);
    const json = JSON.stringify(m, null, 2) + '\n';
    files['model.json'] = new TextEncoder().encode(json);
    const preview = await previewPicture();
    files['preview.png'] = new Uint8Array(await preview.arrayBuffer());
    const check = checkModel(id || 'unnamed', files);
    problems.push(...check.errors.map(e => e.charAt(0).toUpperCase() + e.slice(1) + '.'));
    if (problems.length) {
        out.replaceChildren(el('p', { className: 'error' }, 'Not ready yet:'), el('ul', {}, ...problems.map(p => el('li', { className: 'error' }, p))));
        return;
    }
    const folder = `models/${id}`;
    const others = Object.keys(files).filter(f => f !== 'model.json' && f !== 'preview.png');
    const upload = `https://github.com/${MODELS_REPO}/upload/main/${folder}`;
    const quick = `https://github.com/${MODELS_REPO}/new/main?filename=${encodeURIComponent(`${folder}/model.json`)}&value=${encodeURIComponent(json)}`;
    out.replaceChildren(
        el('p', { className: 'own' }, `Ready: ${folder} passes the check its pull request will run.`),
        ...(left.length ? [el('p', { className: 'muted' }, `Left out (they stay in their own shared model): ${left.join(', ')}.`)] : []),
        el('ol', { className: 'steps' },
            el('li', {}, 'Download the files: ', ...Object.entries(files).flatMap(([f, b], i) => [i ? ', ' : '', downloadButton(f, f === 'preview.png' ? preview : b, f.endsWith('.json') ? 'application/json' : 'image/png')])),
            el('li', {}, el('a', { href: upload, target: '_blank', rel: 'noopener' }, `Open the upload page for ${folder}`),
                ' on GitHub (sign in there), drop all the files on it, and choose "Propose changes". GitHub makes your copy of the repo and opens the pull request.'),
            el('li', {}, 'A maintainer checks it and merges it; then it is in the list above for everyone.')),
        ...(others.length ? [] : [el('p', { className: 'muted' }, 'No pictures of your own: you can also ',
            el('a', { href: quick, target: '_blank', rel: 'noopener' }, 'open model.json on GitHub'), ' already filled in, and add preview.png afterwards.')]),
    );
};

/** The tree from the front, framed: the model's preview.png. */
async function previewPicture(): Promise<Blob> {
    const saved = { ...view };
    if (build) preview.frame(build.heightM, reach(build));
    view.yawDeg = 20;
    try { return await preview.snapshot(768); } finally { Object.assign(view, saved); }
}

// ---- start --------------------------------------------------------------------------------------------------------
function refreshAll(): void {
    refreshTreePanel();
    renderSlots();
    previewPictures();
    renderModels();
    changed();
}

async function start(): Promise<void> {
    let stored: (Partial<TreeExportSettings> & { lod?: number; view?: View; model?: string }) | null = null;
    try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); } catch { /* none */ }
    const link = fromHash(location.hash);
    if (link.error) $('link-status').textContent = `the link's tree: ${link.error}`;
    const fromLink = link.settings || link.model;
    if (stored?.view && !fromLink) Object.assign(view, stored.view);
    if (stored?.lod !== undefined) state.lod = stored.lod;
    const wanted = fromLink ? link.settings : (() => { try { return stored?.species ? fromHash(toHash(stored as TreeExportSettings)).settings : undefined; } catch { return undefined; } })();
    if (wanted) applySettings(wanted);
    picks = speciesPicks();
    refreshAll();
    if (fromLink || !stored?.view) frameTree();
    await loadIndex();
    const modelId = fromLink ? link.model : stored?.model;
    const entry = modelId ? index.find(m => m.id === modelId) : undefined;
    if (entry) await loadModel(entry, wanted);
    else if (modelId && fromLink) $('link-status').textContent = `the shared model "${modelId}" is not in the list`;
}
void start();
// For tests and for looking from the console.
(window as unknown as { __tree: unknown }).__tree = { state, settings, get build() { return build; }, get model() { return model; }, treeId: () => treeId(settings()) };
