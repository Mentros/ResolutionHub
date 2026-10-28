import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import {
  APP_INITIALIZER,
  ApplicationConfig,
  importProvidersFrom,
  inject,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { OverlayModule } from '@angular/cdk/overlay';
import localeDe from '@angular/common/locales/de';
import { CrsdColorModeService, CrsdThemeService, provideCrsdTheme } from '@mentros/crsd-ui';
import { routes } from './app.routes';

registerLocaleData(localeDe);

/** Resolution Hub uses the default palette; ignore cursed/blessed from crsd-ui docs localStorage. */
function initCrsdAppearance(): () => void {
  return () => {
    const theme = inject(CrsdThemeService);
    const colorMode = inject(CrsdColorModeService);
    theme.setTheme('default');
    colorMode.setMode(colorMode.mode());
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'de' },
    provideBrowserGlobalErrorListeners(),
    importProvidersFrom(OverlayModule),
    provideCrsdTheme(),
    { provide: APP_INITIALIZER, multi: true, useFactory: initCrsdAppearance },
    provideRouter(routes),
    provideHttpClient(),
  ],
};
