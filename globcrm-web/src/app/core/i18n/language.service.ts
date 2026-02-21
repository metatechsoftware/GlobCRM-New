import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';

export type SupportedLang = 'en' | 'tr';

const STORAGE_KEY = 'globcrm_language';
const SUPPORTED_LANGS: SupportedLang[] = ['en', 'tr'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translocoService = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);

  readonly currentLang = toSignal(this.translocoService.langChanges$, {
    initialValue: 'en' as string,
  });

  switchLanguage(lang: SupportedLang): void {
    this.translocoService.setActiveLang(lang);
    this.document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
  }

  detectLanguage(): SupportedLang {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored as SupportedLang)) {
      return stored as SupportedLang;
    }

    const browserLang = navigator.language?.substring(0, 2);
    if (browserLang === 'tr') {
      return 'tr';
    }

    return 'en';
  }

  initLanguage(): void {
    const lang = this.detectLanguage();
    this.switchLanguage(lang);
  }
}
