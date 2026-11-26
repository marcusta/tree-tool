# tree-tool — AGENTS

Procedural trees as `.unitypackage` files, built in the browser. Start with [README.md](README.md).

## Rules

- `packages/trees` has no dependencies and no Node or DOM APIs outside its tests: the same code runs in Bun, in a
  web worker and in golf-map. Byte writers use `Uint8Array` and `CompressionStream`.
- A file goes into the repo, the app or a shared model only when its licence allows passing it on as a file:
  our own work, CC0, CC BY 4.0 or CC BY-SA 4.0 (the last two with author and source carried along). Never a file
  from an Asset Store pack (NatureManufacture, Forst), Fab / Quixel / Megascans, or anything CC BY-ND or CC BY-NC:
  those are referred to by GUID and name only, as the catalogue does. Pictures we drew (`packages/trees/atlas/`)
  are our own. Shared models live in the `tree-tool-models` repo, which states the same rule for contributors.
- The package is used by golf-map (`D:\golf-map`): its tree editor, `scripts/trees.ts` and the Unity tree builds.
  A change to the generator's output changes golf-map's trees: say so in the commit.
- The catalogue's `index.ts` is written by `bun run package -- catalogue`; when adding a profile by hand, add it there.
- Everything in the repo is English. Chat with Marcus is in Swedish.
- No `Co-Authored-By` lines in commits.

## Checks before a commit

`bun run typecheck`, `bun run test`, `bun run build`. For a change to the writers, build a package
(`bun run package -- pine/full --out out`) and import it into a Unity project that has the NatureManufacture packs.
