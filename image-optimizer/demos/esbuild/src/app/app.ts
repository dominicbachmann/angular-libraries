import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ResponsiveImageDemo } from './responsive-image-demo/responsive-image-demo';

@Component({
  imports: [RouterModule, ResponsiveImageDemo],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  protected title = 'esbuild';
}
