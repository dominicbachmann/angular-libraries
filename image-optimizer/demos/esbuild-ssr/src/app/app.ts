import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ResponsiveImageDemo } from './responsive-image-demo/responsive-image-demo';

@Component({
  imports: [ResponsiveImageDemo, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'esbuild-ssr';
}
