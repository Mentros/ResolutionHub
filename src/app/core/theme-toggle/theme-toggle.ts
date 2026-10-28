import { Component, computed, inject } from '@angular/core';
import { CrsdBtn, CrsdIcon, CrsdThemeService } from '@mentros/crsd-ui';
import type { CrsdIconName } from '@mentros/crsd-ui';

@Component({
  selector: 'app-theme-toggle',
  imports: [CrsdBtn, CrsdIcon],
  template: `
    <button
      type="button"
      crsdBtn
      variant="ghost"
      size="sm"
      class="inline-flex h-9 shrink-0 capitalize"
      [attr.aria-pressed]="theme.isThemed()"
      [attr.aria-label]="'Design wechseln (' + label() + ')'"
      (click)="theme.toggle()"
    >
      <crsd-icon [name]="icon()" size="xs" aria-hidden="true" />
      <span class="hidden sm:inline">{{ label() }}</span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 2.25rem;
      flex-shrink: 0;
      align-items: center;
      justify-content: center;
    }
    @media (min-width: 640px) {
      :host {
        width: 6.75rem;
      }
    }
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(CrsdThemeService);

  protected readonly label = computed(() => {
    switch (this.theme.theme()) {
      case 'cursed':
        return 'Cursed';
      case 'blessed':
        return 'Blessed';
      default:
        return 'Standard';
    }
  });

  protected readonly icon = computed((): CrsdIconName => {
    switch (this.theme.theme()) {
      case 'blessed':
        return 'heart';
      case 'cursed':
        return 'star';
      default:
        return 'alert-triangle';
    }
  });
}
