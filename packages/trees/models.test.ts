// What a shared model must be to come into tree-tool-models: the check its pull requests run.
import { expect, test } from 'bun:test';
import { checkModel, creditsText, imageSize, modelSlug } from './models';

const json = (x: unknown) => new TextEncoder().encode(JSON.stringify(x));

/** A PNG header (signature + IHDR) of the given size: enough for imageSize. */
function png(width: number, height: number): Uint8Array {
    const b = new Uint8Array(33);
    b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    const v = new DataView(b.buffer);
    v.setUint32(16, width);
    v.setUint32(20, height);
    return b;
}

/** A JPEG with an APP0 segment before its baseline frame header. */
function jpeg(width: number, height: number): Uint8Array {
    const b = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 0, 0, 0, 1, 1, 0x11, 0, 0xff, 0xd9]);
    const v = new DataView(b.buffer);
    v.setUint16(13, height);
    v.setUint16(15, width);
    return b;
}

const base = { name: 'Windswept pine', author: 'Someone', license: 'CC0-1.0', tree: { species: 'pine', preset: 'windswept', seed: 7, changes: { 'limbs.windBias': 0.6 } } };

test('a settings-only model passes and comes back as checked', () => {
    const r = checkModel('windswept-pine', { 'model.json': json(base) });
    expect(r.errors).toEqual([]);
    expect(r.model?.tree).toEqual(base.tree);
});

test('a licence that does not allow passing the files on is refused', () => {
    for (const license of ['CC-BY-NC-4.0', 'CC-BY-ND-4.0', 'Unity Asset Store EULA', undefined])
        expect(checkModel('m', { 'model.json': json({ ...base, license }) }).errors.join()).toContain('license must be one of');
});

test('CC BY needs a source; with one it passes', () => {
    expect(checkModel('m', { 'model.json': json({ ...base, license: 'CC-BY-4.0' }) }).errors.join()).toContain('needs a source');
    expect(checkModel('m', { 'model.json': json({ ...base, license: 'CC-BY-4.0', source: 'https://example.com/bark' }) }).errors).toEqual([]);
});

test('the tree must be one the app can build', () => {
    expect(checkModel('m', { 'model.json': json({ ...base, tree: { ...base.tree, species: 'palm' } }) }).errors.join()).toContain('Unknown tree species');
    expect(checkModel('m', { 'model.json': json({ ...base, tree: { ...base.tree, changes: { 'limbs.windBias': 9 } } }) }).errors.join()).toContain('Invalid tree setting');
});

test('pictures: named, in the folder, a real slot, at most 2048 px', () => {
    const model = { ...base, textures: { 'bark._MainTex': 'bark.png' } };
    expect(checkModel('m', { 'model.json': json(model), 'bark.png': png(1024, 1024) }).errors).toEqual([]);
    expect(checkModel('m', { 'model.json': json(model) }).errors.join()).toContain('bark.png is not in the folder');
    expect(checkModel('m', { 'model.json': json(model), 'bark.png': png(4096, 1024) }).errors.join()).toContain('at most 2048');
    expect(checkModel('m', { 'model.json': json(model), 'bark.png': jpeg(64, 64) }).errors.join()).toContain('not a PNG or JPEG picture as its name says');
    expect(checkModel('m', { 'model.json': json({ ...base, textures: { 'bark._Nope': 'bark.png' } }), 'bark.png': png(8, 8) }).errors.join()).toContain('has no slot _Nope');
});

test('a file the model does not use is refused, so nothing rides along', () => {
    expect(checkModel('m', { 'model.json': json(base), 'pack-texture.png': png(8, 8) }).errors.join()).toContain('pack-texture.png is not used');
    expect(checkModel('m', { 'model.json': json(base), 'preview.png': png(512, 512) }).errors).toEqual([]);
    expect(checkModel('m', { 'model.json': json(base), 'preview.png': png(2048, 2048) }).errors.join()).toContain('at most 1024');
});

test('the folder name is the id', () => {
    expect(checkModel('Windswept Pine', { 'model.json': json(base) }).errors.join()).toContain('folder name');
    expect(modelSlug('Vindpinad tall på Öland!')).toBe('vindpinad-tall-pa-oland');
});

test('image sizes from PNG and JPEG headers', () => {
    expect(imageSize(png(300, 200))).toEqual({ type: 'png', width: 300, height: 200 });
    expect(imageSize(jpeg(640, 480))).toEqual({ type: 'jpeg', width: 640, height: 480 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
});

test('credits name the author, the licence and the source', () => {
    const t = creditsText({ ...base, license: 'CC-BY-4.0', source: 'https://example.com/bark' } as never, 'https://example.com/#model=x');
    expect(t).toContain('"Windswept pine" by Someone');
    expect(t).toContain('CC BY 4.0');
    expect(t).toContain('https://example.com/bark');
});
