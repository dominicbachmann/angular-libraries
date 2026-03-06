declare module 'virtual:ng-image-manifest' {
  interface ImageVariant {
    path: string;
  }

  interface ImageEntry {
    originalWidth: number;
    originalHeight: number;
    /** Base64-encoded LQIP data URL (`data:image/webp;base64,...`). */
    placeholder: string;
    variants: Record<number, ImageVariant>;
  }

  interface ImageManifest {
    /** URL prefix for variant files, e.g. `/assets/optimized/`. */
    basePath: string;
    images: Record<string, ImageEntry>;
  }

  const manifest: ImageManifest;
  export default manifest;
}
