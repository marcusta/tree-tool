import type { TreeParams } from './generator';

/**
 * The tree editor's sliders: one per number of TreeParams worth turning by hand, grouped as the tree is built
 * (stem, main limbs, side branches, twigs, needles). `path` names the number inside TreeParams.
 */
export interface TreeControl {
    path: string;
    label: string;
    min: number;
    max: number;
    step: number;
    /** Shown as the slider's tooltip. */
    hint: string;
}

export const TREE_CONTROL_GROUPS: { title: string; controls: TreeControl[] }[] = [
    { title: 'Stem and crown', controls: [
        { path: 'heightM', label: 'Height', min: 0.5, max: 30, step: 0.5, hint: 'Stem height in metres; the top needles reach a little higher' },
        { path: 'trunkRadiusM', label: 'Stem radius', min: 0.02, max: 1.2, step: 0.01, hint: 'Radius at breast height, metres' },
        { path: 'crownBase', label: 'Crown starts', min: 0, max: 0.8, step: 0.01, hint: 'Where the lowest limb leaves the stem, as a part of the height' },
        { path: 'crownRadiusM', label: 'Crown radius', min: 0.3, max: 18, step: 0.1, hint: 'Length of the longest limbs, metres' },
        { path: 'crownSlopeDeg', label: 'Crown slope', min: -25, max: 30, step: 1, hint: 'Rise of a spreading crown towards the leaning side, degrees' },
        { path: 'stemEndsAt', label: 'Stem ends', min: 0.1, max: 1, step: 0.01, hint: 'Where the stem gives way to its limbs, as a part of the height (1 = a stem right through the crown)' },
        { path: 'leanDeg', label: 'Lean', min: 0, max: 35, step: 1, hint: 'How far the stem leans, degrees' },
        { path: 'wobbleM', label: 'Stem wander', min: 0, max: 1.5, step: 0.05, hint: 'How far the stem wanders sideways towards its top, metres' },
        { path: 'skipWhorls', label: 'Skip low limbs', min: 0, max: 8, step: 1, hint: 'The same tree without its lowest limb nodes' },
        { path: 'stubs', label: 'Dead stubs', min: 0, max: 12, step: 1, hint: 'Broken-off stubs on the bare stem' },
    ] },
    { title: 'Main limbs', controls: [
        { path: 'limbs.windBias', label: 'Wind bias', min: 0, max: 0.8, step: 0.05, hint: 'Longer limbs on the leaning side of the stem and shorter limbs on the exposed side' },
        { path: 'limbs.spacingBottomM', label: 'Gap, low', min: 0.3, max: 4, step: 0.05, hint: 'Height between limbs at the crown\'s base, metres' },
        { path: 'limbs.spacingTopM', label: 'Gap, top', min: 0.2, max: 3, step: 0.05, hint: 'Height between limbs at the top, metres' },
        { path: 'limbs.spacingJitter', label: 'Gap spread', min: 0, max: 0.9, step: 0.05, hint: 'How uneven the gaps are' },
        { path: 'limbs.topAt', label: 'Last limb at', min: 0.1, max: 0.98, step: 0.01, hint: 'The part of the height where the last limb leaves the stem' },
        { path: 'limbs.elevBottomDeg', label: 'Angle, low', min: -30, max: 80, step: 1, hint: 'Angle above level where the lowest limbs leave the stem' },
        { path: 'limbs.elevTopDeg', label: 'Angle, top', min: 0, max: 89, step: 1, hint: 'Angle above level where the top limbs leave the stem' },
        { path: 'limbs.elevJitterDeg', label: 'Angle spread', min: 0, max: 30, step: 1, hint: 'How much each limb\'s angle differs from the rule' },
        { path: 'limbs.sagBottom', label: 'Sag, low', min: 0, max: 1.5, step: 0.05, hint: 'How much the lowest limbs bend down mid-way' },
        { path: 'limbs.sagTop', label: 'Sag, top', min: 0, max: 1.5, step: 0.05, hint: 'How much the top limbs bend down mid-way' },
        { path: 'limbs.upturnBottom', label: 'Upturn, low', min: -3, max: 2, step: 0.05, hint: 'How much the lowest limbs\' tips turn up (below 0 = they fall)' },
        { path: 'limbs.upturnTop', label: 'Upturn, top', min: -3, max: 2, step: 0.05, hint: 'How much the top limbs\' tips turn up (below 0 = they fall)' },
        { path: 'limbs.crooked', label: 'Crooked', min: 0, max: 1, step: 0.05, hint: 'How crooked the thin outer part of a limb is' },
        { path: 'limbs.topLength', label: 'Top limbs', min: 0.02, max: 1.6, step: 0.02, hint: 'Length of the top limbs as a part of the crown radius: small = a crown that narrows upwards' },
        { path: 'limbs.taper', label: 'Narrows', min: 0.5, max: 4, step: 0.1, hint: 'How the crown narrows towards the top limbs: 1 = a straight cone, high = wide until near the top' },
        { path: 'limbs.minLengthM', label: 'Shortest limb', min: 0.2, max: 4, step: 0.1, hint: 'No limb is shorter than this, for a 16 m tree, metres' },
    ] },
    { title: 'Side branches', controls: [
        { path: 'sides.startAt', label: 'Start at', min: 0, max: 0.8, step: 0.01, hint: 'Where along a limb the first side branch leaves' },
        { path: 'sides.spacingMinM', label: 'Gap, least', min: 0.1, max: 2, step: 0.05, hint: 'Shortest distance between branching points, metres' },
        { path: 'sides.spacingMaxM', label: 'Gap, most', min: 0.2, max: 4, step: 0.05, hint: 'Longest distance between branching points, metres' },
        { path: 'sides.angleMinDeg', label: 'Angle, least', min: 5, max: 90, step: 1, hint: 'Smallest angle between a side branch and its limb' },
        { path: 'sides.angleMaxDeg', label: 'Angle, most', min: 5, max: 110, step: 1, hint: 'Largest angle between a side branch and its limb' },
        { path: 'sides.lengthMin', label: 'Length, least', min: 0.05, max: 1, step: 0.05, hint: 'Shortest side branch, as a part of its limb' },
        { path: 'sides.lengthMax', label: 'Length, most', min: 0.1, max: 1.5, step: 0.05, hint: 'Longest side branch, as a part of its limb' },
        { path: 'sides.upDown', label: 'Up and down', min: 0, max: 1, step: 0.05, hint: '0 = branches only spread sideways (flat layers), 1 = all the way round the limb' },
        { path: 'sides.crooked', label: 'Crooked', min: 0, max: 1, step: 0.05, hint: 'How crooked the side branches are' },
        { path: 'sides.droop', label: 'Droop', min: 0, max: 1, step: 0.05, hint: 'How much a side branch\'s outer part falls instead of turning up (a weeping birch)' },
    ] },
    { title: 'Twigs and needles', controls: [
        { path: 'twigs.perM', label: 'Twigs per m', min: 0.5, max: 8, step: 0.1, hint: 'Most twigs a side branch carries per metre' },
        { path: 'twigs.lengthMinM', label: 'Twig, shortest', min: 0.1, max: 1.5, step: 0.05, hint: 'Shortest twig, metres' },
        { path: 'twigs.lengthMaxM', label: 'Twig, longest', min: 0.2, max: 2.5, step: 0.05, hint: 'Longest twig, metres' },
        { path: 'needles.sizeM', label: 'Needle tuft', min: 0.4, max: 6, step: 0.05, hint: 'Size of a needle card at a twig\'s tip, metres' },
        { path: 'needles.upward', label: 'Tufts rise', min: 0, max: 1, step: 0.05, hint: '0 = a tuft follows its branch, 1 = it stands up' },
        { path: 'needles.scatter', label: 'Tufts spread', min: 0, max: 1.5, step: 0.05, hint: 'How far the tufts of one clump spread apart' },
        { path: 'needles.shrinkTop', label: 'Smaller on short limbs', min: 0, max: 0.95, step: 0.05, hint: 'How much the tufts shrink on limbs shorter than the crown radius (a pointed top)' },
        { path: 'needles.outward', label: 'Tufts point out', min: 0, max: 2, step: 0.05, hint: 'How much a tuft points away from the middle of the crown instead of along its branch (a round, even crown)' },
        { path: 'needles.ball', label: 'Ball crown', min: 0, max: 1.5, step: 0.05, hint: '0 = off. Above 0, no tuft starts outside a ball round the top of the stem, this part of the crown radius wide (an even dome)' },
        { path: 'needles.ballHeight', label: 'Ball height', min: 0.4, max: 2.5, step: 0.05, hint: 'The height of the ball as a part of its width: below 1 = a flat dome, above 1 = an egg' },
        { path: 'needles.ballBumps', label: 'Ball bosses', min: 0, max: 0.5, step: 0.02, hint: 'How deep the grooves are between the rounded bosses of the ball (a cauliflower crown); 0 = a smooth ball' },
        { path: 'needles.shell', label: 'Hollow inside', min: 0, max: 0.95, step: 0.05, hint: 'With a ball crown: no tufts nearer its middle than this part of its radius (nobody sees into a closed crown)' },
        { path: 'needles.shingle', label: 'Shingled', min: 0, max: 1, step: 0.05, hint: 'With a ball crown: 1 = the tufts lie over its surface like shingles instead of following their branches' },
        { path: 'needles.lobe', label: 'Lobes', min: 0, max: 1, step: 0.05, hint: '0 = off. Above 0, the tufts of each main limb stay in a ball of their own near its end, this part of the crown radius wide (a crown of rounded lobes)' },
        { path: 'needles.alongPerM', label: 'Strands per m', min: 0, max: 4, step: 0.1, hint: 'Hanging twigs only: strands hung per metre along the outer part of every limb and side branch' },
        { path: 'needles.hangTaper', label: 'Shorter at top', min: 0, max: 0.9, step: 0.05, hint: 'Hanging twigs only: how much shorter the strands are at the top of the crown' },
        { path: 'needles.hangReach', label: 'Strands arc out', min: 0, max: 1.2, step: 0.02, hint: 'Hanging twigs only: how far a strand goes out with its branch before it falls, as a part of its length' },
        { path: 'needles.hangDrop', label: 'Strands fall', min: -1, max: 1, step: 0.05, hint: 'Hanging twigs only: how far a strand ends below its base, as a part of its length (1 = it hangs, 0.4 = it stands out and nods, below 0 = a springy shoot that rises)' },
        { path: 'needles.innerShade', label: 'Dark inside', min: 0, max: 1, step: 0.05, hint: 'How much darker the leaves are towards the stem' },
        { path: 'needles.twigTip', label: 'Tufts per tip', min: 1, max: 8, step: 1, hint: 'Needle cards at each twig\'s tip' },
        { path: 'needles.twigMid', label: 'Tufts mid-twig', min: 0, max: 6, step: 1, hint: 'Needle cards half-way along each twig' },
        { path: 'needles.sideTip', label: 'Tufts, branch tip', min: 0, max: 10, step: 1, hint: 'Needle cards at each side branch\'s tip' },
        { path: 'needles.limbTip', label: 'Tufts, limb tip', min: 0, max: 12, step: 1, hint: 'Needle cards at each main limb\'s tip' },
    ] },
];

export function readParam(params: TreeParams, path: string): number {
    const value = path.split('.').reduce<unknown>((at, key) => (at as Record<string, unknown>)[key], params);
    if (typeof value !== 'number') throw Error(`${path} is not a number in TreeParams`);
    return value;
}

export function writeParam(params: TreeParams, path: string, value: number): void {
    const keys = path.split('.');
    const last = keys.pop()!;
    const holder = keys.reduce<unknown>((at, key) => (at as Record<string, unknown>)[key], params) as Record<string, unknown>;
    if (typeof holder[last] !== 'number') throw Error(`${path} is not a number in TreeParams`);
    holder[last] = value;
}

/** Only what differs from `base`, in TreeParams' own shape: what a preset in species.json holds when `base` is its species' defaults. */
export function presetOf(params: TreeParams, base: TreeParams): Record<string, unknown> {
    const diff = (a: unknown, b: unknown): unknown => {
        if (Array.isArray(a)) return JSON.stringify(a) === JSON.stringify(b) ? undefined : a;
        if (typeof a !== 'object' || a === null) return a === b ? undefined : a;
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(a)) {
            const d = diff((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]);
            if (d !== undefined) out[key] = d;
        }
        return Object.keys(out).length ? out : undefined;
    };
    return (diff(params, base) as Record<string, unknown> | undefined) ?? {};
}
