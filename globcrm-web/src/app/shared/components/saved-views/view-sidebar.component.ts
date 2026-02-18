import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ViewStore } from './view.store';
import { SavedView } from './view.models';

/**
 * Horizontal tabs component that displays saved views grouped by Team and Personal.
 * Users can click a tab to load a view, or save the current table state as a new view.
 */
@Component({
  selector: 'app-view-sidebar',
  standalone: true,
  imports: [MatIconModule],
  providers: [ViewStore],
  templateUrl: './view-sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .view-tabs {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      padding: 0 var(--space-1);
      border-bottom: 1px solid var(--color-border-subtle);
      background: var(--color-surface);
      min-height: 40px;
      overflow: hidden;
    }

    .view-tabs-scroll {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      overflow-x: auto;
      flex: 1;
      min-width: 0;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    .view-tab {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: var(--space-2) var(--space-3);
      border: none;
      background: none;
      cursor: pointer;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      white-space: nowrap;
      border-bottom: 2px solid transparent;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;

      &:hover {
        color: var(--color-text);
        background: var(--color-primary-soft);
      }

      &.active {
        color: var(--color-primary-text);
        border-bottom-color: var(--color-primary);
        font-weight: var(--font-semibold);
      }
    }

    .tab-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .tab-divider {
      width: 1px;
      height: 20px;
      background: var(--color-border-subtle);
      flex-shrink: 0;
      margin: 0 var(--space-1);
    }

    .save-tab {
      flex-shrink: 0;
      color: var(--color-text-muted);
      border-bottom-color: transparent;

      &:hover {
        color: var(--color-primary-text);
      }
    }
  `,
})
export class ViewSidebarComponent implements OnInit {
  readonly viewStore = inject(ViewStore);

  entityType = input.required<string>();
  viewSelected = output<SavedView>();

  ngOnInit(): void {
    this.viewStore.loadViews(this.entityType());
  }

  selectView(view: SavedView): void {
    this.viewStore.selectView(view.id);
    this.viewSelected.emit(view);
  }

  saveView(): void {
    const name = prompt('Enter a name for this view:');
    if (!name) return;

    this.viewStore.saveCurrentState(
      name,
      this.entityType(),
      [],
      [],
      [],
      25,
    );
  }
}
