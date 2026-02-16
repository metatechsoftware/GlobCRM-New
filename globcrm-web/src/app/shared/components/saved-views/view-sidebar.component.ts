import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ViewStore } from './view.store';
import { SavedView } from './view.models';

/**
 * Sidebar component that displays saved views grouped by Team and Personal.
 * Users can click a view to load it, or save the current table state as a new view.
 *
 * Per locked decision: saved views displayed in left sidebar grouped by
 * Personal / Team; click to load.
 */
@Component({
  selector: 'app-view-sidebar',
  standalone: true,
  imports: [MatListModule, MatIconModule, MatButtonModule],
  providers: [ViewStore],
  templateUrl: './view-sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .view-sidebar {
      width: 240px;
      height: 100%;
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
      background: var(--mat-sys-surface, #fff);
      overflow-y: auto;
    }

    .sidebar-title {
      padding: 16px 16px 8px;
      margin: 0;
      font-size: 16px;
      font-weight: 500;
      color: var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87));
    }

    .view-group {
      margin-bottom: 8px;
    }

    .group-title {
      padding: 8px 16px 4px;
      margin: 0;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    .active {
      background: var(--mat-sys-secondary-container, rgba(25, 118, 210, 0.08));
    }

    .no-views {
      font-style: italic;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.38));
    }

    .sidebar-actions {
      margin-top: auto;
      padding: 8px;
      border-top: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .save-view-btn {
      width: 100%;
      justify-content: flex-start;
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
    // Prompt user for view name. In a real implementation this would
    // open a dialog; for now we use a simple browser prompt.
    const name = prompt('Enter a name for this view:');
    if (!name) return;

    // The parent component should pass current state to saveCurrentState.
    // For now, save an empty view that can be updated by the parent.
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
