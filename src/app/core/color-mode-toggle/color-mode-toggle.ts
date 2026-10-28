import { Component, inject } from '@angular/core';
import { CrsdColorModeService, CrsdSwitch, CrsdThemeService } from '@mentros/crsd-ui';

@Component({
  selector: 'app-color-mode-toggle',
  imports: [CrsdSwitch],
  template: `
    @if (!theme.isThemed()) {
      <crsd-switch
        variant="icon"
        size="sm"
        ariaLabel="Erscheinungsbild"
        offLabel="Hellmodus"
        onLabel="Dunkelmodus"
        checkedIcon="moon"
        uncheckedIcon="sun"
        [checked]="colorMode.isDark()"
        (checkedChange)="setDarkMode($event)"
      />
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 3.5rem;
      height: 1.75rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
    }
  `,
})
export class ColorModeToggle {
  protected readonly colorMode = inject(CrsdColorModeService);
  protected readonly theme = inject(CrsdThemeService);

  protected setDarkMode(enabled: boolean): void {
    this.colorMode.setMode(enabled ? 'dark' : 'light');
  }
}
