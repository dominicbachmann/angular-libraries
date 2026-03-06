import { scanImages, buildVariantFilename, buildPlaceholderFilename } from './scanner';
import type { ScannedImage } from './scanner';
import { getImageMetadata, resizeImage, generateLqip } from './processor';
import { createEmptyManifest } from './manifest';
import type { ImageManifest } from './manifest';
import type { ResolvedOptions } from './options';

export interface ImageAssets {
  manifest: ImageManifest;
  /** Buffers keyed by output filename only (without outputDir prefix). */
  imageBuffers: Map<string, Buffer>;
  scannedImages: ScannedImage[];
}

export async function buildImageAssets(
  root: string,
  basePath: string,
  opts: ResolvedOptions
): Promise<ImageAssets> {
  const { include, widths, formats, quality } = opts;
  const primaryFormat = formats[0] ?? 'webp';

  const manifest = createEmptyManifest(basePath);
  const imageBuffers = new Map<string, Buffer>();
  const scannedImages = await scanImages(root, include);

  await Promise.all([
    ...scannedImages.map(async ({ absolutePath, key }) => {
      const [{ width, height }, placeholder] = await Promise.all([
        getImageMetadata(absolutePath),
        generateLqip(absolutePath),
      ]);

      const variants: Record<number, { path: string }> = {};

      await Promise.all(
        widths.map(async (w) => {
          const buffer = await resizeImage(absolutePath, w, primaryFormat, quality);
          const filename = buildVariantFilename(key, w, primaryFormat);
          variants[w] = { path: filename };
          imageBuffers.set(filename, buffer);
        })
      );

      manifest.images[key] = { originalWidth: width, originalHeight: height, placeholder, variants };
    }),
    ...scannedImages.map(async ({ absolutePath, key }) => {
      const buffer = await resizeImage(absolutePath, 20, 'webp', { webp: 20 });
      imageBuffers.set(buildPlaceholderFilename(key), buffer);
    }),
    ...formats.slice(1).flatMap((fmt) =>
      scannedImages.flatMap(({ absolutePath, key }) =>
        widths.map(async (w) => {
          const buffer = await resizeImage(absolutePath, w, fmt, quality);
          imageBuffers.set(buildVariantFilename(key, w, fmt), buffer);
        })
      )
    ),
  ]);

  return { manifest, imageBuffers, scannedImages };
}
