import { Component, ChangeDetectionStrategy, inject, input, output } from '@angular/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  ColumnDefinition,
  ViewColumn,
} from '../../components/saved-views/view.models';

/**
 * Column picker dropdown that allows users to show/hide table columns.
 * Renders as a mat-icon-button with a mat-menu of checkboxes.
 */
@Component({
  selector: 'app-column-picker',
  standalone: true,
  imports: [MatMenuModule, MatButtonModule, MatIconModule, MatCheckboxModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-icon-button [matMenuTriggerFor]="columnMenu" [attr.aria-label]="'common.columnPicker.configureColumns' | transloco">
      <mat-icon>view_column</mat-icon>
    </button>
    <mat-menu #columnMenu="matMenu" class="column-picker-menu">
      <div class="column-picker-header" (click)="$event.stopPropagation()">
        <span>{{ 'common.columnPicker.showHideColumns' | transloco }}</span>
      </div>
      @for (col of allColumns(); track col.fieldId) {
        <div mat-menu-item (click)="$event.stopPropagation(); toggleColumn(col.fieldId)">
          <mat-checkbox
            [checked]="isVisible(col.fieldId)"
            (change)="toggleColumn(col.fieldId)"
            (click)="$event.stopPropagation()">
            {{ getLabel(col) }}
          </mat-checkbox>
        </div>
      }
    </mat-menu>
  `,
  styles: `
    .column-picker-header {
      padding: 8px 16px;
      font-weight: 500;
      font-size: 13px;
      color: var(--color-text-secondary);
      border-bottom: 1px solid var(--color-border);
    }
  `,
})
export class ColumnPickerComponent {
  private readonly translocoService = inject(TranslocoService);

  allColumns = input.required<ColumnDefinition[]>();
  visibleColumns = input.required<ViewColumn[]>();
  columnsChanged = output<ViewColumn[]>();

  /**
   * Get column label, using translated labelKey when available.
   */
  getLabel(col: ColumnDefinition): string {
    if (col.labelKey) {
      return this.translocoService.translate(col.labelKey);
    }
    return col.label;
  }

  isVisible(fieldId: string): boolean {
    const col = this.visibleColumns().find((c) => c.fieldId === fieldId);
    return col?.visible ?? false;
  }

  toggleColumn(fieldId: string): void {
    const current = this.visibleColumns();
    const existing = current.find((c) => c.fieldId === fieldId);

    let updated: ViewColumn[];

    if (existing) {
      updated = current.map((c) =>
        c.fieldId === fieldId ? { ...c, visible: !c.visible } : c,
      );
    } else {
      // Column not in view config yet - add it as visible
      const colDef = this.allColumns().find((c) => c.fieldId === fieldId);
      if (!colDef) return;

      const maxOrder = current.reduce(
        (max, c) => Math.max(max, c.sortOrder),
        0,
      );
      updated = [
        ...current,
        {
          fieldId,
          isCustomField: colDef.isCustomField,
          width: 150,
          sortOrder: maxOrder + 1,
          visible: true,
        },
      ];
    }

    this.columnsChanged.emit(updated);
  }
}
