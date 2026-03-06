import { describe, it, expect } from 'vitest';
import { resolveOptions } from './options';

describe('resolveOptions', () => {
  it('returns defaults when no options are provided', () => {
    const result = resolveOptions({});
    expect(result.include).toEqual(['src/assets/**/*.{jpg,jpeg,png}']);
    expect(result.widths).toEqual([320, 640, 960, 1280, 1920]);
    expect(result.formats).toEqual(['webp']);
    expect(result.quality).toEqual({ webp: 85, avif: 80 });
    expect(result.outputDir).toBe('assets/optimized');
  });

  it('respects provided include patterns', () => {
    const result = resolveOptions({ include: ['public/**/*.png'] });
    expect(result.include).toEqual(['public/**/*.png']);
  });

  it('respects provided widths', () => {
    const result = resolveOptions({ widths: [400, 800] });
    expect(result.widths).toEqual([400, 800]);
  });

  it('respects provided formats', () => {
    const result = resolveOptions({ formats: ['avif'] });
    expect(result.formats).toEqual(['avif']);
  });

  it('respects provided quality', () => {
    const result = resolveOptions({ quality: { webp: 70, avif: 60 } });
    expect(result.quality).toEqual({ webp: 70, avif: 60 });
  });

  it('respects provided outputDir', () => {
    const result = resolveOptions({ outputDir: 'static/img' });
    expect(result.outputDir).toBe('static/img');
  });

  it('merges partial overrides with defaults for other fields', () => {
    const result = resolveOptions({ widths: [100, 200] });
    expect(result.formats).toEqual(['webp']);
    expect(result.outputDir).toBe('assets/optimized');
  });
});
