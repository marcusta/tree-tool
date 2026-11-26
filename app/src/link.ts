// A tree in the page's address: `#species=pine&preset=windswept&seed=7&limbs.windBias=0.6[&model=<id>]`. The same
// settings build the same tree everywhere, so the link is all there is to share when no picture of one's own is in it.
// `model` names a shared model whose pictures and shader profile come along.
import { exportSettings, type TreeExportSettings } from '@tree-tool/trees/export-settings';

const FIXED = new Set(['species', 'preset', 'seed', 'model']);

export function toHash(s: TreeExportSettings, model?: string): string {
    const q = new URLSearchParams({ species: s.species, preset: s.preset, seed: String(s.seed) });
    for (const key of Object.keys(s.changes).sort()) q.set(key, String(s.changes[key]));
    if (model) q.set('model', model);
    return '#' + q.toString();
}

/** The settings in a hash, checked; undefined when there are none or they do not make a tree. */
export function fromHash(hash: string): { settings?: TreeExportSettings; model?: string; error?: string } {
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    const model = q.get('model') ?? undefined;
    if (!q.has('species')) return { model };
    const changes: Record<string, number> = {};
    for (const [key, value] of q) if (!FIXED.has(key)) changes[key] = Number(value);
    try {
        return { model, settings: exportSettings({ species: q.get('species'), preset: q.get('preset'), seed: Number(q.get('seed') ?? 1), changes }) };
    } catch (e) {
        return { model, error: (e as Error).message };
    }
}
