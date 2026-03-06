import sharp from 'sharp';

export interface QualityOptions {
  webp?: number;
  avif?: number;
}

export async function getImageMetadata(
  filePath: string
): Promise<{ width: number; height: number }> {
  const meta = await sharp(filePath).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

export async function resizeImage(
  filePath: string,
  width: number,
  format: 'webp' | 'avif',
  quality: QualityOptions = {}
): Promise<Buffer> {
  const q = format === 'webp' ? (quality.webp ?? 85) : (quality.avif ?? 80);
  const pipeline = sharp(filePath).resize(width, null, { withoutEnlargement: true });

  if (format === 'webp') {
    return pipeline.webp({ quality: q }).toBuffer();
  }
  return pipeline.avif({ quality: q }).toBuffer();
}

/** Generate a Low Quality Image Placeholder as a base64 data URL. */
export async function generateLqip(filePath: string): Promise<string> {
  const buffer = await sharp(filePath)
    .resize(20, null, { withoutEnlargement: true })
    .webp({ quality: 20 })
    .toBuffer();
  return `data:image/webp;base64,${buffer.toString('base64')}`;
}
