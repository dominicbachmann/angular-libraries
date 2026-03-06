# angular-image-optimizer — esbuild demo

Demonstrates build-time image optimization for Angular apps using the
`@angular-builders/custom-esbuild` builder.

## Setup

### 1. Install dependencies

```bash
npm install angular-image-optimizer
npm install -D @angular-builders/custom-esbuild
```

### 2. Switch to the custom builder

In `project.json` (or `angular.json`), replace both the `build` and `serve`
executors. The dev server inherits `plugins` from the build target automatically.

```json
"build": {
  "executor": "@angular-builders/custom-esbuild:application",
  "options": {
    "plugins": ["./plugins.js"]
  }
},
"serve": {
  "executor": "@angular-builders/custom-esbuild:dev-server"
}
```

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

By default the plugin generates `webp` variants at widths `320, 640, 960, 1280, 1920`.

### 4. Provide the image loader

In `app.config.ts`, register the loader so `NgOptimizedImage` uses the
optimized variants:

```ts
import { provideImageOptimizerLoader } from 'angular-image-optimizer/angular';

export const appConfig: ApplicationConfig = {
  providers: [provideImageOptimizerLoader()],
};
```

### 5. Use `NgOptimizedImage` in templates

```html
<img ngSrc="hero.jpg" width="960" height="640" placeholder />
```

The `ngSrc` value must match the filename relative to the `include` glob base
(e.g. `src/assets/hero.jpg` → `hero.jpg`).
