/// <reference types='vitest' />
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import * as fs from 'fs';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir:
    '../../../node_modules/.vite/image-optimizer/libs/angular-image-optimizer',
  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    {
      name: 'emit-virtual-modules-dts',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'virtual-modules.d.ts',
          source: fs.readFileSync(
            path.join(import.meta.dirname, 'src/virtual-modules.d.ts'),
            'utf-8'
          ),
        });
      },
    },
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
      pathsToAliases: false,
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: '../../../dist/image-optimizer/libs/angular-image-optimizer',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: {
        'esbuild/index': 'src/esbuild/index.ts',
        'angular/index': 'src/angular/index.ts',
      },
      formats: ['es' as const],
    },
    rollupOptions: {
      external: [
        /^@angular\//,
        'esbuild',
        'sharp',
        'fast-glob',
        'crypto',
        'path',
        'node:fs/promises',
        'virtual:ng-image-manifest',
      ],
    },
  },
  test: {
    name: 'angular-image-optimizer',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory:
        '../../../coverage/image-optimizer/libs/angular-image-optimizer',
      provider: 'v8' as const,
    },
  },
}));
