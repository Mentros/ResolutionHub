import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { OverlayModule } from '@angular/cdk/overlay';
import localeDe from '@angular/common/locales/de';
import { provideCrsdTheme } from '@mentros/crsd-ui';
import { routes } from './app.routes';

registerLocaleData(localeDe);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'de' },
    provideBrowserGlobalErrorListeners(),
    importProvidersFrom(OverlayModule),
    provideCrsdTheme(),
    provideRouter(routes),
    provideHttpClient(),
  ],
};
