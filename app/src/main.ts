/**
 * Tree tool: a tree as a .unitypackage, built in the browser. Nothing goes to a server.
 * A species' shader profile comes from the catalogue (packages/trees/export/catalogue/: shader and texture GUIDs of the
 * pack the tree is made for, never a licensed byte); the package links those, so it resolves in a project that has
 * the pack. Any slot can take the user's own picture instead, packed into the package; slots the catalogue cannot link
 * (our own pictures) are marked as needed. A profile JSON of the same shape stands for a shader of one's own.
 */
import { SPECIES } from '@tree-tool/trees/species';
import type { ShaderProfile } from '@tree-tool/trees/export/profiles';
import { textureKind, type OwnTexture, type TextureKind } from '@tree-tool/trees/export/unity-package';
import { NM_CATALOGUE } from '@tree-tool/trees/export/catalogue/nm';
import type { ExportReply, ExportRequest } from './worker';

const profileFor = (species: string): ShaderProfile | undefined => NM_CATALOGUE[species];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const speciesSel = $<HTMLSelectElement>('species'), presetSel = $<HTMLSelectElement>('preset'), seedIn = $<HTMLInputElement>('seed');
const prefabIn = $<HTMLInputElement>('prefab'), profileFile = $<HTMLInputElement>('profile-file');
const slotsEl = $('slots'), profileLabel = $('profile-label'), statusEl = $('status'), resultEl = $('result');
const buildBtn = $<HTMLButtonElement>('build');

type Part = 'bark' | 'leaves';
/** The user's picks per part and property: a picture, or 'none' to leave the slot empty. */
let own: Record<Part, Record<string, OwnTexture | 'none'>> = { bark: {}, leaves: {} };
let custom: ShaderProfile | null = null;

for (const id of Object.keys(SPECIES)) speciesSel.add(new Option(id, id));
function fillPresets() {
    presetSel.replaceChildren(...Object.keys(SPECIES[speciesSel.value]!.presets).map(p => new Option(p, p)));
}

const profile = (): ShaderProfile | undefined => custom ?? profileFor(speciesSel.value);

function el(tag: string, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElement {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...kids);
    return e;
}

function renderSlots() {
    const p = profile();
    if (!p) { profileLabel.textContent = 'no profile in the catalogue for this species'; slotsEl.replaceChildren(); return; }
    profileLabel.textContent = custom ? `${p.label} (your file)` : p.label;
    const rows: HTMLElement[] = [];
    for (const part of ['bark', 'leaves'] as const) {
        const recipe = p.materials[part];
        rows.push(el('tr', {}, el('th', { colSpan: 3 }, `${part}: ${recipe.shader.name ?? recipe.shader.guid}`)));
        for (const [prop, ref] of Object.entries(recipe.textures)) {
            if (/^_texcoord/.test(prop)) continue;
            const need = p.needs?.find(n => n.part === part && n.property === prop);
            const pick = own[part][prop];
            const state = pick === 'none' ? el('span', { className: 'muted' }, 'left empty')
                : pick ? el('span', { className: 'own' }, `yours: ${pick.fileName} (${pick.kind})`)
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
                own[part][prop] = { fileName: f.name, bytes: new Uint8Array(await f.arrayBuffer()), kind: kind.value as TextureKind };
                renderSlots();
            };
            kind.onchange = () => { const cur = own[part][prop]; if (cur && cur !== 'none') { cur.kind = kind.value as TextureKind; renderSlots(); } };
            const reset = el('button', { type: 'button', title: 'Back to the profile' }, 'reset');
            reset.onclick = () => { delete own[part][prop]; renderSlots(); };
            const empty = el('button', { type: 'button', title: 'No picture in this slot' }, 'empty');
            empty.onclick = () => { own[part][prop] = 'none'; renderSlots(); };
            rows.push(el('tr', {}, el('td', { className: 'prop' }, prop), el('td', {}, state), el('td', {}, file, kind, reset, empty)));
        }
    }
    slotsEl.replaceChildren(el('table', {}, ...rows));
}

speciesSel.onchange = () => { fillPresets(); own = { bark: {}, leaves: {} }; custom = null; profileFile.value = ''; renderSlots(); };
profileFile.onchange = async () => {
    const f = profileFile.files?.[0];
    if (!f) return;
    try { custom = JSON.parse(await f.text()) as ShaderProfile; own = { bark: {}, leaves: {} }; renderSlots(); }
    catch (e) { statusEl.textContent = `Not a profile: ${e instanceof Error ? e.message : e}`; }
};

const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
let link: string | null = null;

buildBtn.onclick = () => {
    const p = profile();
    if (!p) return;
    const textures: ExportRequest['textures'] = {};
    for (const part of ['bark', 'leaves'] as const)
        textures[part] = Object.fromEntries(Object.entries(own[part]).map(([k, v]) => [k, v === 'none' ? null : v]));
    const missing = (p.needs ?? []).filter(n => !own[n.part][n.property]);
    buildBtn.disabled = true;
    statusEl.textContent = 'building...';
    resultEl.textContent = '';
    const t0 = performance.now();
    worker.onmessage = (e: MessageEvent<ExportReply>) => {
        buildBtn.disabled = false;
        const r = e.data;
        if (!r.ok) { statusEl.textContent = `failed: ${r.error}`; return; }
        if (link) URL.revokeObjectURL(link);
        link = URL.createObjectURL(new Blob([r.bytes as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }));
        const a = el('a', { href: link, download: r.filename }, `Download ${r.filename}`);
        a.dataset.testid = 'download';
        statusEl.replaceChildren(a, ` ${Math.round(r.bytes.length / 1024)} kB in ${Math.round(performance.now() - t0)} ms`);
        resultEl.textContent = [
            `generate ${r.ms.generate} ms, fbx ${r.ms.fbx} ms, materials + prefab + tar + gzip ${r.ms.package} ms`,
            '', 'Assets:', ...r.paths.map(x => `  ${x}`),
            ...(missing.length ? ['', 'Still empty (bring a picture for these):', ...missing.map(n => `  ${n.part}.${n.property}: ${n.what}`)] : []),
        ].join('\n');
    };
    worker.postMessage({ species: speciesSel.value, preset: presetSel.value, seed: Math.max(1, Number(seedIn.value) || 1), prefab: prefabIn.checked, profile: p, textures } satisfies ExportRequest);
};

fillPresets();
renderSlots();
