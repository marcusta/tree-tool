// The tree generator's promises to the NatureManufacture shaders and to the editor: same seed = same tree,
// bark never shivers, cards start still at their stem, bark faces point outwards, and skipWhorls takes limbs
// away without changing the ones that stay.
import { expect, test } from 'bun:test';
import { presetLods, presetParams, species } from './species';
import { DEFAULT_PARAMS, generateTree, triangles, type TreeMesh } from './generator';

const materials = species('pine').materials;
const full = presetParams('pine', 'full');

const vertex = (m: TreeMesh, i: number): [number, number, number] => [m.positions[i * 3]!, m.positions[i * 3 + 1]!, m.positions[i * 3 + 2]!];

test('a preset lies over the defaults and leaves them untouched', () => {
    const high = presetParams('pine', 'full-high');
    expect(high.skipWhorls).toBe(2);
    expect(high.limbs).toEqual(DEFAULT_PARAMS.limbs);
    high.limbs.perNode.push(9);
    expect(DEFAULT_PARAMS.limbs.perNode).toEqual([1, 1, 1, 2]);
});

test('the same seed builds the same tree, another seed another one', () => {
    const a = generateTree(full, materials, 7), b = generateTree(full, materials, 7), c = generateTree(full, materials, 8);
    expect(a.lods[0]!.positions).toEqual(b.lods[0]!.positions);
    expect(a.lods[0]!.positions).not.toEqual(c.lods[0]!.positions);
});

test('a full pine: few limbs, many twigs, lighter LODs, about its set height', () => {
    const tree = generateTree(full, materials, 1);
    expect(tree.counts.limbs).toBeGreaterThanOrEqual(8);
    expect(tree.counts.limbs).toBeLessThanOrEqual(16);
    expect(tree.counts.twigs).toBeGreaterThan(tree.counts.sides);
    const tris = tree.lods.map(triangles);
    expect(tris[0]!).toBeGreaterThan(tris[1]!);
    expect(tris[1]!).toBeGreaterThan(tris[2]!);
    expect(tree.heightM).toBeGreaterThan(full.heightM * 0.95);
    expect(tree.heightM).toBeLessThan(full.heightM * 1.25);
});

test('windswept pines leave the lower stem open and keep the trunk collider on its lean', () => {
    const params = presetParams('pine', 'windswept');
    for (const seed of [1, 7, 14]) {
        const tree = generateTree(params, materials, seed);
        const lod = tree.lods[0]!;
        const lowestNeedle = Math.min(...lod.leaves.map(i => lod.positions[3 * i + 2]!));
        expect(lowestNeedle).toBeGreaterThan(tree.heightM * 0.5);
        expect(Math.hypot(...tree.stem[0]!.point)).toBe(0);
        const stemHeight = params.heightM * params.stemEndsAt;
        expect(tree.stem.at(-1)!.point[2]).toBeCloseTo(stemHeight);
        const ringSize = 11; // the trunk's ten sides and the UV seam
        for (const sample of tree.stem) {
            const ring = Math.round(sample.point[2] / stemHeight * (Math.floor(stemHeight / 0.7) + 1));
            const v = vertex(lod, ring * ringSize);
            expect(Math.hypot(v[0] - sample.point[0], v[1] - sample.point[1], v[2] - sample.point[2])).toBeCloseTo(sample.radiusM);
        }
        expect(generateTree({ ...params, limbs: { ...params.limbs, windBias: 0 } }, materials, seed).lods[0]!.positions).not.toEqual(lod.positions);
    }
});

test('the veteran pine keeps its descending boughs, three-dimensional crown and 19 metre tip at every build', () => {
    const preset = presetParams('pine', 'veteran-slope');
    for (const seed of [1, 19]) {
        const tree = generateTree(preset, materials, seed);
        const mesh = tree.lods[0]!;
        const needles = [...new Set(mesh.leaves)].map(i => vertex(mesh, i));
        const low = needles.filter(p => p[2] < 0.32 * preset.heightM);
        expect(low.length).toBeGreaterThan(0);
        expect(low.every(p => p[0] < -preset.crownRadiusM * 0.45)).toBe(true);
        expect(Math.max(...needles.map(p => p[2]))).toBeCloseTo(19, 5);
        expect(Math.max(...needles.map(p => p[1])) - Math.min(...needles.map(p => p[1]))).toBeGreaterThan(8);
        expect(Math.hypot(...tree.stem[0]!.point)).toBe(0);
        const [near, middle, far] = tree.lods.map(triangles);
        expect(near!).toBeGreaterThan(middle!);
        expect(middle!).toBeGreaterThan(far!);
    }
});

test('bark is still in the wind, a needle card is still at its stem and shivers at its tip', () => {
    const mesh = generateTree(full, materials, 1).lods[0]!;
    for (const i of mesh.bark) expect(mesh.alpha[i]).toBe(0);
    const leafAlpha = mesh.leaves.map((i) => mesh.alpha[i]!);
    expect(Math.min(...leafAlpha)).toBe(0);
    expect(Math.max(...leafAlpha)).toBeCloseTo(0.28, 5);
});

test('the low oak fork and CTI leaf pivots follow the scaled wood and cards at every LOD', () => {
    const oak = species('oak');
    const tree = generateTree(presetParams('oak', 'estate'), { ...oak.materials, cti: true }, 18, presetLods(oak, 'estate'));
    const fork = tree.stem.find(s => s.startsFork)!;
    expect(fork.point[2]).toBeGreaterThan(1);
    expect(fork.point[2]).toBeLessThan(2);
    for (const mesh of tree.lods) {
        const pivots = mesh.cardPivots!;
        const start = mesh.leaves[0]!;
        const stride = (mesh.positions.length / 3 - start) / pivots.length;
        expect([4, 6]).toContain(stride);
        // The zero-wind row straddles the atlas attachment point on both oak sprites.
        for (let card = 0; card < pivots.length; card += 37) {
            const first = start + stride * card;
            const base = mesh.alpha[first] === 0 ? first : first + stride - 2;
            const u = mesh.uv[2 * base]!, v = mesh.uv[2 * base + 1]!;
            const sprite = oak.materials.sprites.find(s => s.rect[0] === u && s.base[1] === v)!;
            const fraction = (sprite.base[0] - u) / (sprite.rect[2] - u);
            for (let axis = 0; axis < 3; axis++) {
                const a = mesh.positions[3 * base + axis]!, b = mesh.positions[3 * (base + 1) + axis]!;
                expect(pivots[card]![axis]).toBeCloseTo(a + fraction * (b - a), 5);
            }
        }
    }
});

test('mesquite fork colliders start new chains and the leaning stems sit flat on the ground', () => {
    for (const [id, preset, seed] of [
        ['honey-mesquite', 'open-fork', 29], ['velvet-mesquite', 'leaning', 23], ['honey-mesquite', 'spreading', 23],
    ] as const) {
        const params = presetParams(id, preset), sp = species(id);
        const tree = generateTree(params, sp.materials, seed, sp.lods);
        expect(tree.stem.filter(p => p.startsFork).length).toBe(params.boughGuides.filter(g => g.colliderTo).length);
        tree.stem.forEach((sample, i) => {
            if (!sample.startsFork) return;
            const next = tree.stem[i + 1]!;
            expect(next.startsFork).toBeFalsy();
            expect(next.radiusM).toBeLessThan(sample.radiusM);
        });
        const z = tree.lods[0]!.positions.filter((_, i) => i % 3 === 2);
        expect(Math.min(...z)).toBeCloseTo(0, 5);
        expect(Math.max(...z)).toBeCloseTo(params.heightM, 5);
    }
});

test('the stem stands on the origin and its faces point outwards', () => {
    const mesh = generateTree(full, materials, 1).lods[0]!;
    // the first tube is the stem: its first triangle is at the foot
    const [a, b, c] = [mesh.bark[0]!, mesh.bark[1]!, mesh.bark[2]!].map((i) => vertex(mesh, i));
    expect(Math.abs(a![2])).toBeLessThan(0.01);   // the foot ring tilts a hair with the stem
    const e1 = [b![0] - a![0], b![1] - a![1], b![2] - a![2]], e2 = [c![0] - a![0], c![1] - a![1], c![2] - a![2]];
    const normal = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!];
    expect(normal[0]! * a![0] + normal[1]! * a![1]).toBeGreaterThan(0);
});

test('skipWhorls takes the lowest limbs away and keeps the rest as they were', () => {
    const whole = generateTree(full, materials, 3).lods[0]!;
    const high = generateTree({ ...full, skipWhorls: 2, stubs: full.stubs }, materials, 3).lods[0]!;
    expect(high.positions.length).toBeLessThan(whole.positions.length);
    // the last vertices are the crown's top cards, the same in both
    const tail = (m: TreeMesh) => m.positions.slice(-300);
    expect(tail(high)).toEqual(tail(whole));
});
