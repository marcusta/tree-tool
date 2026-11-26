// Shared models (the tree-tool-models repo): a tree's settings, plus pictures and a shader profile of its own, each
// under a licence that allows passing the files on. `checkModel` is the check a pull request to that repo must pass;
// the app reads the index the repo publishes and builds a model's tree with its pictures in the package.
import { exportSettings, type TreeExportSettings } from './export-settings';
import { NM_CATALOGUE } from './export/catalogue/nm';
import type { ShaderProfile } from './export/profiles';
import type { TextureKind } from './export/unity-package';

/** The licences a shared model may carry: each allows passing the files on, changed, also in work that is sold. */
export const MODEL_LICENSES = {
    'CC0-1.0': { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: false },
    'CC-BY-4.0': { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/', attribution: true },
    'CC-BY-SA-4.0': { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: true },
} as const;
export type ModelLicense = keyof typeof MODEL_LICENSES;

export interface ModelTexture { file: string; kind?: TextureKind }

/** models/<id>/model.json */
export interface SharedModel {
    name: string;
    description?: string;
    author: string;
    license: ModelLicense;
    /** Where the pictures come from (required for CC BY and CC BY-SA). */
    source?: string;
    tree: TreeExportSettings;
    /** `<bark|leaves>.<shader property>` -> a picture in the model's folder. */
    textures?: Record<string, string | ModelTexture>;
    /** A shader profile JSON in the model's folder, in place of the catalogue's for the species. */
    profile?: string;
}

/** One model in the published index.json; file names are relative to `models/<id>/` beside the index. */
export interface ModelIndexEntry extends SharedModel { id: string; preview?: string }
export interface ModelIndex { version: 1; models: ModelIndexEntry[] }

export const MODEL_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MODEL_LIMITS = { texturePx: 2048, previewPx: 1024, fileBytes: 10 * 1024 * 1024 };
const TEXTURE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(png|jpe?g)$/i;
const SLOT = /^(bark|leaves)\.([A-Za-z_][A-Za-z0-9_]*)$/;

/** A model id from a name: lower case, digits and dashes. */
export const modelSlug = (name: string): string =>
    name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Width and height from a PNG or JPEG header, or null for anything else. */
export function imageSize(bytes: Uint8Array): { type: 'png' | 'jpeg'; width: number; height: number } | null {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a)
        return { type: 'png', width: view.getUint32(16), height: view.getUint32(20) };
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let at = 2;
    while (at + 9 < bytes.length) {
        if (bytes[at] !== 0xff) return null;
        const marker = bytes[at + 1]!;
        if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { at += 2; continue; }
        const length = view.getUint16(at + 2);
        // start of frame (baseline, progressive ...), not DHT (c4), JPG (c8) or DAC (cc)
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
            return { type: 'jpeg', height: view.getUint16(at + 5), width: view.getUint16(at + 7) };
        at += 2 + length;
    }
    return null;
}

const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0;

/** The texture slot's file and import kind. */
export const textureFile = (t: string | ModelTexture): ModelTexture => typeof t === 'string' ? { file: t } : t;

/** Is this a shader profile the package writer can use? Errors in plain words, empty when it is. */
export function checkProfile(p: unknown): string[] {
    if (!record(p)) return ['the profile is not a JSON object'];
    const errors: string[] = [];
    if (!text(p.id) || !text(p.label)) errors.push('the profile needs an id and a label');
    if (p.channels !== 'nm') errors.push(`the profile's channels must be "nm" (others are not written yet)`);
    if (!record(p.materials)) return [...errors, 'the profile has no materials'];
    for (const part of ['bark', 'leaves']) {
        const m = p.materials[part];
        if (!record(m) || !record(m.shader) || typeof m.shader.guid !== 'string' || !/^[0-9a-f]{32}$/.test(m.shader.guid))
            errors.push(`the profile's ${part} material needs a shader with a 32-digit guid`);
        else if (!record(m.textures) || !record(m.floats) || !record(m.colors) || typeof m.keywords !== 'string' || typeof m.renderQueue !== 'number')
            errors.push(`the profile's ${part} material needs keywords, renderQueue, textures, floats and colors`);
    }
    return errors;
}

/**
 * Checks one model folder: `files` is every file in models/<id>/ by name. Returns the model when there are no errors.
 * Every file must be used by the model, so nothing unlisted (and unlicensed) rides along.
 */
export function checkModel(id: string, files: Record<string, Uint8Array>): { model?: SharedModel; errors: string[] } {
    const errors: string[] = [];
    if (!MODEL_ID.test(id)) errors.push(`the folder name '${id}' must be lower case letters, digits and single dashes`);
    const raw = files['model.json'];
    if (!raw) return { errors: [...errors, 'model.json is missing'] };
    let m: unknown;
    try { m = JSON.parse(new TextDecoder().decode(raw)); } catch (e) { return { errors: [...errors, `model.json is not JSON: ${(e as Error).message}`] }; }
    if (!record(m)) return { errors: [...errors, 'model.json must be an object'] };

    if (!text(m.name)) errors.push('name is missing');
    if (!text(m.author)) errors.push('author is missing');
    if (m.description !== undefined && typeof m.description !== 'string') errors.push('description must be text');
    const license = MODEL_LICENSES[m.license as ModelLicense];
    if (!license) errors.push(`license must be one of ${Object.keys(MODEL_LICENSES).join(', ')} (see the README: the licence must allow passing the files on)`);
    if (m.source !== undefined && (typeof m.source !== 'string' || !/^https?:\/\/\S+$/.test(m.source))) errors.push('source must be a web address');
    if (license?.attribution && !text(m.source)) errors.push(`${license.name} needs a source: where the pictures come from`);

    let tree: TreeExportSettings | undefined;
    try { tree = exportSettings(m.tree); } catch (e) { errors.push(`tree: ${(e as Error).message}`); }

    const used = new Set(['model.json', 'preview.png']);
    let profile: ShaderProfile | undefined;
    if (m.profile !== undefined) {
        if (typeof m.profile !== 'string' || !/^[A-Za-z0-9._-]+\.json$/.test(m.profile) || !files[m.profile]) errors.push('profile must name a .json file in the folder');
        else {
            used.add(m.profile);
            try {
                const p: unknown = JSON.parse(new TextDecoder().decode(files[m.profile]));
                const problems = checkProfile(p);
                errors.push(...problems);
                if (!problems.length) profile = p as ShaderProfile;
            } catch (e) { errors.push(`${m.profile} is not JSON: ${(e as Error).message}`); }
        }
    } else if (tree) profile = NM_CATALOGUE[tree.species];

    if (m.textures !== undefined) {
        if (!record(m.textures)) errors.push('textures must map a slot to a file');
        else for (const [slot, value] of Object.entries(m.textures)) {
            const match = SLOT.exec(slot);
            const t = typeof value === 'string' ? { file: value } : record(value) ? value as unknown as ModelTexture : null;
            if (!match || !t) { errors.push(`textures: '${slot}' must be "bark.<property>" or "leaves.<property>" naming a file`); continue; }
            if (profile && !(match[2]! in profile.materials[match[1] as 'bark' | 'leaves'].textures))
                errors.push(`textures: the ${match[1]} shader has no slot ${match[2]}`);
            if (t.kind !== undefined && !['color', 'cutout', 'normal', 'linear'].includes(t.kind)) errors.push(`textures: ${slot} kind must be color, cutout, normal or linear`);
            if (typeof t.file !== 'string' || !TEXTURE_FILE.test(t.file)) { errors.push(`textures: ${slot} must name a .png or .jpg file`); continue; }
            if (!files[t.file]) { errors.push(`textures: ${t.file} is not in the folder`); continue; }
            used.add(t.file);
            const size = imageSize(files[t.file]!);
            if (!size || (size.type === 'png') !== /\.png$/i.test(t.file)) errors.push(`${t.file} is not a PNG or JPEG picture as its name says`);
            else if (size.width > MODEL_LIMITS.texturePx || size.height > MODEL_LIMITS.texturePx)
                errors.push(`${t.file} is ${size.width} x ${size.height} px; at most ${MODEL_LIMITS.texturePx}`);
        }
    }
    if (!profile && tree) errors.push(`no shader profile for ${tree.species} in the catalogue: add a profile`);

    if (files['preview.png']) {
        const size = imageSize(files['preview.png']);
        if (size?.type !== 'png') errors.push('preview.png is not a PNG picture');
        else if (size.width > MODEL_LIMITS.previewPx || size.height > MODEL_LIMITS.previewPx)
            errors.push(`preview.png is ${size.width} x ${size.height} px; at most ${MODEL_LIMITS.previewPx}`);
    }
    for (const [name, bytes] of Object.entries(files)) {
        if (!used.has(name)) errors.push(`${name} is not used by model.json: remove it, or name it under textures or profile`);
        if (bytes.length > MODEL_LIMITS.fileBytes) errors.push(`${name} is over ${MODEL_LIMITS.fileBytes / 1024 / 1024} MB`);
    }
    if (errors.length) return { errors };
    const out: SharedModel = { name: (m.name as string).trim(), author: (m.author as string).trim(), license: m.license as ModelLicense, tree: tree! };
    if (text(m.description)) out.description = m.description.trim();
    if (text(m.source)) out.source = m.source;
    if (record(m.textures) && Object.keys(m.textures).length) out.textures = m.textures as SharedModel['textures'];
    if (typeof m.profile === 'string') out.profile = m.profile;
    return { model: out, errors };
}

/** The index entry the repo publishes for a checked model. */
export const indexEntry = (id: string, model: SharedModel, files: Record<string, Uint8Array>): ModelIndexEntry =>
    ({ id, ...model, ...(files['preview.png'] ? { preview: 'preview.png' } : {}) });

/** CREDITS.txt for a package that carries a model's pictures. */
export function creditsText(model: SharedModel, link?: string): string {
    const license = MODEL_LICENSES[model.license];
    return [
        `"${model.name}" by ${model.author}`,
        `Licence: ${license.name} (${license.url})`,
        ...(model.source ? [`Source: ${model.source}`] : []),
        ...(link ? [`Shared at: ${link}`] : []),
        '',
        'The tree was built with tree-tool. Its pictures and shader profile come under the licence above;',
        license.attribution ? 'keep this file with them, and credit the author where you show them.' : 'no credit is required.',
        '',
    ].join('\n');
}
