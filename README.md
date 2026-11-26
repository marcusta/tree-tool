# tree-tool

Procedural trees as Unity packages, built in the browser: <https://marcusta.github.io/tree-tool/>.

Pick a species, a preset and a seed, and shape the tree with the sliders while it is drawn beside them. You get a
`.unitypackage` with the tree's FBX (LODs), its two materials, and a prefab with an LOD group and GSPro colliders.
Nothing is uploaded: the tree, the FBX and the package are made in your browser.

The tool ships only files whose licence allows passing them on (our own work, CC0, CC BY, CC BY-SA). Files from
paid packs never ship: a species' materials link to the shader and textures of the pack the tree is made for
(NatureManufacture today) by GUID, so they resolve in a Unity project that has the pack. You can put your
own picture in any texture slot, and it goes into the package. You can also load a profile JSON for your own shader.

## The page

- **Tree**: species, preset, seed, level of detail, and the sliders in four groups. The page's address always holds
  the tree (`#species=pine&preset=windswept&seed=7&limbs.windBias=0.6`), so **Copy link** shares it: the same
  settings build the same tree everywhere.
- **Shared models**: the trees in [tree-tool-models](https://github.com/marcusta/tree-tool-models). A model brings
  its settings, and its own pictures and shader profile when it has them; its credits go into the package as
  `CREDITS.txt`.
- **Shader and textures**: each slot of the two materials, linked into the pack, left empty, or holding a picture.
  Slots a species fills with an atlas drawn in this repo get it on their own.
- **Unity package**: builds and downloads `Assets/TreeTool/<tree id>/`.
- **Share this tree with everyone**: name, author, licence and source; **Check and prepare** runs the same check as
  the models repo's pull requests, renders `preview.png`, and leads to GitHub's upload page for the new folder.

The preview is three.js: shape and branching read true, colour does not. A leaf picture that lives in a pack is
drawn with stand-in leaves or needles.

## Layout

| Path | What |
|---|---|
| `packages/trees` | `@tree-tool/trees`: the generator, the species and presets, the sliders, the FBX / prefab / `.unitypackage` writers, the shader catalogue, and the shared-model format and check (`models.ts`). TypeScript source, no dependencies; `bun run build:package` builds `dist/` (ES modules + declarations) for users outside the repo. The app reads the source (export condition `source`). |
| `app` | The web page (three.js for the preview). A static site: `bun run build` writes `app/dist`. |
| `scripts/package.ts` | The same build from the command line, and the catalogue builder. |
| `scripts/models.ts` | `check` and `index` for a models folder: what the models repo's workflow runs. |

## Commands

```sh
bun install
bun run dev          # the app at http://localhost:5190
bun run build        # app/dist, ready to deploy
bun run test         # the generator's and the model check's tests
bun run typecheck
bun run package -- pine/full --out out --seed 1
bun run package -- catalogue --assets <Unity project with the packs>/Assets
bun scripts/models.ts check ../tree-tool-models/models
```

`VITE_MODELS_URL` (default `https://marcusta.github.io/tree-tool-models/`) and `VITE_MODELS_REPO` (default
`marcusta/tree-tool-models`) point the app at another models site and repo.

## Deploy

`app/dist` is plain files with relative paths (`base: './'`). Serve it from any static host or any path on the VPS.
Every push to `main` checks, builds and publishes it on GitHub Pages (`.github/workflows/pages.yml`). Its only
requests go to the models site.

## Shared models

[tree-tool-models](https://github.com/marcusta/tree-tool-models) holds one folder per model (`model.json`,
`preview.png`, the model's own pictures and shader profile) and states the licence rule for contributors. Its
workflow checks every pull request with `scripts/models.ts check` from this repo, and on `main` publishes
`index.json` and the folders on its own GitHub Pages site, which the app reads.

## Shader catalogue

`packages/trees/export/catalogue/nm/<species>.json` holds the species' two materials: shader and texture GUIDs and
names, floats and colours, never a picture. Slots the pack cannot fill (pictures we made ourselves) are listed under
`needs`, and the app marks them as needed. `bun run package -- catalogue` writes the folder again from a Unity
project that has the packs, together with its `index.ts`.

## Origin

Split out of golf-map on 2026-11-25 (its `shared/trees` and the browser-export spike). golf-map's tree editor and its
Unity tree builds take `@tree-tool/trees` as a dependency (a vendored tarball, `bun run trees:update` there).
