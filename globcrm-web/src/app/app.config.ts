import { APP_INITIALIZER, ApplicationConfig, inject, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimationsAsync(),
    provideCharts(withDefaultRegisterables()),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const authService = inject(AuthService);
        return () => authService.initializeAuth();
      },
      multi: true,
    },
  ],
};
