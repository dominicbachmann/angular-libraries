import { describe, it, expect } from 'vitest';
import { createEmptyManifest, serializeManifest } from './manifest';
import type { ImageManifest } from './manifest';

describe('createEmptyManifest', () => {
  it('creates a manifest with the correct basePath', () => {
    const manifest = createEmptyManifest('/assets/optimized/');
    expect(manifest.basePath).toBe('/assets/optimized/');
    expect(manifest.images).toEqual({});
  });
});

describe('serializeManifest', () => {
  it('produces valid ES module export syntax', () => {
    const manifest: ImageManifest = {
      basePath: '/assets/optimized/',
      images: {},
    };
    const output = serializeManifest(manifest);
    expect(output).toMatch(/^export default /);
  });

  it('round-trips through JSON correctly', () => {
    const manifest: ImageManifest = {
      basePath: '/assets/optimized/',
      images: {
        'hero.jpg': {
          originalWidth: 1920,
          originalHeight: 1080,
          placeholder: 'data:image/webp;base64,abc',
          variants: {
            640: { path: 'hero-640w.webp' },
            1280: { path: 'hero-1280w.webp' },
          },
        },
      },
    };

    const output = serializeManifest(manifest);
    // Strip the `export default ` prefix and trailing semicolon to parse
    const json = output.replace(/^export default /, '').replace(/;$/, '');
    const parsed = JSON.parse(json) as ImageManifest;

    expect(parsed).toEqual(manifest);
  });
});
