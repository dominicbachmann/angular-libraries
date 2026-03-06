# angular-image-optimizer

Build-time image optimization for Angular. Generates multi-width WebP/AVIF variants at build time and wires them into Angular's `NgOptimizedImage` directive via a custom `IMAGE_LOADER`.

## Installation

```bash
npm install angular-image-optimizer
```

The package ships three entry points:

| Entry point                       | Contents                                           |
| --------------------------------- | -------------------------------------------------- |
| `angular-image-optimizer/angular` | `provideImageOptimizerLoader()` — Angular provider |
| `angular-image-optimizer/esbuild` | `ngImageOptimizerEsbuild()` — esbuild plugin       |

## Setup with esbuild (Angular CLI)

### 1. Install `@angular-builders/custom-esbuild`

```bash
npm install -D @angular-builders/custom-esbuild
```

### 2. Switch builders

In `angular.json`, replace the `build` and `serve` builders:

```json
"build": {
  "builder": "@angular-builders/custom-esbuild:application",
  "options": {
    "plugins": ["./plugins.js"]
  }
},
"serve": {
  "builder": "@angular-builders/custom-esbuild:dev-server",
  "options": {
    "prebundle": {
      "exclude": ["angular-image-optimizer"]
    }
  }
}
```

> **Nx users:** use `"executor"` instead of `"builder"` in `project.json`.

### 3. Register the plugin

Create `plugins.js` at the project root:

```js
import { ngImageOptimizerEsbuild } from 'angular-image-optimizer/esbuild';

export default [
  ngImageOptimizerEsbuild({
    include: ['src/assets/**/*.{jpg,jpeg,png}'],
  }),
];
```

### 4. Provide the image loader

In `app.config.ts`:

```ts
import { provideImageOptimizerLoader } from 'angular-image-optimizer/angular';

export const appConfig: ApplicationConfig = {
  providers: [provideImageOptimizerLoader()],
};
```

---

## Using `NgOptimizedImage` in templates

```html
<!-- Fixed size -->
<img ngSrc="hero.jpg" width="960" height="640" placeholder />

<!-- Fill mode -->
<div style="position:relative; aspect-ratio:3/2">
  <img ngSrc="hero.jpg" fill priority placeholder alt="Hero" />
</div>

<!-- Responsive with sizes -->
<img ngSrc="hero.jpg" width="960" height="640" sizes="(max-width: 960px) 100vw, 50vw" placeholder alt="Hero" />
```

The `ngSrc` value must match the image filename relative to the glob base
(e.g. `src/assets/hero.jpg` → `hero.jpg`).

## Plugin options

All options are optional.

| Option      | Type                               | Default                              | Description                                                |
| ----------- | ---------------------------------- | ------------------------------------ | ---------------------------------------------------------- |
| `include`   | `string[]`                         | `['src/assets/**/*.{jpg,jpeg,png}']` | Glob patterns (relative to project root) for source images |
| `widths`    | `number[]`                         | `[320, 640, 960, 1280, 1920]`        | Pixel widths to generate for each image                    |
| `formats`   | `('webp' \| 'avif')[]`             | `['webp']`                           | Output formats to generate                                 |
| `quality`   | `{ webp?: number; avif?: number }` | `{ webp: 85, avif: 80 }`             | Per-format encoding quality                                |
| `outputDir` | `string`                           | `'assets/optimized'`                 | Output directory within the build output / public dir      |

## Troubleshooting

### `Could not resolve "virtual:ng-image-manifest"` during `ng serve`

Angular's Vite dev server pre-bundles dependencies with its own esbuild instance, which does not include the `ngImageOptimizerEsbuild` plugin. When it scans `angular-image-optimizer/angular`, it finds the `virtual:ng-image-manifest` import and fails.

Fix: exclude `angular-image-optimizer` from Vite's pre-bundler so Angular's esbuild step (which does have the plugin) handles it instead. Add `prebundle.exclude` to the `serve` target — see step 2 above.

---

## Development

```bash
# Build & test the library
npx nx build angular-image-optimizer
npx nx test angular-image-optimizer

# Serve demo apps
npx nx serve image-optimizer/demos/esbuild
npx nx serve image-optimizer/demos/esbuild-ssr
```
