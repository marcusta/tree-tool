/** A package's tree id: species, preset and seed, plus a short hash of the slider changes when there are any, so two
 *  different trees never share asset GUIDs (they come from the id) and the same tree always gets the same ones. */
export function treeId(r: { species: string; preset: string; seed: number; changes: Record<string, number> }): string {
    const base = `${r.species}_${r.preset}_${r.seed}`.replace(/-/g, '_');
    const keys = Object.keys(r.changes).sort();
    if (!keys.length) return base;
    let h = 2166136261;
    for (const ch of keys.map(k => `${k}=${r.changes[k]}`).join('&')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return `${base}_${(h >>> 0).toString(36).padStart(7, '0').slice(0, 7)}`;
}
