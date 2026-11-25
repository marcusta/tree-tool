# tree-tool

Procedural trees as Unity packages, built in the browser. Pick a species, a preset and a seed. You get a
`.unitypackage` with the tree's FBX (LODs), its two materials, and a prefab with an LOD group and GSPro colliders.
Nothing is uploaded: the tree, the FBX and the package are made in a web worker on your machine.

No licensed file ships with the tool. A species' materials link to the shader and textures of the pack the tree is
made for (NatureManufacture today) by GUID, so they resolve in a Unity project that has the pack. You can put your
own picture in any texture slot, and it goes into the package. You can also load a profile JSON for your own shader.

## Layout

| Path | What |
|---|---|
| `packages/trees` | `@tree-tool/trees`: the generator, the species and presets, the FBX / prefab / `.unitypackage` writers, the shader catalogue. TypeScript source, no dependencies; runs in Bun, Node and the browser. |
| `app` | The web page. A static site: `bun run build` writes `app/dist`. |
| `scripts/package.ts` | The same build from the command line, and the catalogue builder. |

## Commands

```sh
bun install
bun run dev          # the app at http://localhost:5190
bun run build        # app/dist, ready to deploy
bun run test         # the generator's tests
bun run typecheck
bun run package -- pine/full --out out --seed 1
bun run package -- catalogue --assets <Unity project with the packs>/Assets
```

## Deploy

`app/dist` is plain files with relative paths (`base: './'`). Serve it from any static host or any path on the VPS.
It makes no requests of its own.

## Shader catalogue

`packages/trees/export/catalogue/nm/<species>.json` holds the species' two materials: shader and texture GUIDs and
names, floats and colours, never a picture. Slots the pack cannot fill (pictures we made ourselves) are listed under
`needs`, and the app marks them as needed. `bun run package -- catalogue` writes the folder again from a Unity
project that has the packs, together with its `index.ts`.

## Origin

Split out of golf-map on 2026-11-25 (its `shared/trees` and the browser-export spike). golf-map's tree editor and its
Unity tree builds use the same generator; they are to take `@tree-tool/trees` as a dependency.
