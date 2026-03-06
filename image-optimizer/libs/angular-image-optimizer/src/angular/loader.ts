import type { ImageLoader, ImageLoaderConfig } from '@angular/common';
import manifest from 'virtual:ng-image-manifest';

export function createOptimizedImageLoader(): ImageLoader {
  return (config: ImageLoaderConfig): string => {
    const entry = manifest.images[config.src];

    if (!entry) {
      // Unknown image — fall back to the raw src so NgOptimizedImage still works.
      return config.src;
    }

    if (config.isPlaceholder) {
      return entry.placeholder;
    }

    const requestedWidth = config.width ?? 0;
    const availableWidths = Object.keys(entry.variants)
      .map(Number)
      .sort((a, b) => a - b);

    // Serve the smallest variant that is >= the requested width.
    // Fall back to the largest variant if nothing is wide enough.
    const bestWidth =
      availableWidths.find((w) => w >= requestedWidth) ??
      availableWidths[availableWidths.length - 1];

    return `${manifest.basePath}${entry.variants[bestWidth].path}`;
  };
}
