import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DateAdapter } from '@angular/material/core';
import { TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { ProfileService } from '../../features/profile/profile.service';

export type SupportedLang = 'en' | 'tr';

const STORAGE_KEY = 'globcrm_language';
const SUPPORTED_LANGS: SupportedLang[] = ['en', 'tr'];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translocoService = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly dateAdapter = inject(DateAdapter);
  private readonly profileService = inject(ProfileService);

  readonly currentLang = toSignal(this.translocoService.langChanges$, {
    initialValue: 'en' as string,
  });

  switchLanguage(lang: SupportedLang): void {
    this.translocoService.setActiveLang(lang);
    this.document.documentElement.lang = lang;
    this.dateAdapter.setLocale(lang === 'tr' ? 'tr-TR' : 'en-US');
    localStorage.setItem(STORAGE_KEY, lang);

    // Fire-and-forget backend persistence
    try {
      this.profileService.updatePreferences({ language: lang }).subscribe({
        error: () => {
          // Silently ignore — localStorage is the primary cache,
          // backend sync is best-effort
        },
      });
    } catch {
      // Guard against injection errors during app bootstrap
    }
  }

  /**
   * Sync language from backend profile after login.
   * Backend is the source of truth — overrides any stale localStorage value.
   */
  syncFromProfile(profileLanguage: string | null | undefined): void {
    if (
      profileLanguage &&
      SUPPORTED_LANGS.includes(profileLanguage as SupportedLang)
    ) {
      this.switchLanguage(profileLanguage as SupportedLang);
    }
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
