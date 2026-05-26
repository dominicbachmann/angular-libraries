import fg from 'fast-glob';
import path from 'path';

export interface ScannedImage {
  absolutePath: string;
  /**
   * Manifest key — the path relative to the glob base directory.
   * e.g. for pattern `src/assets/**\/*.jpg`, a file at `src/assets/images/hero.jpg`
   * produces key `images/hero.jpg`.
   */
  key: string;
}

export function getGlobBase(pattern: string): string {
  const parts = pattern.split('/');
  const firstGlobIdx = parts.findIndex((p) => /[*{?]/.test(p));
  return parts.slice(0, firstGlobIdx === -1 ? parts.length : firstGlobIdx).join('/');
}

export async function scanImages(root: string, patterns: string[]): Promise<ScannedImage[]> {
  const seen = new Set<string>();
  const results: ScannedImage[] = [];

  for (const pattern of patterns) {
    const base = getGlobBase(pattern);
    const absBase = path.resolve(root, base);
    const files = await fg(pattern, { cwd: root, absolute: true });

    for (const file of files) {
      if (seen.has(file)) continue;
      seen.add(file);
      const key = path.relative(absBase, file).replace(/\\/g, '/');
      results.push({ absolutePath: file, key });
    }
  }

  return results;
}

/**
 * Derive the output filename for a given image key and width.
 * `images/hero.jpg` at 640w → `images-hero-640w.webp`
 */
export function buildVariantFilename(key: string, width: number, format: 'webp' | 'avif'): string {
  const withoutExt = key.replace(/\.[^.]+$/, '');
  const sanitized = withoutExt.replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${sanitized}-${width}w.${format}`;
}

export function buildPlaceholderFilename(key: string): string {
  const withoutExt = key.replace(/\.[^.]+$/, '');
  const sanitized = withoutExt.replace(/\//g, '-').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${sanitized}-placeholder.webp`;
}
