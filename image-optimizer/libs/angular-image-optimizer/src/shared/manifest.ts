export interface ImageVariant {
  path: string;
}

export interface ImageEntry {
  originalWidth: number;
  originalHeight: number;
  placeholder: string; // base64 LQIP data URL
  variants: Record<number, ImageVariant>;
}

export interface ImageManifest {
  basePath: string;
  images: Record<string, ImageEntry>;
}

export function serializeManifest(manifest: ImageManifest): string {
  return `export default ${JSON.stringify(manifest, null, 2)};`;
}

export function createEmptyManifest(basePath: string): ImageManifest {
  return { basePath, images: {} };
}
