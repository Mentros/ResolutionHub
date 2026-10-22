import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { OverlayModule } from '@angular/cdk/overlay';
import { provideCrsdTheme } from '@mentros/crsd-ui';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    importProvidersFrom(OverlayModule),
    provideCrsdTheme(),
    provideRouter(routes),
    provideHttpClient(),
  ],
};
