import { Component, inject } from '@angular/core';
import { CrsdColorModeService, CrsdSwitch } from '@mentros/crsd-ui';

@Component({
  selector: 'app-color-mode-toggle',
  imports: [CrsdSwitch],
  template: `
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
  `,
  styles: ':host { display: inline-flex; }',
})
export class ColorModeToggle {
  protected readonly colorMode = inject(CrsdColorModeService);

  protected setDarkMode(enabled: boolean): void {
    this.colorMode.setMode(enabled ? 'dark' : 'light');
  }
}
