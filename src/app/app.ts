import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Animation } from './animation/animation';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet,Animation],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Animator');
}
