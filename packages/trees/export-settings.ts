import { TREE_CONTROL_GROUPS, writeParam } from './controls';
import { SPECIES } from './species';
import type { TreeParams } from './generator';

export interface TreeExportSettings {
    species: string;
    preset: string;
    seed: number;
    changes: Record<string, number>;
}

const controls = new Map(TREE_CONTROL_GROUPS.flatMap(group => group.controls.map(c => [c.path, c] as const)));
const record = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function exportSettings(input: unknown): TreeExportSettings {
    if (!record(input)) throw Error('Expected tree settings.');
    const { species, preset, seed, changes } = input;
    if (typeof species !== 'string' || !Object.hasOwn(SPECIES, species) ||
        typeof preset !== 'string' || !Object.hasOwn(SPECIES[species]!.presets, preset)) throw Error('Unknown tree species or preset.');
    if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0) throw Error('The seed must be a non-negative integer.');
    if (!record(changes)) throw Error('Expected slider changes.');
    const checked: Record<string, number> = {};
    for (const key of Object.keys(changes).sort()) {
        const c = controls.get(key);
        const value = changes[key];
        if (!c || typeof value !== 'number' || !Number.isFinite(value) || value < c.min || value > c.max ||
            (c.step === 1 && !Number.isInteger(value))) throw Error(`Invalid tree setting: ${key}`);
        checked[key] = value;
    }
    return { species, preset, seed, changes: checked };
}

export function applyControls(params: TreeParams, changes: Record<string, number>): void {
    for (const [key, value] of Object.entries(changes)) writeParam(params, key, value);
}
