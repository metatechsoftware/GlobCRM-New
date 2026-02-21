import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Translation, TranslocoLoader, TranslocoLoaderData } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = inject(HttpClient);

  getTranslation(lang: string, data?: TranslocoLoaderData) {
    const scope = data?.scope;
    const path = scope
      ? `./assets/i18n/${scope}/${lang}.json`
      : `./assets/i18n/${lang}.json`;
    return this.http.get<Translation>(path);
  }
}
