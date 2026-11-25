# tree-tool — AGENTS

Procedural trees as `.unitypackage` files, built in the browser. Start with [README.md](README.md).

## Rules

- `packages/trees` has no dependencies and no Node or DOM APIs outside its tests: the same code runs in Bun, in a
  web worker and in golf-map. Byte writers use `Uint8Array` and `CompressionStream`.
- Never put a licensed byte in the repo or the app: the catalogue holds GUIDs and names only. A picture we made
  ourselves (`packages/trees/atlas/`) is ours.
- The package is used by golf-map (`D:\golf-map`): its tree editor, `scripts/trees.ts` and the Unity tree builds.
  A change to the generator's output changes golf-map's trees: say so in the commit.
- The catalogue's `index.ts` is written by `bun run package -- catalogue`; when adding a profile by hand, add it there.
- Everything in the repo is English. Chat with Marcus is in Swedish.
- No `Co-Authored-By` lines in commits.

## Checks before a commit

`bun run typecheck`, `bun run test`, `bun run build`. For a change to the writers, build a package
(`bun run package -- pine/full --out out`) and import it into a Unity project that has the NatureManufacture packs.
