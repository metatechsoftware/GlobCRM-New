import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { TranslocoService } from '@jsverse/transloco';
import { ApiService } from '../../../core/api/api.service';
import { SearchService } from '../../../shared/components/global-search/search.service';
import { SearchResponse } from '../../../shared/components/global-search/search.models';
import { getEntityConfig } from '../../../shared/services/entity-type-registry';

interface MentionSuggestion {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  icon: string;
}

interface TeamDirectoryResponse {
  items: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
    avatarUrl?: string;
  }>;
}

@Component({
  selector: 'app-mention-typeahead',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    @keyframes dropdownEnter {
      from {
        opacity: 0;
        transform: translateY(-4px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .mention-dropdown {
      position: fixed;
      z-index: var(--z-popover, 1060);
      min-width: 260px;
      max-height: 280px;
      overflow-y: auto;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border-subtle, #F0F0EE);
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-lg);
      padding: 4px;
      animation: dropdownEnter var(--duration-normal, 200ms) var(--ease-out) both;

      /* Thin scrollbar */
      scrollbar-width: thin;
      scrollbar-color: var(--color-border, #E8E8E6) transparent;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--color-border, #E8E8E6);
        border-radius: var(--radius-full, 9999px);
      }
    }

    .mention-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 10px;
      border: none;
      background: none;
      border-radius: var(--radius-md, 8px);
      cursor: pointer;
      text-align: left;
      transition: background var(--duration-fast, 100ms);

      &:hover {
        background: var(--color-highlight, rgba(249, 115, 22, 0.06));
      }
    }

    .mention-item--active {
      background: var(--color-primary-soft, #FFF7ED);
    }

    .mention-icon-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: var(--radius-md, 8px);
      flex-shrink: 0;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .mention-icon-badge--user {
      background: var(--color-primary-soft, #FFF7ED);
      color: var(--color-primary, #F97316);
    }

    .mention-icon-badge--entity {
      background: var(--color-bg-secondary, #F0F0EE);
      color: var(--color-text-secondary, #6B7280);
    }

    .mention-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .mention-name {
      font-size: var(--text-sm, 0.8125rem);
      font-weight: var(--font-medium, 500);
      color: var(--color-text, #1a1a1a);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mention-type {
      font-size: var(--text-xs, 0.75rem);
      color: var(--color-text-muted, #9CA3AF);
    }

    @media (prefers-reduced-motion: reduce) {
      .mention-dropdown {
        animation: none;
      }
    }
  `,
  template: `
    @if (suggestions().length > 0) {
      <div class="mention-dropdown"
           [style.top.px]="dropdownTop()"
           [style.left.px]="dropdownLeft()">
        @for (suggestion of suggestions(); track suggestion.id; let i = $index) {
          <button class="mention-item"
                  [class.mention-item--active]="i === activeIndex()"
                  type="button"
                  (click)="selectSuggestion(i)">
            <span class="mention-icon-badge"
                  [class.mention-icon-badge--user]="suggestion.type === 'User'"
                  [class.mention-icon-badge--entity]="suggestion.type !== 'User'">
              <mat-icon>{{ suggestion.icon }}</mat-icon>
            </span>
            <span class="mention-info">
              <span class="mention-name">{{ suggestion.name }}</span>
              <span class="mention-type">{{ suggestion.typeLabel }}</span>
            </span>
          </button>
        }
      </div>
    }
  `,
})
export class MentionTypeaheadComponent {
  private readonly searchService = inject(SearchService);
  private readonly apiService = inject(ApiService);
  private readonly translocoService = inject(TranslocoService);

  /** The textarea element to track cursor position from. */
  textareaEl = input<HTMLTextAreaElement | undefined>();

  /** Emitted when the user selects a mention suggestion. */
  mentionSelected = output<{ id: string; name: string; type: string }>();

  /** Current suggestion list. */
  readonly suggestions = signal<MentionSuggestion[]>([]);

  /** Index of the keyboard-highlighted item. */
  readonly activeIndex = signal(0);

  /** Dropdown position relative to the viewport. */
  readonly dropdownTop = signal(0);
  readonly dropdownLeft = signal(0);

  /** Tracks the position of the @ trigger in the textarea value. */
  private mentionStartIndex = -1;

  /**
   * Called by the parent component whenever the textarea fires an input event.
   * Parses backward from the cursor to detect an @mention query.
   */
  onTextInput(): void {
    const textarea = this.textareaEl();
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;

    // Walk backward from cursor to find the @ trigger
    const mentionQuery = this.extractMentionQuery(text, cursorPos);

    if (mentionQuery === null) {
      this.closeSuggestions();
      return;
    }

    this.mentionStartIndex = cursorPos - mentionQuery.length - 1; // -1 for the @ character
    this.positionDropdown(textarea);
    this.fetchSuggestions(mentionQuery);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.suggestions().length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex.update(i => (i + 1) % this.suggestions().length);
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex.update(i => (i - 1 + this.suggestions().length) % this.suggestions().length);
        break;

      case 'Enter':
      case 'Tab':
        event.preventDefault();
        this.selectSuggestion(this.activeIndex());
        break;

      case 'Escape':
        event.preventDefault();
        this.closeSuggestions();
        break;
    }
  }

  selectSuggestion(index: number): void {
    const suggestion = this.suggestions()[index];
    if (!suggestion) {
      return;
    }

    this.mentionSelected.emit({
      id: suggestion.id,
      name: suggestion.name,
      type: suggestion.type,
    });

    this.closeSuggestions();
  }

  /**
   * Extract the mention query by walking backward from the cursor.
   * Returns the query string (characters after @) or null if no valid mention is active.
   */
  private extractMentionQuery(text: string, cursorPos: number): string | null {
    let i = cursorPos - 1;

    // Walk backward to find @, stopping at whitespace or start of string
    while (i >= 0) {
      const char = text[i];
      if (char === '@') {
        const query = text.substring(i + 1, cursorPos);
        // Require at least 2 characters after @
        if (query.length >= 2 && !/\s/.test(query)) {
          return query;
        }
        return null;
      }
      // Stop if we hit whitespace (no @ found before it)
      if (/\s/.test(char)) {
        return null;
      }
      i--;
    }

    return null;
  }

  /**
   * Position the dropdown just below the cursor in the textarea.
   * Uses a hidden mirror span to approximate cursor coordinates.
   */
  private positionDropdown(textarea: HTMLTextAreaElement): void {
    const rect = textarea.getBoundingClientRect();

    // Create a temporary mirror div to measure cursor position
    const mirror = document.createElement('div');
    const computed = getComputedStyle(textarea);

    // Copy relevant styles to the mirror
    const stylesToCopy = [
      'font-family', 'font-size', 'font-weight', 'line-height',
      'letter-spacing', 'word-spacing', 'padding-top', 'padding-left',
      'padding-right', 'border-top-width', 'border-left-width',
      'box-sizing', 'width',
    ] as const;

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.wordWrap = 'break-word';

    for (const prop of stylesToCopy) {
      mirror.style.setProperty(prop, computed.getPropertyValue(prop));
    }

    // Insert text up to the @ trigger, then a marker span
    const textBeforeCursor = textarea.value.substring(0, this.mentionStartIndex);
    mirror.textContent = textBeforeCursor;

    const marker = document.createElement('span');
    marker.textContent = '@';
    mirror.appendChild(marker);

    document.body.appendChild(mirror);

    const lineHeight = parseFloat(computed.lineHeight) || 20;

    document.body.removeChild(mirror);

    // Fallback: position below the textarea's top-left adjusted by approximate line offset
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const topOffset = currentLineIndex * lineHeight;

    this.dropdownTop.set(rect.top + topOffset + lineHeight - textarea.scrollTop + 4);
    this.dropdownLeft.set(rect.left + parseFloat(computed.paddingLeft));
  }

  /**
   * Fetch suggestions from both the search API and team directory in parallel.
   */
  private fetchSuggestions(query: string): void {
    const params = new HttpParams()
      .set('search', query)
      .set('pageSize', '5');

    forkJoin({
      search: this.searchService.search(query, 3),
      team: this.apiService.get<TeamDirectoryResponse>('/api/team-directory', params),
    }).subscribe({
      next: ({ search, team }) => {
        const merged = this.mergeSuggestions(search, team);
        this.suggestions.set(merged);
        this.activeIndex.set(0);
      },
      error: () => {
        this.closeSuggestions();
      },
    });
  }

  /**
   * Merge search results and team directory members into a unified suggestion list.
   * Team members appear first, followed by entity results.
   */
  private mergeSuggestions(
    searchResponse: SearchResponse,
    teamResponse: TeamDirectoryResponse,
  ): MentionSuggestion[] {
    const suggestions: MentionSuggestion[] = [];

    // Map team directory members
    for (const member of teamResponse.items) {
      suggestions.push({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        type: 'User',
        typeLabel: this.translocoService.translate('feed.mention.teamMember'),
        icon: 'person',
      });
    }

    // Map search results from each entity group
    for (const group of searchResponse.groups) {
      const config = getEntityConfig(group.entityType);

      for (const item of group.items) {
        suggestions.push({
          id: item.id,
          name: item.title,
          type: item.entityType,
          typeLabel: config?.label ?? item.entityType,
          icon: config?.icon ?? 'link',
        });
      }
    }

    return suggestions;
  }

  private closeSuggestions(): void {
    this.suggestions.set([]);
    this.activeIndex.set(0);
    this.mentionStartIndex = -1;
  }
}
