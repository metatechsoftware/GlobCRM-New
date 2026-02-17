import { Injectable } from '@angular/core';

const STORAGE_KEY = 'globcrm_recent_searches';
const MAX_ITEMS = 10;

@Injectable({ providedIn: 'root' })
export class RecentSearchesService {
  getRecent(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  addRecent(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) return;

    const current = this.getRecent();
    const deduplicated = current.filter(t => t !== trimmed);
    const updated = [trimmed, ...deduplicated].slice(0, MAX_ITEMS);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage full or unavailable -- silently ignore
    }
  }

  clearRecent(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // silently ignore
    }
  }

  removeRecent(term: string): void {
    const current = this.getRecent();
    const updated = current.filter(t => t !== term);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // silently ignore
    }
  }
}
