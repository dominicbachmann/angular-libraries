import { ngImageOptimizerEsbuild } from 'angular-image-optimizer/esbuild';

export default [
  ngImageOptimizerEsbuild({
    include: ['image-optimizer/demos/esbuild-ssr/src/assets/**/*.{jpg,jpeg,png}'],
  }),
];
