import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImageManifest } from '../shared/manifest';

const manifest: ImageManifest = {
  basePath: '/assets/optimized/',
  images: {
    'hero.jpg': {
      originalWidth: 1920,
      originalHeight: 1080,
      placeholder: 'data:image/webp;base64,LQIP',
      variants: {
        320: { path: 'hero-320w.webp' },
        640: { path: 'hero-640w.webp' },
        960: { path: 'hero-960w.webp' },
        1280: { path: 'hero-1280w.webp' },
        1920: { path: 'hero-1920w.webp' },
      },
    },
  },
};

vi.mock('virtual:ng-image-manifest', () => ({ default: manifest }));

// Import after mock is registered
const { createOptimizedImageLoader } = await import('./loader');

describe('createOptimizedImageLoader', () => {
  let loader: ReturnType<typeof createOptimizedImageLoader>;

  beforeEach(() => {
    loader = createOptimizedImageLoader();
  });

  it('returns the raw src for unknown images', () => {
    expect(loader({ src: 'unknown.jpg', width: 640 })).toBe('unknown.jpg');
  });

  it('returns the placeholder data URL when isPlaceholder is true', () => {
    expect(loader({ src: 'hero.jpg', isPlaceholder: true })).toBe('data:image/webp;base64,LQIP');
  });

  it('selects the smallest variant >= requested width', () => {
    expect(loader({ src: 'hero.jpg', width: 600 })).toBe('/assets/optimized/hero-640w.webp');
  });

  it('selects an exact-match variant width', () => {
    expect(loader({ src: 'hero.jpg', width: 960 })).toBe('/assets/optimized/hero-960w.webp');
  });

  it('falls back to the largest variant when requested width exceeds all variants', () => {
    expect(loader({ src: 'hero.jpg', width: 2560 })).toBe('/assets/optimized/hero-1920w.webp');
  });

  it('selects the smallest variant when width is 0', () => {
    expect(loader({ src: 'hero.jpg', width: 0 })).toBe('/assets/optimized/hero-320w.webp');
  });

  it('selects the smallest variant when width is undefined', () => {
    expect(loader({ src: 'hero.jpg' })).toBe('/assets/optimized/hero-320w.webp');
  });
});
