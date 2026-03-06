import { ngImageOptimizerEsbuild } from 'angular-image-optimizer/esbuild';

export default [
  ngImageOptimizerEsbuild({
    include: ['image-optimizer/demos/esbuild/src/assets/**/*.{jpg,jpeg,png}'],
  }),
];
