import type { QualityOptions } from './processor';

export interface ResolvedOptions {
  include: string[];
  widths: number[];
  formats: ('webp' | 'avif')[];
  quality: QualityOptions;
  outputDir: string;
}

export function resolveOptions(options: NgImageOptimizerOptions): ResolvedOptions {
  return {
    include: options.include ?? ['src/assets/**/*.{jpg,jpeg,png}'],
    widths: options.widths ?? [320, 640, 960, 1280, 1920],
    formats: options.formats ?? ['webp'],
    quality: options.quality ?? { webp: 85, avif: 80 },
    outputDir: options.outputDir ?? 'assets/optimized',
  };
}


export interface NgImageOptimizerOptions {
  /**
   * Glob patterns (relative to project root) for source images.
   * @default ['src/assets/**\/*.{jpg,jpeg,png}']
   */
  include?: string[];
  /**
   * Pixel widths to generate for each image.
   * @default [320, 640, 960, 1280, 1920]
   */
  widths?: number[];
  /**
   * Output formats to generate.
   * @default ['webp']
   */
  formats?: ('webp' | 'avif')[];
  /** Per-format encoding quality. */
  quality?: QualityOptions;
  /**
   * Output directory path within the build output / public dir.
   * @default 'assets/optimized'
   */
  outputDir?: string;
}
