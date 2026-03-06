import path from 'path';
import type { Plugin as EsbuildPlugin } from 'esbuild';
import { VIRTUAL_MODULE_ID } from '../shared/virtual-module';
import { resolveOptions } from '../shared/options';
import type { NgImageOptimizerOptions } from '../shared/options';
import { buildImageAssets } from '../shared/build';
import type { ImageManifest } from '../shared/manifest';

export type { NgImageOptimizerOptions } from '../shared/options';
export type { ImageManifest, ImageEntry, ImageVariant } from '../shared/manifest';

const MANIFEST_FILTER = new RegExp(`^${VIRTUAL_MODULE_ID}$`);
const MANIFEST_NAMESPACE = 'ng-image-manifest';
const ASSET_NAMESPACE = 'ng-image-asset';
const ASSET_PREFIX = 'ng-img:';

/** Converts a filename into a valid JS identifier, e.g. `hero-640w.webp` → `_hero_640w_webp` */
function toVarName(filename: string): string {
  return '_' + filename.replace(/[^a-zA-Z0-9]/g, '_');
}

/** Generates a JS module that imports each image variant through esbuild's asset pipeline.
 *  esbuild resolves the imports with loader:'file', applying assetNames (including [hash]),
 *  and the variable values become the hashed URLs at bundle time. */
function generateManifestModule(manifest: ImageManifest): string {
  const imports: string[] = [];
  const imageEntries: string[] = [];

  for (const [key, entry] of Object.entries(manifest.images)) {
    const variantEntries: string[] = [];

    for (const [width, variant] of Object.entries(entry.variants)) {
      const varName = toVarName(variant.path);
      imports.push(`import ${varName} from ${JSON.stringify(ASSET_PREFIX + variant.path)};`);
      variantEntries.push(`        ${JSON.stringify(width)}: { path: ${varName} }`);
    }

    imageEntries.push(
      [
        `    ${JSON.stringify(key)}: {`,
        `      originalWidth: ${entry.originalWidth},`,
        `      originalHeight: ${entry.originalHeight},`,
        `      placeholder: ${JSON.stringify(entry.placeholder)},`,
        `      variants: {`,
        variantEntries.join(',\n'),
        `      }`,
        `    }`,
      ].join('\n')
    );
  }

  return [
    ...imports,
    '',
    'export default {',
    `  basePath: '',`,
    '  images: {',
    imageEntries.join(',\n'),
    '  }',
    '};',
  ].join('\n');
}

/**
 * Generates a manifest module for server (Node.js) builds.
 *
 * The browser build's `loader: 'file'` produces root-relative URL strings (e.g.
 * `/mountain-640w.ABCDEF.webp`). In a Node.js build, `loader: 'file'` instead
 * produces Node.js-style file paths, which are not valid browser URLs.
 *
 * This function embeds the pre-resolved browser URLs as plain string literals so
 * the server's IMAGE_LOADER returns the same URLs the browser bundle uses.
 * Falls back to `/<plainFilename>` when the browser build has not yet populated
 * the hashed paths (e.g. parallel builds).
 */
function generateServerManifestModule(
  manifest: ImageManifest,
  hashedPaths: Map<string, string>
): string {
  const imageEntries: string[] = [];

  for (const [key, entry] of Object.entries(manifest.images)) {
    const variantEntries: string[] = [];

    for (const [width, variant] of Object.entries(entry.variants)) {
      const resolvedPath = hashedPaths.get(variant.path) ?? '/' + variant.path;
      variantEntries.push(
        `        ${JSON.stringify(width)}: { path: ${JSON.stringify(resolvedPath)} }`
      );
    }

    imageEntries.push(
      [
        `    ${JSON.stringify(key)}: {`,
        `      originalWidth: ${entry.originalWidth},`,
        `      originalHeight: ${entry.originalHeight},`,
        `      placeholder: ${JSON.stringify(entry.placeholder)},`,
        `      variants: {`,
        variantEntries.join(',\n'),
        `      }`,
        `    }`,
      ].join('\n')
    );
  }

  return [
    'export default {',
    `  basePath: '',`,
    '  images: {',
    imageEntries.join(',\n'),
    '  }',
    '};',
  ].join('\n');
}

export function ngImageOptimizerEsbuild(options: NgImageOptimizerOptions = {}): EsbuildPlugin {
  const opts = resolveOptions(options);

  let imageBuffers = new Map<string, Buffer>();
  let manifest: ImageManifest = { basePath: '', images: {} };

  // Maps plain variant filename → browser URL (e.g. 'mountain-640w.webp' → '/mountain-640w.ABCDEF.webp').
  // Populated by the browser build's onEnd hook; consumed by the server build's onLoad.
  // Both builds share this Map via the plugin closure since Angular runs them sequentially
  // (browser first) using the same plugin instance.
  const hashedVariantPaths = new Map<string, string>();

  return {
    name: 'ng-image-optimizer-esbuild',

    setup(build) {
      const isServerBuild = build.initialOptions.platform === 'node';

      // Enable metafile for the browser build so onEnd can extract the hashed output filenames.
      if (!isServerBuild) {
        build.initialOptions.metafile = true;
      }

      build.onStart(async () => {
        const root = build.initialOptions.absWorkingDir ?? process.cwd();
        const assets = await buildImageAssets(root, '', opts);
        manifest = assets.manifest;
        imageBuffers = assets.imageBuffers;
      });

      build.onResolve({ filter: MANIFEST_FILTER }, (args) => ({
        path: args.path,
        namespace: MANIFEST_NAMESPACE,
      }));

      // Resolve virtual image asset imports (emitted from within the browser manifest module)
      build.onResolve({ filter: /^ng-img:/ }, (args) => ({
        path: args.path.slice(ASSET_PREFIX.length),
        namespace: ASSET_NAMESPACE,
      }));

      // Serve processed image buffers through esbuild's asset pipeline (browser builds only).
      // loader:'file' makes esbuild apply assetNames (including [hash]) and return the URL.
      // Not used for server builds — the server manifest embeds the URLs as string literals.
      build.onLoad({ filter: /.*/, namespace: ASSET_NAMESPACE }, (args) => {
        if (isServerBuild) return null;
        const buffer = imageBuffers.get(args.path);
        if (!buffer) return null;
        return { contents: buffer, loader: 'file' };
      });

      // Generate the manifest JS module.
      // Browser: imports each variant via loader:'file' so esbuild applies assetNames hashing.
      // Server:  embeds the browser URLs as string literals to avoid Node.js file-path resolution.
      build.onLoad({ filter: /.*/, namespace: MANIFEST_NAMESPACE }, () => {
        if (isServerBuild) {
          return {
            contents: generateServerManifestModule(manifest, hashedVariantPaths),
            loader: 'js',
          };
        }
        return {
          contents: generateManifestModule(manifest),
          loader: 'js',
        };
      });

      // After the browser build finishes, extract the actual output URL for each image asset
      // (including any content hash applied by assetNames) so the server build can use them.
      if (!isServerBuild) {
        build.onEnd((result) => {
          if (!result.metafile) return;

          const absWorkingDir = build.initialOptions.absWorkingDir ?? process.cwd();
          const outdir = build.initialOptions.outdir ?? '.';
          const absOutdir = path.resolve(absWorkingDir, outdir);
          const publicPath = build.initialOptions.publicPath ?? '/';
          const prefix = publicPath.endsWith('/') ? publicPath : publicPath + '/';

          for (const [outputPath, output] of Object.entries(result.metafile.outputs)) {
            for (const inputKey of Object.keys(output.inputs ?? {})) {
              if (inputKey.startsWith(`${ASSET_NAMESPACE}:`)) {
                const plainName = inputKey.slice(ASSET_NAMESPACE.length + 1);
                const absOutputPath = path.resolve(absWorkingDir, outputPath);
                const relToOutdir = path.relative(absOutdir, absOutputPath).replace(/\\/g, '/');
                hashedVariantPaths.set(plainName, prefix + relToOutdir);
              }
            }
          }
        });
      }
    },
  };
}
