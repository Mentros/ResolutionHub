import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ColorModeToggle } from './core/color-mode-toggle/color-mode-toggle';
import { appShell } from './core/crsd-ui';
import { GlobalSearch } from './core/global-search/global-search';
import { ThemeToggle } from './core/theme-toggle/theme-toggle';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, GlobalSearch, ThemeToggle, ColorModeToggle],
  templateUrl: './app.html',
})
export class App {
  protected readonly headerBar = `${appShell} flex w-full items-center gap-3 py-3 sm:gap-5`;
  protected readonly mainContent = `${appShell} py-8 pb-16`;
}
