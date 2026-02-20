import { Injectable } from '@angular/core';

const STORAGE_KEY = 'globcrm_recent_previews';
const MAX_ITEMS = 8;

export interface RecentPreviewEntry {
  entityType: string;
  entityId: string;
  entityName: string;
  previewedAt: number; // Unix timestamp ms
}

@Injectable({ providedIn: 'root' })
export class RecentPreviewsService {
  getRecent(): RecentPreviewEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  addRecent(entry: Omit<RecentPreviewEntry, 'previewedAt'>): void {
    if (!entry.entityId || !entry.entityType) return;
    const current = this.getRecent();
    // Deduplicate by entityType + entityId, update name on re-preview
    const deduplicated = current.filter(
      e => !(e.entityType === entry.entityType && e.entityId === entry.entityId)
    );
    const updated: RecentPreviewEntry[] = [
      { ...entry, previewedAt: Date.now() },
      ...deduplicated,
    ].slice(0, MAX_ITEMS);

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
}
