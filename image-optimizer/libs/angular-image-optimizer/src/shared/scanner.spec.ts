import { describe, it, expect } from 'vitest';
import { buildVariantFilename, buildPlaceholderFilename } from './scanner';

describe('buildVariantFilename', () => {
  it('converts a simple key to a flat filename', () => {
    expect(buildVariantFilename('hero.jpg', 640, 'webp')).toBe('hero-640w.webp');
  });

  it('replaces path separators with hyphens', () => {
    expect(buildVariantFilename('images/hero.jpg', 960, 'webp')).toBe('images-hero-960w.webp');
  });

  it('handles nested paths', () => {
    expect(buildVariantFilename('section/sub/photo.png', 320, 'avif')).toBe(
      'section-sub-photo-320w.avif'
    );
  });

  it('strips the original extension', () => {
    const result = buildVariantFilename('banner.jpeg', 1280, 'webp');
    expect(result).not.toContain('.jpeg');
    expect(result).toBe('banner-1280w.webp');
  });

  it('sanitizes special characters', () => {
    const result = buildVariantFilename('my image (1).jpg', 640, 'webp');
    expect(result).toMatch(/^[a-zA-Z0-9_-]+-640w\.webp$/);
  });
});

describe('buildPlaceholderFilename', () => {
  it('converts a simple key', () => {
    expect(buildPlaceholderFilename('hero.jpg')).toBe('hero-placeholder.webp');
  });

  it('replaces path separators with hyphens', () => {
    expect(buildPlaceholderFilename('images/hero.jpg')).toBe('images-hero-placeholder.webp');
  });

  it('strips the original extension', () => {
    const result = buildPlaceholderFilename('photo.png');
    expect(result).not.toContain('.png');
    expect(result).toBe('photo-placeholder.webp');
  });
});
