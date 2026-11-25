// Trees from parameters, for the web tree editor and the `trees` CLI alike: a stem, a few main limbs
// well apart, side branches leaving them at irregular nodes, twigs, and needle cards cut from a texture
// atlas. Inspired by ez-tree's per-level knobs (angle, children, length, gnarliness, a lifting force),
// with what it lacks for a Scots pine: every branch gets its own angle, turn and length, branches leave
// in nodes, limbs sag and turn up, and the crown starts part-way up the stem.
//
// Space: metres, z up, the stem's foot at the origin (the NatureManufacture wind bends a tree by the
// distance to its origin). What a mesh carries for the NM tree shaders:
//   alpha  the leaf shader's shiver mask (0 = still): 0 on all bark and at a card's stem, rising along it
//   uv     bark: NatureManufacture's trunk textures run foot to top once over the stem (pine: grey to orange)
//          and limbs take their top; a tiling bark (materials.barkTileM) tiles on stem and limbs alike;
//          leaves: the card's rectangle in the atlas
//   uv3    bark detail tiling (the bark shader's third uv set)
// Two sub-meshes in this order: bark, leaves.

export type V3 = [number, number, number];

export interface TreeSprite {
    id: string;
    /** u0, v0, u1, v1 in the atlas, origin bottom left. */
    rect: [number, number, number, number];
    /** Where the twig's stem starts. */
    base: [number, number];
    weight: number;
    /** A twig that hangs from its base (birch, willow): the card falls nearly straight down from its base, whatever
     *  way its branch points and whichever end of the rectangle the base is at. */
    hang?: boolean;
    /** The base is at the rectangle's top, but the twig follows its branch outwards instead of hanging (a spruce
     *  spray drawn stem up). */
    along?: boolean;
    /** The card's width as a part of the picture's own (0.6 = leaves drawn narrower: a broad-leaved shoot as a
     *  narrow-leaved one). */
    width?: number;
}

export interface TreeMaterials {
    /** Names of the materials the tree is drawn with (NatureManufacture's, copied per course in Unity). */
    bark: string;
    leaves: string;
    sprites: TreeSprite[];
    /** Set for a bark texture that tiles (metres one picture covers round the stem); unset for NatureManufacture's
     *  trunk textures, which run foot to top once over the stem. */
    barkTileM?: number;
    /** The leaf atlas' width over its height when it is not square (0.5 = twice as tall as wide). */
    atlasAspect?: number;
    /** Include each card's attachment point for the CTI wind vertex layout. */
    cti?: boolean;
}

export interface TreeParams {
    heightM: number;
    trunkRadiusM: number;
    /** Where the crown starts, as a part of the height. */
    crownBase: number;
    crownRadiusM: number;
    leanDeg: number;
    /** How far the stem wanders sideways towards its top. */
    wobbleM: number;
    /** The same tree without its lowest limb nodes. */
    skipWhorls: number;
    /** Dead stubs on the bare stem. */
    stubs: number;
    /** The part of the height where the stem ends. 1 = a stem right through the crown (pine, spruce); about a half =
     *  the stem gives way to its limbs (oak, most broadleaves). */
    stemEndsAt: number;
    /** A spreading crown forks above the clear stem into a few curved boughs. */
    crownForm: 'tiered' | 'spreading';
    /** Inclination of a spreading crown's living shoots towards the leaning side. */
    crownSlopeDeg: number;
    /** Upper UV limit on a non-tiling bark atlas. Old pines retain grey plated bark high up the stem. */
    barkTopV: number;
    /** Stem centreline for a reference tree. XY in crown radii and Z as a fraction of stem height. */
    stemPath: V3[];
    /** Small bends between the traced branch landmarks, in metres. */
    guideWanderM: number;
    /** A measured or sketched crown. Each path starts on the trunk (-1) or an earlier bough. */
    boughGuides: {
        parent: number; at: number; radius: number; foliageFrom: number;
        /** Fraction of this bough with solid wood collision, measured along its sampled path. */
        colliderTo?: number;
        /** Retained dead wood with bare lateral twigs, visible below an open crown. */
        bare?: boolean;
        /** X and Y in crown radii, Z in fractions of tree height, relative to the stem's foot. */
        points: V3[];
    }[];
    limbs: {
        /** Limbs per node: one is drawn from this list each time. */
        perNode: number[];
        spacingBottomM: number;
        spacingTopM: number;
        /** 0.35 = each gap is 65..135 % of its spacing. */
        spacingJitter: number;
        /** The part of the height where the last limb leaves the stem. */
        topAt: number;
        /** Angle above level at the stem, lowest and highest limb. */
        elevBottomDeg: number;
        elevTopDeg: number;
        elevJitterDeg: number;
        sagBottom: number;
        sagTop: number;
        upturnBottom: number;
        upturnTop: number;
        crooked: number;
        /** The top limbs' length as a part of the crown radius: small = a crown that narrows upwards. */
        topLength: number;
        /** How the crown narrows from its base to topLength: 1 = a straight cone (spruce), 2.5 = wide until near the top. */
        taper: number;
        /** No limb is shorter than this, for a 16 m tree (it scales with the height). */
        minLengthM: number;
        /** Fractional difference in limb length towards and away from the stem's lean. */
        windBias: number;
    };
    sides: {
        /** Where along a limb the first node sits. */
        startAt: number;
        spacingMinM: number;
        spacingMaxM: number;
        perNode: number[];
        angleMinDeg: number;
        angleMaxDeg: number;
        /** Length as a part of the limb's, before it shortens towards the limb's tip. */
        lengthMin: number;
        lengthMax: number;
        /** 1 = branches leave all the way round the limb, 0 = only sideways. */
        upDown: number;
        crooked: number;
        /** How much a side branch's outer part falls instead of turning up (0 = pine, oak; 1 = a weeping birch). */
        droop: number;
    };
    twigs: {
        perM: number;
        angleMinDeg: number;
        angleMaxDeg: number;
        lengthMinM: number;
        lengthMaxM: number;
    };
    needles: {
        /** Cards per clump at a limb's tip, a side branch's tip, a twig's tip and a twig's middle. */
        limbTip: number;
        sideTip: number;
        twigTip: number;
        twigMid: number;
        /** A twig-tip card's length; the other clumps scale from it. */
        sizeM: number;
        /** How much a card rises instead of following its branch, and how much the cards of a clump spread. */
        upward: number;
        scatter: number;
        /** How much the cards shrink on limbs shorter than the crown radius (0 = one size everywhere; 0.8 = a spruce's
         *  pointed top). */
        shrinkTop: number;
        /** How much a card points away from the crown's middle instead of along its branch (a globe willow's shoots). */
        outward: number;
        /** Above 0, no card starts outside a ball round the stem's top: its radius is this part of the crown radius
         *  sideways and ballHeight times that up and down (a globe willow's even dome). 0 = no such limit. */
        ball: number;
        ballHeight: number;
        /** Above 0 the ball is a smaller core (1 - this of its radius) with a dozen small balls of their own sizes
         *  standing out of it (a globe willow's crown of small globes). 0 = one smooth ball. */
        ballBumps: number;
        /** With a ball: a clump that starts nearer its middle than this part of its radius is moved straight out into
         *  the band between that and the surface. Nobody sees into a closed crown, so every card goes where it shows
         *  (0 = leaves all through). */
        shell: number;
        /** With a ball: 1 = the cards lie over its surface like shingles, pointing up and a little out, instead of
         *  following their branches (a card that points straight out of a crown is seen edge-on). */
        shingle: number;
        /** Above 0, each main limb's cards also stay inside a ball of their own near the limb's end, this part of
         *  the crown radius wide: the crown becomes a cluster of rounded lobes (a globe willow). 0 = off. */
        lobe: number;
        /** Hanging twigs (sprites with `hang`) only. alongPerM = strands hung per metre along the outer part of
         *  every limb and side branch, besides the clumps at the tips. hangTaper = how much shorter the strands are
         *  at the top of the crown than at its base. hangReach = how far a strand goes out with its branch before
         *  it falls, as a part of its length. innerShade = how much darker the leaves are towards the stem. */
        alongPerM: number;
        hangTaper: number;
        hangReach: number;
        /** How far a strand's tip ends below its base, as a part of its length: 1 = it hangs (weeping willow), about
         *  0.4 with a long hangReach = a shoot that stands out from the crown and nods at its tip (globe willow;
         *  with `outward` the shoots leave away from the crown's middle). */
        hangDrop: number;
        innerShade: number;
    };
}

export const DEFAULT_PARAMS: TreeParams = {
    heightM: 16, trunkRadiusM: 0.36, crownBase: 0.3, crownRadiusM: 7.4, leanDeg: 0, wobbleM: 0.3, skipWhorls: 0, stubs: 2, stemEndsAt: 1,
    crownForm: 'tiered', crownSlopeDeg: 0, barkTopV: 1, stemPath: [], guideWanderM: 0, boughGuides: [],
    limbs: {
        perNode: [1, 1, 1, 2], spacingBottomM: 1.45, spacingTopM: 0.75, spacingJitter: 0.35, topAt: 0.87,
        elevBottomDeg: 14, elevTopDeg: 50, elevJitterDeg: 7, sagBottom: 0.5, sagTop: 0.12, upturnBottom: 0.9, upturnTop: 0.4, crooked: 0.3, topLength: 0.28, taper: 2.5, minLengthM: 2.2, windBias: 0,
    },
    sides: {
        startAt: 0.2, spacingMinM: 0.35, spacingMaxM: 1.25, perNode: [1, 1, 2, 2, 3], angleMinDeg: 25, angleMaxDeg: 70,
        lengthMin: 0.25, lengthMax: 0.8, upDown: 0.6, crooked: 0.4, droop: 0,
    },
    twigs: { perM: 3.3, angleMinDeg: 25, angleMaxDeg: 80, lengthMinM: 0.35, lengthMaxM: 1.1 },
    needles: { limbTip: 6, sideTip: 5, twigTip: 4, twigMid: 2, sizeM: 1.1, upward: 0.5, scatter: 0.8, shrinkTop: 0, outward: 0, ball: 0, ballHeight: 0.85, ballBumps: 0, shell: 0, shingle: 0, lobe: 0, alongPerM: 0, hangTaper: 0, hangReach: 0, hangDrop: 1, innerShade: 0 },
};

/** A preset (any part of TreeParams) laid over `base` (the generator's defaults, or a species' own). */
export function resolveParams(preset: DeepPartial<TreeParams>, base: TreeParams = DEFAULT_PARAMS): TreeParams {
    const merge = (base: any, over: any): any => {
        if (over === undefined) return Array.isArray(base) ? [...base] : typeof base === 'object' ? merge(base, {}) : base;
        if (Array.isArray(base) || typeof base !== 'object') return Array.isArray(over) ? [...over] : over;
        const out: any = {};
        for (const k of Object.keys(base)) out[k] = merge(base[k], over[k]);
        return out;
    };
    return merge(base, preset);
}

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

export interface TreeLodSpec {
    /** Sides of the tubes per branch order; 0 = not drawn. */
    trunk: number; limb: number; side: number; twig: number;
    /** Share of the needle cards kept, and how much the kept ones grow to fill in. */
    cards: number; cardScale: number;
    cardRows: number;
    /** Every n-th point of a branch's centre line is kept. */
    segStep: number;
    /** Side branches shorter than this are not drawn (their needles stay). */
    sideMinM: number;
}

export const DEFAULT_LODS: TreeLodSpec[] = [
    { trunk: 10, limb: 6, side: 4, twig: 3, cards: 1.0, cardScale: 1.0, cardRows: 2, segStep: 1, sideMinM: 0 },
    { trunk: 8, limb: 5, side: 3, twig: 0, cards: 0.72, cardScale: 1.18, cardRows: 1, segStep: 3, sideMinM: 0 },
    { trunk: 6, limb: 4, side: 3, twig: 0, cards: 0.46, cardScale: 1.42, cardRows: 1, segStep: 4, sideMinM: 1.3 },
];

export interface TreeMesh {
    /** Flat per-vertex arrays: xyz, xyz, uv, uv, a. */
    positions: number[];
    normals: number[];
    uv: number[];
    uv3: number[];
    alpha: number[];
    /** Triangle indices per sub-mesh. Bark faces point outwards; leaves are drawn two-sided. */
    bark: number[];
    leaves: number[];
    cardPivots?: V3[];
}

export interface TreeBuild {
    heightM: number;
    /** Sampled stem centre line and radii in generator space, for the trunk's collision capsules. */
    stem: { point: V3; radiusM: number; startsFork?: boolean }[];
    counts: { limbs: number; sides: number; twigs: number; cards: number };
    lods: TreeMesh[];
}

// ---- vectors and random numbers ---------------------------------------------------------------

const UP: V3 = [0, 0, 1];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => { const n = length(a); return n > 1e-9 ? mul(a, 1 / n) : a; };
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: V3, b: V3, t: number): V3 => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const rad = (deg: number): number => deg * Math.PI / 180;

/** Seeded (mulberry32): the same seed always gives the same tree. */
export class TreeRng {
    private state: number;
    constructor(seed: number) { this.state = (seed >>> 0) || 1; }
    next(): number {
        let t = (this.state += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    uniform(a: number, b: number): number { return a + (b - a) * this.next(); }
    normal(sd = 1): number {
        const u = Math.max(this.next(), 1e-12), v = this.next();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
    }
    normal3(sd = 1): V3 { return [this.normal(sd), this.normal(sd), this.normal(sd)]; }
    pick<T>(list: T[]): T { return list[Math.min(list.length - 1, Math.floor(this.next() * list.length))]!; }
    seed(): number { return Math.floor(this.next() * 4294967296); }
}

// ---- skeleton ------------------------------------------------------------------------------------

interface Branch { pts: V3[]; radii: number[]; len: number }
interface Card { p: V3; a: V3; w: V3; len: number; sprite: number; keep: number; bend: number; out?: V3; reach?: number; shade?: number; drop?: number; round?: V3 }
interface Skeleton { trunk: Branch; limbs: Branch[]; sides: Branch[]; twigs: Branch[]; stubs: Branch[]; cards: Card[]; centre: V3; stemHeight: number; crownR: number }

/** A branch's centre line: sags under its own weight mid-way, turns up towards the tip, and only its thin outer part is crooked. */
function grow(rng: TreeRng, origin: V3, d0: V3, len: number, n: number, sag: number, upturn: number, crooked: number): V3[] {
    const seg = len / n;
    let pts: V3[] = [origin];
    let d = unit(d0), p = origin;
    for (let i = 1; i <= n; i++) {
        const t = i / n;
        const lift = upturn * Math.pow(t, 1.6) - sag * Math.sin(Math.PI * Math.min(t * 1.25, 1));
        d = unit(add(add(d, mul(UP, lift * seg * 0.35)), rng.normal3(crooked * seg * (0.12 + 0.88 * t * t))));
        p = add(p, mul(d, seg));
        pts.push(p);
    }
    for (let pass = 0; pass < 2; pass++) {   // no kinks: each inner point towards the middle of its neighbours
        pts = pts.map((q, i) => (i === 0 || i === n ? q : add(mul(q, 0.5), mul(add(pts[i - 1]!, pts[i + 1]!), 0.25))));
    }
    return pts;
}

/** A direction leaving `tan` at angleDeg; turn = where around it, squeezed towards sideways by upDown < 1. */
function fork(rng: TreeRng, tan: V3, angleDeg: number, turn: number, upDown: number): V3 {
    let side = cross(tan, UP);
    side = length(side) < 1e-6 ? [1, 0, 0] : unit(side);
    const up = cross(side, tan);
    const radial = unit(add(mul(side, Math.cos(turn)), mul(up, upDown * Math.sin(turn))));
    const th = rad(angleDeg);
    return unit(add(add(mul(tan, Math.cos(th)), mul(radial, Math.sin(th))), rng.normal3(0.08)));
}

/** A mature pine's stem divides into load-bearing forks. Their smaller arms turn out into one
 *  sloping canopy. Both the inside and the rim have living shoots, all attached to wood. */
function spreadingCrown(P: TreeParams, rng: TreeRng, wind: number, trunkAt: (z: number) => V3, trunkRadius: (z: number) => number,
    limbs: Branch[], dress: (r: TreeRng, b: Branch) => void): void {
    const radius = P.crownRadiusM, base = P.heightM * P.crownBase, depth = P.heightM - base;
    const forkTop = P.heightM * P.stemEndsAt, origin = trunkAt(forkTop);
    const c = Math.cos(wind), s = Math.sin(wind), slope = Math.tan(rad(P.crownSlopeDeg));
    const target = (az: number, reach: number, level: number): V3 => {
        const u = Math.cos(az) * reach * radius, v = Math.sin(az) * reach * radius * 0.86;
        return [origin[0] + c * u - s * v, origin[1] + s * u + c * v, base + depth * level + slope * u];
    };
    const bough = (a: V3, b: V3, r0: number, r1: number, rise: number): Branch => {
        const span = sub(b, a), bend = rng.uniform(-0.16, 0.16) * (0.5 + P.limbs.crooked);
        const elbow: V3 = [a[0] + 0.28 * span[0] - span[1] * bend, a[1] + 0.28 * span[1] + span[0] * bend, a[2] + rise * span[2]];
        const n = Math.max(6, Math.ceil(length(span) / 0.35)), pts: V3[] = [], radii: number[] = [];
        let len = 0;
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            pts.push(mix3(mix3(a, elbow, t), mix3(elbow, b, t), t));
            radii.push(mix(r0, r1, t));
            if (i) len += length(sub(pts[i]!, pts[i - 1]!));
        }
        const branch = { pts, radii, len };
        limbs.push(branch);
        return branch;
    };
    const count = 5, first = rng.uniform(0, 2 * Math.PI);
    for (let i = 0; i < count; i++) {
        const az = first + i * 2.39996 + rng.uniform(-0.18, 0.18);
        const z = mix(base, forkTop, i / (count - 1));
        const lower = i === 0 ? 0.10 : 0;
        const joint = target(az, rng.uniform(0.25, 0.42), rng.uniform(0.32, 0.44) - lower);
        const r = trunkRadius(z) * (i === count - 1 ? 0.9 : 0.64);
        const parent = bough(trunkAt(z), joint, r, r * 0.65, 0.72);
        // Two spreading distal arms and a shorter upright fork. The latter fills the space over
        // the stem, connecting neighbouring sprays without adding a vertical leader.
        for (const side of (i === 1 || i === 4 ? [-1, 1, 0] : [-1, 1])) {
            const inner = side === 0;
            const start = inner ? parent.pts[Math.floor((parent.pts.length - 1) * 0.68)]! : joint;
            const angle = az + (inner ? rng.uniform(-1.1, 1.1) : side * rng.uniform(0.23, 0.64));
            const reach = (inner ? rng.uniform(0.12, 0.46) : rng.uniform(0.7, 1.0)) * (1 + 0.35 * P.limbs.windBias * Math.cos(angle));
            const level = (inner ? rng.uniform(0.71, 0.78) : rng.uniform(0.66, 0.74)) - lower;
            const branch = bough(start, target(angle, reach, level), r * (inner ? 0.38 : 0.48), 0.014, rng.uniform(0.62, 1.1));
            dress(new TreeRng(rng.seed()), branch);
        }
    }
    // A surviving low bough reaches out beneath the raised side. Its two ends spread almost
    // level, leaving a strip of daylight under the upper sprays.
    const lowAz = rng.uniform(-0.38, 0.38);
    const lowPoint = (angle: number, reach: number, level: number): V3 => {
        const p = target(angle, reach, level);
        p[2] = base + depth * level;
        return p;
    };
    const lowerFork = lowPoint(lowAz, 0.44, 0.33);
    const lowerRadius = trunkRadius(base) * 0.50;
    bough(trunkAt(base), lowerFork, lowerRadius, lowerRadius * 0.62, 0.95);
    for (const side of [-1, 1]) {
        const tip = lowPoint(lowAz + side * rng.uniform(0.17, 0.43), rng.uniform(0.82, 1.05), rng.uniform(0.40, 0.48));
        dress(new TreeRng(rng.seed()), bough(lowerFork, tip, lowerRadius * 0.45, 0.012, 0.55));
    }
}

/** Fit a smooth branch through the guide points. Children attach to the sampled wood, even at a bend. */
function guidedCrown(P: TreeParams, rng: TreeRng, trunk: Branch, limbs: Branch[], bareTwigs: Branch[], dress: (r: TreeRng, b: Branch, from: number) => void): void {
    for (const guide of P.boughGuides) {
        const parent = guide.parent === -1 ? trunk : limbs[guide.parent]!;
        const u = guide.at * (parent.pts.length - 1), i = Math.min(Math.floor(u), parent.pts.length - 2);
        const origin = mix3(parent.pts[i]!, parent.pts[i + 1]!, u - i);
        const radius = guide.radius * mix(parent.radii[i]!, parent.radii[i + 1]!, u - i);
        const knots = [origin, ...guide.points.map(([x, y, z]): V3 => [x * P.crownRadiusM, y * P.crownRadiusM, z * P.heightM])];
        const pts = [origin], distance = [0];
        let len = 0;
        for (let k = 1; k < knots.length; k++) {
            const a = knots[k - 1]!, b = knots[k]!;
            // One-sided tangents at the ends, centred tangents at the interior knots.
            const da = k === 1 ? sub(b, a) : mul(sub(b, knots[k - 2]!), 0.5);
            const db = k === knots.length - 1 ? sub(b, a) : mul(sub(knots[k + 1]!, a), 0.5);
            const span = sub(b, a), count = Math.max(2, Math.ceil(length(span) / (0.022 * P.heightM)));
            const side = unit(cross(span, UP));
            const phase = 1.7 * k + 2.4 * limbs.length;
            for (let j = 1; j <= count; j++) {
                const t = j / count, t2 = t * t, t3 = t2 * t;
                let p = add(mix3(a, b, 3 * t2 - 2 * t3), add(mul(da, t3 - 2 * t2 + t), mul(db, t3 - t2)));
                if (P.guideWanderM) {
                    const amount = Math.min(P.guideWanderM, length(span) * 0.12) * Math.sin(Math.PI * t) ** 2;
                    p = add(p, add(mul(side, amount * Math.sin(phase + 4 * t)), mul(UP, amount * 0.58 * Math.cos(phase + 3 * t))));
                }
                len += length(sub(p, pts[pts.length - 1]!));
                pts.push(p); distance.push(len);
            }
        }
        const radii = distance.map(d => mix(0.007 * P.heightM / 16, radius, Math.pow(1 - d / len, 0.75)));
        const branch = { pts, radii, len };
        limbs.push(branch);
        const r = new TreeRng(rng.seed());
        if (!guide.bare) {
            dress(r, branch, guide.foliageFrom);
        } else {
            for (let i = 2; i < pts.length - 1; i += 3) {
                const dir = fork(r, unit(sub(pts[i + 1]!, pts[i - 1]!)), r.uniform(28, 68), i * 2.4, 1);
                const twigLength = len * r.uniform(0.12, 0.31);
                const twig = grow(r, pts[i]!, dir, twigLength, 4, 0.65, 0.12, 1.3);
                const radius = Math.min(radii[i]! * 0.45, twigLength * 0.024);
                bareTwigs.push({ pts: twig, radii: twig.map((_, j) => mix(radius, 0.002, j / 4)), len: twigLength });
            }
        }
    }
}

function buildSkeleton(P: TreeParams, sprites: TreeSprite[], seed: number): Skeleton {
    const rng = new TreeRng(seed);
    const H = P.heightM, R = P.trunkRadiusM, scale = H / 16;
    const segM = Math.max(0.4 * scale, 0.12);   // a branch's segment length; a bush does not get a tree's count of them
    const lean = rad(P.leanDeg), leanAz = rng.uniform(0, 2 * Math.PI);
    const leanDir: V3 = [Math.cos(leanAz), Math.sin(leanAz), 0];
    const ph = [0, 1, 2, 3].map(() => rng.uniform(0, 2 * Math.PI));
    const trunkPos = (z: number): V3 => {
        if (P.stemPath.length >= 2) {
            const f = Math.min(1, z / (P.stemEndsAt * H));
            const next = P.stemPath.findIndex(p => p[2] >= f);
            const i = next < 0 ? P.stemPath.length - 1 : Math.max(1, next);
            const a = P.stemPath[i - 1]!, b = P.stemPath[i]!;
            const u = Math.max(0, Math.min(1, (f - a[2]) / (b[2] - a[2])));
            return [mix(a[0], b[0], u) * P.crownRadiusM, mix(a[1], b[1], u) * P.crownRadiusM, z];
        }
        const t = z / H;
        const l = Math.tan(lean) * z * (1 - 0.45 * t * t);
        const w = P.wobbleM * t;
        return [
            leanDir[0] * l + (Math.sin(t * 5.1 + ph[0]!) + 0.5 * Math.sin(t * 11.3 + ph[1]!)) * w,
            leanDir[1] * l + (Math.sin(t * 4.3 + ph[2]!) + 0.5 * Math.sin(t * 9.7 + ph[3]!)) * w,
            z,
        ];
    };
    const trunkR = (z: number): number => Math.max(R * (1 - 0.78 * Math.pow(z / H, 1.15)) + R * 0.45 * Math.exp(-z / 0.35), 0.03);
    const stemH = H * P.stemEndsAt;
    const nt = Math.floor(stemH / (P.stemPath.length ? 0.28 : 0.7)) + 1;
    const zs = Array.from({ length: nt + 1 }, (_, i) => stemH * i / nt);
    const trunk: Branch = { pts: zs.map(trunkPos), radii: zs.map(trunkR), len: stemH };
    trunk.radii[nt] = P.crownForm === 'spreading' || P.boughGuides.length ? trunkR(stemH) * 0.9 : 0.03;

    const cb = P.crownBase * H, top = Math.min(P.limbs.topAt, P.stemEndsAt) * H;
    const centre = trunkPos(mix(cb, H, 0.5));
    const limbs: Branch[] = [], sides: Branch[] = [], twigs: Branch[] = [], stubs: Branch[] = [], cards: Card[] = [];
    const total = sprites.reduce((s, x) => s + x.weight, 0);
    const pickSprite = (r: TreeRng): number => {
        let x = r.next() * total;
        for (let i = 0; i < sprites.length; i++) { x -= sprites[i]!.weight; if (x <= 0) return i; }
        return sprites.length - 1;
    };
    const ballCentre = add(trunkPos(stemH), [0, 0, P.crownRadiusM * 0.25]);
    // The ball's small balls: a dozen spheres of their own sizes standing out of a smaller core, spread over the top
    // and sides (unit-ball space). Their own random stream, so that no other part of the tree moves with them.
    const bossRng = new TreeRng((seed ^ 0x5bd1e995) >>> 0);
    const bosses: { c: V3; r: number }[] = Array.from({ length: 13 }, (_, i) => {
        const z = 0.95 - 1.35 * (i + bossRng.next()) / 13, rr = Math.sqrt(Math.max(0, 1 - z * z)), az = i * 2.39996 + bossRng.uniform(-0.5, 0.5);
        const d = bossRng.uniform(0.5, 0.78);
        return { c: mul([rr * Math.cos(az), rr * Math.sin(az), z] as V3, d), r: bossRng.uniform(0.28, 0.5) };
    });
    let lobeCentre: V3 | null = null;
    let bossAt: V3 | null = null;   // the middle of the small ball the last clump sits on: its cards are lit round it
    const intoBall = (q0: V3): V3 => {
        let q = q0;
        if (lobeCentre && P.needles.lobe > 0) {
            const o = sub(q, lobeCentre), d = length(o), r = P.crownRadiusM * P.needles.lobe;
            if (d > r) q = add(lobeCentre, mul(o, r / d));
        }
        bossAt = null;
        if (P.needles.ball <= 0) return q;
        const rh = P.crownRadiusM * P.needles.ball, rv = rh * P.needles.ballHeight;
        const o = sub(q, ballCentre);
        let k = Math.sqrt((o[0] * o[0] + o[1] * o[1]) / (rh * rh) + o[2] * o[2] / (rv * rv));
        if (P.needles.ballBumps > 0 && k > 1e-6) {
            // how far out the surface is this way: the core, or the farthest boss the ray leaves
            const u = unit([o[0] / rh, o[1] / rh, o[2] / rv]);
            let limit = 1 - P.needles.ballBumps;
            for (const boss of bosses) {
                const along = dot(u, boss.c), disc = along * along - dot(boss.c, boss.c) + boss.r * boss.r;
                if (disc >= 0 && along + Math.sqrt(disc) > limit) {
                    limit = along + Math.sqrt(disc);
                    bossAt = add(ballCentre, [boss.c[0] * rh, boss.c[1] * rh, boss.c[2] * rv]);
                }
            }
            k /= limit;
        }
        return k <= 1 ? q : add(ballCentre, mul(o, 1 / k));
    };
    const clump = (r: TreeRng, at0: V3, d: V3, count: number, size: number): void => {
        let at = at0;
        if (P.needles.ball > 0 && P.needles.shell > 0) {
            const rh = P.crownRadiusM * P.needles.ball, rv = rh * P.needles.ballHeight, o = sub(at, ballCentre);
            const k = Math.sqrt((o[0] * o[0] + o[1] * o[1]) / (rh * rh) + o[2] * o[2] / (rv * rv));
            if (k < P.needles.shell && k > 0.05) at = add(ballCentre, mul(o, (P.needles.shell + (1.3 - P.needles.shell) * r.next()) / k));
        }
        const p = intoBall(at);
        for (let c = 0; c < count; c++) {
            let a = unit(add(add(mul(unit(d), 0.45), mul(UP, P.needles.upward)), mul(unit(r.normal3()), P.needles.scatter)));
            if (P.needles.outward > 0) a = unit(add(a, mul(unit(sub(p, centre)), P.needles.outward)));
            if (a[2] < -0.15) a = unit([a[0], a[1], a[2] * -0.3]);   // needles do not hang
            const turn = unit(r.normal3());
            let across = unit(cross(a, turn));
            if (P.needles.ball > 0 && P.needles.shingle > 0) {
                const out = unit(sub(p, ballCentre));
                let rise = sub(UP, mul(out, dot(UP, out)));
                rise = length(rise) < 0.05 ? unit(cross(out, turn)) : unit(rise);
                const spin = (r.next() - 0.5) * 3.0;   // most rise, some lie across, a few nod
                const along = unit(add(mul(rise, Math.cos(spin)), mul(cross(out, rise), Math.sin(spin))));
                a = unit(add(mul(a, 1 - P.needles.shingle), mul(add(along, mul(out, 0.3 + 0.3 * r.next())), P.needles.shingle)));
                across = add(cross(a, out), mul(turn, 0.25));
                across = unit(sub(across, mul(a, dot(across, a))));
            }
            const card: Card = { p, a, w: across, len: size * r.uniform(0.85, 1.2) * scale, sprite: pickSprite(r), keep: r.next(), bend: r.uniform(0.08, 0.22) };
            if (sprites[card.sprite]!.hang) {
                // the picture's up = straight up but for a little of the branch's own way and of the clump's spread
                const flat = unit([d[0] + turn[0] * P.needles.scatter, d[1] + turn[1] * P.needles.scatter, 0.001]);
                card.a = unit(sub(UP, mul(flat, 0.12 + 0.2 * P.needles.scatter * Math.abs(turn[2]))));
                const sp = sprites[card.sprite]!;
                if (sp.base[1] < (sp.rect[1] + sp.rect[3]) / 2) card.a = mul(card.a, -1);   // drawn stem down: the picture's up falls
                card.w = unit(cross(card.a, turn));
                card.bend *= 0.4;
                const hf = Math.min(1, Math.max(0, (p[2] - cb) / (H - cb)));
                card.len = Math.min(card.len * (1 - P.needles.hangTaper * hf * hf), Math.max(0.6, p[2] - 0.3));   // never into the ground
                if (P.needles.hangReach > 0) {
                    card.out = flat; card.reach = P.needles.hangReach * card.len * r.uniform(0.4, 1); card.drop = P.needles.hangDrop;
                    if (P.needles.outward > 0) {
                        // A shoot that stands out of the crown: away from its middle, each a good way off to one side
                        // and turned its own way round, so that from any side some lie across the view (a card
                        // straight out of the crown is seen edge-on from in front).
                        const middle = P.needles.ball > 0 ? ballCentre : centre;
                        card.out = unit(add(add(mul(unit(sub(p, middle)), P.needles.outward), mul(turn, 0.75)), mul(UP, P.needles.upward)));
                        card.w = unit(cross(card.out, unit(r.normal3())));
                    }
                }
            }
            if (P.needles.innerShade > 0) card.shade = P.needles.innerShade;
            if (bossAt) card.round = bossAt;
            cards.push(card);
        }
    };
    const strandsAlong = (r: TreeRng, pts: V3[], from: number, size: number): void => {
        if (P.needles.alongPerM <= 0) return;
        const m = pts.length - 1;
        let len = 0;
        for (let i = 1; i <= m; i++) len += length(sub(pts[i]!, pts[i - 1]!));
        const count = Math.round(len * (1 - from) * P.needles.alongPerM * r.uniform(0.6, 1.3));
        for (let q = 0; q < count; q++) {
            const u = r.uniform(from, 0.98) * m, i = Math.min(Math.floor(u), m - 1);
            clump(r, mix3(pts[i]!, pts[i + 1]!, u - i), sub(pts[i + 1]!, pts[i]!), 1, size * r.uniform(0.6, 1.1));
        }
    };
    const fullSize = P.needles.sizeM;
    const sizeOn = (limbLength: number): number => fullSize * (1 - P.needles.shrinkTop * Math.max(0, 1 - limbLength / P.crownRadiusM));

    // In the spreading crown, a side branch grows into a fan along its parent bough's
    // inclined plane. Apply the same bend to the twig geometry before attaching the needles.
    const fanSlope = Math.tan(rad(P.crownSlopeDeg));
    const fanShoot = (pts: V3[]): V3[] => {
        if (P.crownForm !== 'spreading' && !P.boughGuides.length) return pts;
        const root = pts[0]!;
        return pts.map(p => {
            const rise = fanSlope * ((p[0] - root[0]) * leanDir[0] + (p[1] - root[1]) * leanDir[1]);
            return [p[0], p[1], mix(root[2] + rise, p[2], P.sides.upDown)];
        });
    };
    const dress = (r: TreeRng, branch: Branch, from = P.sides.startAt): void => {
        const { pts, len: L } = branch, n = pts.length - 1, size = sizeOn(L);
        lobeCentre = pts[Math.round(n * 0.8)]!;
        strandsAlong(r, pts, 0.45, size);
        clump(r, pts[n]!, sub(pts[n]!, pts[n - 1]!), P.needles.limbTip, size * 1.27);

        // Side branches leave at nodes, irregularly spaced: one to three from the same point, each at its own
        // angle to the limb and its own turn around it.
        for (let s = from + r.uniform(0, 0.1); s < 0.97; s += r.uniform(P.sides.spacingMinM, P.sides.spacingMaxM) * scale / L) {
            const i = Math.min(Math.floor(s * n), n - 1);
            const p = mix3(pts[i]!, pts[i + 1]!, s * n - i);
            const tan = unit(sub(pts[i + 1]!, pts[i]!));
            const first = r.uniform(0, 2 * Math.PI);
            const here = r.pick(P.sides.perNode);
            for (let b = 0; b < here; b++) {
                const sl = Math.min(Math.max(r.uniform(P.sides.lengthMin, P.sides.lengthMax) * L * (1 - 0.55 * s), Math.min(0.7 * scale, 0.6 * L)), 3.8 * scale);
                const sd = fork(r, tan, r.uniform(P.sides.angleMinDeg, P.sides.angleMaxDeg), first + b * 2.4, P.sides.upDown);
                const sn = Math.max(3, Math.floor(sl / segM));
                const spts = fanShoot(grow(r, p, sd, sl, sn, r.uniform(0, 0.3) + 0.5 * P.sides.droop, r.uniform(0.25, 0.8) - 2.2 * P.sides.droop, P.sides.crooked));
                const sr = 0.012 + 0.014 * sl;
                sides.push({ pts: spts, radii: spts.map((_, k) => sr * Math.pow(1 - k / sn, 0.8) + 0.008), len: sl });
                strandsAlong(r, spts, 0.25, size);
                clump(r, spts[sn]!, sub(spts[sn]!, spts[sn - 1]!), P.needles.sideTip, size * 1.14);
                // Twigs: anywhere along the outer two thirds, any way round; some branches carry few.
                const most = Math.max(2, Math.floor(sl * P.twigs.perM / scale));
                const twigCount = 1 + Math.floor(r.next() * (most - 1));
                for (let q = 0; q < twigCount; q++) {
                    const u = r.uniform(0.3, 0.98) * sn;
                    const k = Math.min(Math.floor(u), sn - 1);
                    const tp = mix3(spts[k]!, spts[k + 1]!, u - k);
                    const tl = r.uniform(P.twigs.lengthMinM, P.twigs.lengthMaxM) * scale;
                    const td = fork(r, unit(sub(spts[k + 1]!, spts[k]!)), r.uniform(P.twigs.angleMinDeg, P.twigs.angleMaxDeg), r.uniform(0, 2 * Math.PI), 1);
                    const tpts = fanShoot(grow(r, tp, td, tl, 2, 0, r.uniform(0.2, 0.8), 0.4));
                    twigs.push({ pts: tpts, radii: [0.014, 0.01, 0.006], len: tl });
                    clump(r, tpts[2]!, sub(tpts[2]!, tpts[1]!), P.needles.twigTip, size);
                    clump(r, tpts[1]!, sub(tpts[2]!, tpts[1]!), P.needles.twigMid, size * 0.86);
                }
            }
        }
    };

    if (P.boughGuides.length) {
        guidedCrown(P, rng, trunk, limbs, sides, dress);
    } else if (P.crownForm === 'spreading') {
        spreadingCrown(P, rng, leanAz, trunkPos, trunkR, limbs, dress);
    } else {
        // Limb nodes bottom to top, each with its own random stream: skipWhorls leaves the rest of the tree as it was.
        const nodes: { z: number; t: number; count: number; az: number; seed: number }[] = [];
        for (let z = cb, az = rng.uniform(0, 2 * Math.PI); z < top;) {
            const t = (z - cb) / (top - cb);
            const count = rng.pick(P.limbs.perNode);
            nodes.push({ z, t, count, az, seed: rng.seed() });
            z += mix(P.limbs.spacingBottomM, P.limbs.spacingTopM, t) * scale * rng.uniform(1 - P.limbs.spacingJitter, 1 + P.limbs.spacingJitter);
            az += 2.4 * count + rng.normal(0.3);
        }
        nodes.forEach((node, index) => {
            if (index < P.skipWhorls) return;
            const r = new TreeRng(node.seed);
            const t = node.t;
            for (let j = 0; j < node.count; j++) {
                const az = node.az + j * 2.4 + r.normal(0.4);   // golden-angle turns: never opposite pairs
                const profile = (1 - (1 - P.limbs.topLength) * Math.pow(t, P.limbs.taper)) * (0.82 + 0.18 * Math.min(1, t / 0.2));
                const exposure = 1 + P.limbs.windBias * Math.cos(az - leanAz);
                const L = Math.max(P.crownRadiusM * profile * exposure * r.uniform(0.85, 1.2), P.limbs.minLengthM * scale);
                const elev = rad(mix(P.limbs.elevBottomDeg, P.limbs.elevTopDeg, Math.pow(t, 1.1)) + r.normal(P.limbs.elevJitterDeg));
                const d0: V3 = [Math.cos(elev) * Math.cos(az), Math.cos(elev) * Math.sin(az), Math.sin(elev)];
                const n = Math.max(6, Math.floor(L / segM));
                const pts = grow(r, trunkPos(node.z), d0, L, n, mix(P.limbs.sagBottom, P.limbs.sagTop, t), mix(P.limbs.upturnBottom, P.limbs.upturnTop, t), P.limbs.crooked);
                const r0 = Math.min(0.03 + 0.027 * L, trunkR(node.z) * 0.62);
                // thicker where it leaves the stem (a collar)
                const radii = pts.map((_, i) => r0 * Math.pow(1 - i / n, 0.8) * (1 + 0.45 * Math.exp(-(i / n) * L / 0.25)) + 0.012);
                const branch = { pts, radii, len: L };
                limbs.push(branch);
                dress(r, branch);
            }
        });
        lobeCentre = null;
        clump(rng, trunk.pts[nt]!, UP, 7, sizeOn(0) * 1.27);
    }

    for (let i = 0; i < P.stubs; i++) {
        const z = rng.uniform(0.45, 0.98) * cb, az = rng.uniform(0, 2 * Math.PI);
        const L = rng.uniform(0.3, 1.1) * scale;
        const pts = grow(rng, trunkPos(z), [Math.cos(az), Math.sin(az), rng.uniform(-0.1, 0.4)], L, 3, 0.2, 0, 0.2);
        stubs.push({ pts, radii: [0.035, 0.028, 0.02, 0.012], len: L });
    }
    return { trunk, limbs, sides, twigs, stubs, cards, centre, stemHeight: stemH, crownR: P.crownRadiusM };
}

// ---- meshes ----------------------------------------------------------------------------------------

class MeshBuilder {
    readonly mesh: TreeMesh = { positions: [], normals: [], uv: [], uv3: [], alpha: [], bark: [], leaves: [] };
    private count = 0;
    vert(p: V3, n: V3, u: number, v: number, alpha: number, u3 = 0, v3 = 0): number {
        const m = this.mesh;
        m.positions.push(p[0], p[1], p[2]); m.normals.push(n[0], n[1], n[2]); m.uv.push(u, v); m.uv3.push(u3, v3); m.alpha.push(alpha);
        return this.count++;
    }
    quad(a: number, b: number, c: number, d: number, into: number[]): void { into.push(a, b, c, a, c, d); }
}

/** A tube along pts; uvAt(pointIndex, lengthSoFar, partRound) gives its uv. detailM = how wide the bark detail tiles. */
function tube(mb: MeshBuilder, pts: V3[], radii: number[], sideCount: number, uvAt: (i: number, l: number, k: number) => [number, number], detailM: number, levelFoot = false): void {
    const n = pts.length;
    const tang = pts.map((_, i) => unit(sub(pts[Math.min(i + 1, n - 1)]!, pts[Math.max(i - 1, 0)]!)));
    let nrm = unit(cross(tang[0]!, Math.abs(tang[0]![0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
    const wraps = Math.max(1, Math.round(2 * Math.PI * radii[0]! / detailM));
    const rings: number[][] = [];
    let len = 0;
    for (let i = 0; i < n; i++) {
        if (i > 0) {
            len += length(sub(pts[i]!, pts[i - 1]!));
            nrm = unit(sub(nrm, mul(tang[i]!, dot(nrm, tang[i]!))));
        }
        const bi = cross(tang[i]!, nrm);
        const ring: number[] = [];
        for (let k = 0; k <= sideCount; k++) {
            const ang = 2 * Math.PI * k / sideCount;
            let out = add(mul(nrm, Math.cos(ang)), mul(bi, Math.sin(ang)));
            if (levelFoot && i === 0) out = unit([out[0], out[1], 0]);
            const [u, v] = uvAt(i, len, k / sideCount);
            ring.push(mb.vert(add(pts[i]!, mul(out, radii[i]!)), out, u, v, 0, wraps * k / sideCount, len / (12 * detailM)));
        }
        rings.push(ring);
    }
    for (let i = 0; i < n - 1; i++)
        for (let k = 0; k < sideCount; k++) mb.quad(rings[i]![k]!, rings[i]![k + 1]!, rings[i + 1]![k + 1]!, rings[i + 1]![k]!, mb.mesh.bark);
}

function buildLod(sk: Skeleton, materials: TreeMaterials, lod: TreeLodSpec, barkTopV: number, levelFoot: boolean): TreeMesh {
    const sprites = materials.sprites, tile = materials.barkTileM;
    const mb = new MeshBuilder();
    if (materials.cti) mb.mesh.cardPivots = [];
    const tr = sk.trunk;
    const wrapsOf = (radius: number): number => Math.max(1, Math.round(2 * Math.PI * radius / (tile ?? 1)));
    const stemWraps = wrapsOf(tr.radii[0]!);
    tube(mb, tr.pts, tr.radii, lod.trunk, tile ? (_i, l, k) => [k * stemWraps, l / tile] : (i, _l, k) => [k * 2, barkTopV * tr.pts[i]![2] / sk.stemHeight], tile ?? 1, levelFoot);
    const groups: [Branch[], number, boolean][] = [[sk.limbs, lod.limb, false], [sk.stubs, lod.limb, false], [sk.sides, lod.side, true], [sk.twigs, lod.twig, false]];
    for (const [group, sideCount, isSide] of groups) {
        if (sideCount === 0) continue;
        for (const b of group) {
            if (isSide && b.len < lod.sideMinM) continue;
            const idx: number[] = [];
            for (let i = 0; i < b.pts.length; i += lod.segStep) idx.push(i);
            if (idx[idx.length - 1] !== b.pts.length - 1) idx.push(b.pts.length - 1);
            const wraps = wrapsOf(b.radii[0]!);
            tube(mb, idx.map((i) => b.pts[i]!), idx.map((i) => b.radii[i]!), sideCount, tile ? (_i, l, k) => [k * wraps, l / tile] : (_i, l, k) => [k, barkTopV * Math.min(0.8 + l * 0.02, 0.97)], tile ?? 0.5);
        }
    }
    for (const c of sk.cards) {
        if (c.keep >= lod.cards) continue;
        mb.mesh.cardPivots?.push(c.p);
        const sp = sprites[c.sprite]!;
        const [u0, v0, u1, v1] = sp.rect, [ub, vb] = sp.base;
        const size = c.len * lod.cardScale / (v1 - v0) * (sp.along ? -1 : 1);
        let n = unit(cross(c.w, c.a));
        if (n[2] < 0) n = mul(n, -1);
        const grid: number[][] = [];
        for (let r = 0; r <= lod.cardRows; r++) {
            const v = mix(v0, v1, r / lod.cardRows), t = Math.abs(v - vb) / (v1 - v0);   // 0 at the twig's base, 1 at its far end
            grid.push([u0, u1].map((u) => {
                let p = add(add(add(c.p, mul(c.w, (u - ub) * Math.abs(size) * (materials.atlasAspect ?? 1) * (sp.width ?? 1))), mul(c.a, (v - vb) * size)), mul(n, t * t * c.bend * c.len));
                if (c.out) {
                    // A hanging strand: out with its branch in a round bow, then down; each leans its own way and
                    // sways sideways, so no two hang alike. Its own numbers come from `keep`: no further random draw.
                    const drop = (c.drop ?? 1) * Math.pow(t, 1.5) - t;   // slow at first: the bow is round, not a corner
                    const leanAz = c.keep * 81.7, phase = c.keep * 43.9;
                    const lean = 0.07 + 0.11 * ((c.keep * 7.3) % 1);
                    p = add(p, mul(c.a, -drop * c.len * Math.sign(size)));
                    p = add(p, mul(c.out, c.reach! * (1 - Math.pow(1 - t, 2.5))));
                    p = add(p, mul([Math.cos(leanAz), Math.sin(leanAz), 0], lean * c.len * t * t));
                    p = add(p, mul(c.w, 0.05 * c.len * Math.sin(phase + t * 5) * t));
                }
                // lit like one rounded crown, never from below
                let soft = unit(add(add(mul(n, 0.3), mul(unit(sub(p, c.round ?? sk.centre)), c.round ? 0.9 : 0.55)), mul(UP, c.round ? 0.25 : 0.45)));
                if (c.shade) {   // inside the crown the leaves face the ground: lit by little
                    const k = c.shade * Math.max(0, 1 - Math.hypot(p[0] - sk.centre[0], p[1] - sk.centre[1]) / sk.crownR);
                    soft = unit(add(mul(soft, 1 - k), mul(UP, -k)));
                }
                return mb.vert(p, soft, u, v, 0.28 * t);
            }));
        }
        for (let r = 0; r < lod.cardRows; r++) mb.quad(grid[r]![0]!, grid[r]![1]!, grid[r + 1]![1]!, grid[r + 1]![0]!, mb.mesh.leaves);
    }
    return mb.mesh;
}

export function generateTree(params: TreeParams, materials: TreeMaterials, seed: number, lods: TreeLodSpec[] = DEFAULT_LODS): TreeBuild {
    const sk = buildSkeleton(params, materials.sprites, seed);
    const meshes = lods.map((lod) => buildLod(sk, materials, lod, params.barkTopV, params.stemPath.length > 0));
    let top = 0;
    const z = meshes[0]!.positions;
    for (let i = 2; i < z.length; i += 3) top = Math.max(top, z[i]!);
    const stem: TreeBuild['stem'] = sk.trunk.pts.flatMap((point, i) =>
        i % 4 === 0 || i === sk.trunk.pts.length - 1 ? [{ point, radiusM: sk.trunk.radii[i]! }] : []);
    params.boughGuides.forEach((guide, index) => {
        if (!guide.colliderTo) return;
        const branch = sk.limbs[index]!;
        const end = Math.min(branch.pts.length - 1, Math.round(guide.colliderTo * (branch.pts.length - 1)));
        for (let i = 0; i <= end; i++) {
            if (i % 4 === 0 || i === end) stem.push({ point: branch.pts[i]!, radiusM: branch.radii[i]!, startsFork: i === 0 });
        }
    });
    // A guide traces the photographed silhouette, whose stated height includes the terminal needles.
    if (params.boughGuides.length && top > 0) {
        const scale = params.heightM / top;
        for (const mesh of meshes) {
            for (let i = 0; i < mesh.positions.length; i++) mesh.positions[i]! *= scale;
            if (mesh.cardPivots) mesh.cardPivots = mesh.cardPivots.map(p => mul(p, scale));
        }
        for (const sample of stem) {
            sample.point = mul(sample.point, scale);
            sample.radiusM *= scale;
        }
        top = params.heightM;
    }
    return { heightM: top, stem, counts: { limbs: sk.limbs.length, sides: sk.sides.length, twigs: sk.twigs.length, cards: sk.cards.length }, lods: meshes };
}

export const triangles = (mesh: TreeMesh): number => (mesh.bark.length + mesh.leaves.length) / 3;
