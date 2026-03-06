/// <reference path="../virtual-modules.d.ts" />
import { IMAGE_LOADER } from '@angular/common';
import { makeEnvironmentProviders } from '@angular/core';
import { createOptimizedImageLoader } from './loader';

/**
 * Registers the optimized image loader with Angular's `NgOptimizedImage`.
 *
 * Add to your `ApplicationConfig` providers array:
 *
 * ```ts
 * import { provideImageOptimizerLoader } from 'angular-image-optimizer/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [provideImageOptimizerLoader()],
 * };
 * ```
 */
export function provideImageOptimizerLoader() {
  return makeEnvironmentProviders([
    {
      provide: IMAGE_LOADER,
      useValue: createOptimizedImageLoader(),
    },
  ]);
}
