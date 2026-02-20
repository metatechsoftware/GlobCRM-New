import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
  signal,
  viewChild,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Subject, Subscription, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  switchMap,
  tap,
} from 'rxjs/operators';
import { SearchService } from './search.service';
import { RecentSearchesService } from './recent-searches.service';
import { RecentPreviewsService, RecentPreviewEntry } from './recent-previews.service';
import { SearchHit, SearchResponse } from './search.models';
import { PreviewSidebarStore } from '../../stores/preview-sidebar.store';

@Component({
  selector: 'app-global-search',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div class="global-search" [class.active]="isOpen() || showRecent() || showRecentPreviews()">
      <mat-icon class="search-icon">search</mat-icon>
      <input
        #searchInput
        type="text"
        class="search-input"
        placeholder="Search... (Ctrl+K)"
        [value]="searchTerm()"
        (input)="onSearch($event)"
        (focus)="onFocus()"
        (keydown)="onKeydown($event)"
        autocomplete="off" />
      @if (isLoading()) {
        <mat-icon class="loading-icon">hourglass_empty</mat-icon>
      }
      @if (!isLoading() && !isOpen()) {
        <kbd class="shortcut-hint">
          <span>{{ isMac ? '⌘' : 'Ctrl' }}</span>
          <span>K</span>
        </kbd>
      }

      <!-- Search Results Overlay -->
      @if (isOpen() && results() && results()!.groups.length > 0) {
        <div class="search-overlay">
          @for (group of results()!.groups; track group.entityType) {
            <div class="search-group">
              <div class="group-header">{{ group.entityType }}s</div>
              @for (hit of group.items; track hit.id; let i = $index) {
                <a
                  class="search-hit"
                  [class.active]="flatIndex(group, i) === activeIndex()"
                  (click)="selectResult(hit, $event)"
                  (mouseenter)="activeIndex.set(flatIndex(group, i))">
                  <mat-icon class="entity-icon">{{ getEntityIcon(hit.entityType) }}</mat-icon>
                  <div class="hit-content">
                    <span class="hit-title">{{ hit.title }}</span>
                    @if (hit.subtitle) {
                      <span class="hit-subtitle">{{ hit.subtitle }}</span>
                    }
                  </div>
                </a>
              }
            </div>
          }
        </div>
      }

      <!-- Error State -->
      @if (isOpen() && searchError()) {
        <div class="search-overlay">
          <div class="search-error">
            <mat-icon>error_outline</mat-icon>
            <span>Search failed. Please try again.</span>
          </div>
        </div>
      }

      <!-- No Results -->
      @if (isOpen() && !searchError() && results() && results()!.groups.length === 0 && searchTerm().length >= 2) {
        <div class="search-overlay">
          <div class="no-results">No results found for "{{ searchTerm() }}"</div>
        </div>
      }

      <!-- Recent Searches -->
      @if (showRecent() && !isOpen() && recentSearches().length > 0) {
        <div class="search-overlay">
          <div class="recent-header">
            <span>Recent Searches</span>
            <button class="recent-clear-btn" (click)="clearRecent()">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
          @for (term of recentSearches(); track term) {
            <a class="recent-item" (click)="selectRecent(term)">
              <mat-icon>history</mat-icon>
              <span>{{ term }}</span>
            </a>
          }
        </div>
      }

      <!-- Recently Previewed Entities -->
      @if (showRecentPreviews() && !isOpen() && recentPreviews().length > 0) {
        <div class="search-overlay">
          <div class="recent-header">
            <span>Recently Viewed</span>
            <button class="recent-clear-btn" (click)="clearRecentPreviews()">
              <mat-icon>delete_outline</mat-icon>
            </button>
          </div>
          @for (entry of recentPreviews(); track entry.entityId) {
            <a class="search-hit" (click)="selectRecentPreview(entry)">
              <mat-icon class="entity-icon">{{ getEntityIcon(entry.entityType) }}</mat-icon>
              <div class="hit-content">
                <span class="hit-title">{{ entry.entityName }}</span>
                <span class="hit-subtitle">{{ entry.entityType }}</span>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .global-search {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      background: var(--color-bg-secondary);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-full);
      padding: var(--space-1-5) var(--space-3);
      width: 280px;
      transition: all var(--duration-fast) var(--ease-default);

      &.active {
        background: var(--color-surface);
        border-color: var(--color-border-strong);
        box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.04);
        width: 360px;
      }
    }

    .search-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .search-input {
      flex: 1;
      border: none;
      outline: none;
      background: transparent;
      font-size: var(--text-sm);
      color: var(--color-text);
      min-width: 0;

      &::placeholder {
        color: var(--color-text-muted);
      }
    }

    .loading-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-primary);
      flex-shrink: 0;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .shortcut-hint {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;

      span {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        padding: 0 4px;
        font-size: 11px;
        font-family: inherit;
        color: var(--color-text-muted);
        background: var(--color-bg-tertiary, rgba(0, 0, 0, 0.06));
        border: 1px solid var(--color-border-subtle);
        border-radius: 4px;
        line-height: 1;
      }
    }

    .search-overlay {
      position: absolute;
      top: calc(100% + var(--space-2));
      left: 0;
      right: 0;
      min-width: 400px;
      background: var(--color-surface);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-lg);
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.08),
        0 8px 32px rgba(0, 0, 0, 0.04);
      max-height: 400px;
      overflow-y: auto;
      z-index: 1000;
    }

    .search-group {
      padding: var(--space-2) 0;
      border-bottom: 1px solid var(--color-border-subtle);

      &:last-child {
        border-bottom: none;
      }
    }

    .group-header {
      padding: var(--space-1) var(--space-4);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .search-hit {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      transition: background-color var(--duration-fast) var(--ease-default);

      &:hover,
      &.active {
        background: var(--color-highlight);
      }
    }

    .entity-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-text-secondary);
      flex-shrink: 0;
    }

    .hit-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .hit-title {
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .hit-subtitle {
      font-size: var(--text-xs);
      color: var(--color-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .no-results {
      padding: var(--space-6);
      text-align: center;
      color: var(--color-text-muted);
      font-size: var(--text-sm);
    }

    .search-error {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: var(--space-6);
      color: var(--color-danger-text, #dc2626);
      font-size: var(--text-sm);

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .recent-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3) var(--space-4) var(--space-1);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .recent-clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      background: transparent;
      cursor: pointer;
      color: var(--color-text-muted);
      padding: var(--space-1);
      border-radius: var(--radius-sm);

      &:hover {
        color: var(--color-danger-text);
        background: var(--color-danger-soft);
      }

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .recent-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-2) var(--space-4);
      cursor: pointer;
      text-decoration: none;
      color: inherit;
      font-size: var(--text-sm);
      transition: background-color var(--duration-fast) var(--ease-default);

      &:hover {
        background: var(--color-highlight);
      }

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--color-text-muted);
      }
    }
  `,
})
export class GlobalSearchComponent implements OnDestroy {
  private readonly searchService = inject(SearchService);
  private readonly recentSearchesService = inject(RecentSearchesService);
  private readonly recentPreviewsService = inject(RecentPreviewsService);
  private readonly previewStore = inject(PreviewSidebarStore);
  private readonly router = inject(Router);
  private readonly elementRef = inject(ElementRef);

  readonly searchInput = viewChild<ElementRef>('searchInput');

  readonly searchTerm = signal('');
  readonly results = signal<SearchResponse | null>(null);
  readonly isOpen = signal(false);
  readonly isLoading = signal(false);
  readonly recentSearches = signal<string[]>([]);
  readonly recentPreviews = signal<RecentPreviewEntry[]>([]);
  readonly showRecent = signal(false);
  readonly showRecentPreviews = signal(false);
  readonly searchError = signal(false);
  readonly activeIndex = signal(-1);

  readonly isMac = navigator.platform.toUpperCase().includes('MAC');

  /** Flat list of all hits across groups for keyboard navigation. */
  readonly allHits = computed<SearchHit[]>(() => {
    const res = this.results();
    if (!res) return [];
    return res.groups.flatMap((g) => g.items);
  });

  private readonly searchSubject = new Subject<string>();
  private readonly subscription: Subscription;

  constructor() {
    this.subscription = this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((term) => term.length >= 2),
        tap(() => {
          this.isLoading.set(true);
          this.searchError.set(false);
        }),
        switchMap((term) =>
          this.searchService.search(term).pipe(
            catchError((err) => {
              console.error('Global search failed:', err);
              this.searchError.set(true);
              return of({ groups: [], totalCount: 0 } as SearchResponse);
            })
          )
        )
      )
      .subscribe((response) => {
        this.results.set(response);
        this.isLoading.set(false);
        this.isOpen.set(true);
        this.showRecent.set(false);
        this.activeIndex.set(-1);
      });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);

    if (value.length < 2) {
      this.results.set(null);
      this.isOpen.set(false);
      this.isLoading.set(false);
      this.searchError.set(false);
    }

    this.searchSubject.next(value);
  }

  onFocus(): void {
    this.recentSearches.set(this.recentSearchesService.getRecent());
    this.recentPreviews.set(this.recentPreviewsService.getRecent());
    if (!this.isOpen() && !this.results()) {
      // Show recently previewed if available, otherwise recent searches
      if (this.recentPreviews().length > 0) {
        this.showRecentPreviews.set(true);
        this.showRecent.set(false);
      } else {
        this.showRecentPreviews.set(false);
        this.showRecent.set(true);
      }
    }
  }

  selectResult(hit: SearchHit, event?: MouseEvent): void {
    const term = this.searchTerm();
    if (term.trim()) {
      this.recentSearchesService.addRecent(term.trim());
    }
    this.close();

    if (event?.ctrlKey || event?.metaKey) {
      // Ctrl/Cmd+click: navigate to detail page (existing behavior)
      this.router.navigateByUrl(hit.url);
    } else {
      // Default: open preview sidebar
      this.recentPreviewsService.addRecent({
        entityType: hit.entityType,
        entityId: hit.id,
        entityName: hit.title,
      });
      this.previewStore.open({
        entityType: hit.entityType,
        entityId: hit.id,
        entityName: hit.title,
      });
    }
  }

  selectRecent(term: string): void {
    this.searchTerm.set(term);
    this.showRecent.set(false);
    this.searchSubject.next(term);
  }

  clearRecent(): void {
    this.recentSearchesService.clearRecent();
    this.recentSearches.set([]);
    this.showRecent.set(false);
  }

  selectRecentPreview(entry: RecentPreviewEntry): void {
    this.close();
    this.previewStore.open({
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: entry.entityName,
    });
  }

  clearRecentPreviews(): void {
    this.recentPreviewsService.clearRecent();
    this.recentPreviews.set([]);
    this.showRecentPreviews.set(false);
  }

  close(): void {
    this.isOpen.set(false);
    this.showRecent.set(false);
    this.showRecentPreviews.set(false);
    this.activeIndex.set(-1);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.close();
      return;
    }

    const hits = this.allHits();
    if (hits.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = this.activeIndex() + 1;
      this.activeIndex.set(next >= hits.length ? 0 : next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = this.activeIndex() - 1;
      this.activeIndex.set(prev < 0 ? hits.length - 1 : prev);
    } else if (event.key === 'Enter') {
      const idx = this.activeIndex();
      if (idx >= 0 && idx < hits.length) {
        event.preventDefault();
        if (event.ctrlKey || event.metaKey) {
          // Ctrl/Cmd+Enter: navigate to detail page
          this.close();
          this.router.navigateByUrl(hits[idx].url);
        } else {
          // Enter: open preview
          this.recentPreviewsService.addRecent({
            entityType: hits[idx].entityType,
            entityId: hits[idx].id,
            entityName: hits[idx].title,
          });
          this.previewStore.open({
            entityType: hits[idx].entityType,
            entityId: hits[idx].id,
            entityName: hits[idx].title,
          });
          this.close();
        }
      }
    }
  }

  /** Compute the flat index for a hit within a specific group. */
  flatIndex(group: { entityType: string }, indexInGroup: number): number {
    const res = this.results();
    if (!res) return -1;
    let offset = 0;
    for (const g of res.groups) {
      if (g.entityType === group.entityType) return offset + indexInGroup;
      offset += g.items.length;
    }
    return -1;
  }

  getEntityIcon(type: string): string {
    switch (type) {
      case 'Company':
        return 'business';
      case 'Contact':
        return 'person';
      case 'Deal':
        return 'handshake';
      case 'Product':
        return 'inventory_2';
      case 'Activity':
        return 'task_alt';
      case 'Quote':
        return 'request_quote';
      case 'Request':
        return 'support_agent';
      default:
        return 'search';
    }
  }

  /** Close overlay when clicking outside the component. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (
      (this.isOpen() || this.showRecent() || this.showRecentPreviews()) &&
      !this.elementRef.nativeElement.contains(event.target)
    ) {
      this.close();
    }
  }

  /** Ctrl+K / Cmd+K to focus search. */
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      const input = this.searchInput();
      if (input) {
        input.nativeElement.focus();
        input.nativeElement.select();
      }
    }
  }
}
