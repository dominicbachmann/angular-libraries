import path from 'path';
import fs from 'node:fs/promises';
import type { Plugin as EsbuildPlugin } from 'esbuild';
import { VIRTUAL_MODULE_ID } from '../shared/virtual-module';
import { resolveOptions } from '../shared/options';
import type { NgImageOptimizerOptions } from '../shared/options';
import {
  scanImages,
  buildVariantFilename,
  buildPlaceholderFilename,
  getGlobBase,
} from '../shared/scanner';
import type { ScannedImage } from '../shared/scanner';
import { getImageMetadata, resizeImage, generateLqip } from '../shared/processor';
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

type VariantSpec =
  | { kind: 'variant'; absolutePath: string; width: number; format: 'webp' | 'avif' }
  | { kind: 'placeholder'; absolutePath: string };

interface CachedMeta {
  mtimeMs: number;
  originalWidth: number;
  originalHeight: number;
  placeholder: string;
}

export function ngImageOptimizerEsbuild(options: NgImageOptimizerOptions = {}): EsbuildPlugin {
  const opts = resolveOptions(options);

  // metaCache is mtime-gated as a backstop in case esbuild ever invalidates
  // the manifest for an unrelated reason; the primary cache is esbuild's own
  // per-input result cache, driven by the `watchFiles` returned below.
  const metaCache = new Map<string, CachedMeta>();
  const variantSpecs = new Map<string, VariantSpec>();
  const hashedVariantPaths = new Map<string, string>();

  let scannedImages: ScannedImage[] = [];
  let scanRoots: string[] = [];

  async function ensureMeta(absPath: string): Promise<CachedMeta> {
    const stat = await fs.stat(absPath);
    const cached = metaCache.get(absPath);
    if (cached && cached.mtimeMs === stat.mtimeMs) return cached;
    const [{ width, height }, placeholder] = await Promise.all([
      getImageMetadata(absPath),
      generateLqip(absPath),
    ]);
    const meta: CachedMeta = {
      mtimeMs: stat.mtimeMs,
      originalWidth: width,
      originalHeight: height,
      placeholder,
    };
    metaCache.set(absPath, meta);
    return meta;
  }

  return {
    name: 'ng-image-optimizer-esbuild',

    setup(build) {
      const isServerBuild = build.initialOptions.platform === 'node';

      // Enable metafile for the browser build so onEnd can extract the hashed output filenames.
      if (!isServerBuild) {
        build.initialOptions.metafile = true;
      }

      // Cheap: discover image files only. No metadata, no LQIP, no encoding.
      build.onStart(async () => {
        const root = build.initialOptions.absWorkingDir ?? process.cwd();
        scannedImages = await scanImages(root, opts.include);
        scanRoots = opts.include.map((p) => path.resolve(root, getGlobBase(p)));
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

      // Generate the manifest JS module.
      // Browser: imports each variant via loader:'file' so esbuild applies assetNames hashing.
      // Server:  embeds the browser URLs as string literals to avoid Node.js file-path resolution.
      // Re-invoked only when a watched source image (or scan dir) changes.
      build.onLoad({ filter: /.*/, namespace: MANIFEST_NAMESPACE }, async () => {
        variantSpecs.clear();

        const manifest: ImageManifest = { basePath: '', images: {} };
        const { widths, formats } = opts;
        const primaryFormat = formats[0] ?? 'webp';

        await Promise.all(
          scannedImages.map(async ({ absolutePath, key }) => {
            const meta = await ensureMeta(absolutePath);
            const variants: Record<number, { path: string }> = {};

            for (const w of widths) {
              const filename = buildVariantFilename(key, w, primaryFormat);
              variants[w] = { path: filename };
              variantSpecs.set(filename, {
                kind: 'variant',
                absolutePath,
                width: w,
                format: primaryFormat,
              });
            }
            for (const fmt of formats.slice(1)) {
              for (const w of widths) {
                const filename = buildVariantFilename(key, w, fmt);
                variantSpecs.set(filename, { kind: 'variant', absolutePath, width: w, format: fmt });
              }
            }
            variantSpecs.set(buildPlaceholderFilename(key), { kind: 'placeholder', absolutePath });

            manifest.images[key] = {
              originalWidth: meta.originalWidth,
              originalHeight: meta.originalHeight,
              placeholder: meta.placeholder,
              variants,
            };
          })
        );

        const contents = isServerBuild
          ? generateServerManifestModule(manifest, hashedVariantPaths)
          : generateManifestModule(manifest);

        return {
          contents,
          loader: 'js',
          watchFiles: scannedImages.map((i) => i.absolutePath),
          watchDirs: scanRoots,
        };
      });

      // Serve processed image buffers through esbuild's asset pipeline (browser builds only).
      // esbuild caches the result per input id; watchFiles tells it to invalidate only when
      // the source image actually changes, so unchanged variants are not re-encoded.
      build.onLoad({ filter: /.*/, namespace: ASSET_NAMESPACE }, async (args) => {
        if (isServerBuild) return null;

        const spec = variantSpecs.get(args.path);
        if (!spec) return null;

        const buffer =
          spec.kind === 'placeholder'
            ? await resizeImage(spec.absolutePath, 20, 'webp', { webp: 20 })
            : await resizeImage(spec.absolutePath, spec.width, spec.format, opts.quality);

        return {
          contents: buffer,
          loader: 'file',
          watchFiles: [spec.absolutePath],
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
