import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string) {
    // Transloco passes scoped translations as 'scope/lang' (e.g. 'auth/en'),
    // so we always use lang directly — no need to prepend scope.
    return this.http.get<Translation>(`./assets/i18n/${lang}.json`);
  }
}
