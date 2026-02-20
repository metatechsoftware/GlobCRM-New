import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PreviewEntry } from '../../models/entity-preview.models';
import { getEntityConfig } from '../../services/entity-type-registry';

@Component({
  selector: 'app-preview-breadcrumbs',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (stack().length > 1) {
      <nav class="breadcrumbs" aria-label="Preview navigation">
        @if (stack().length <= 4) {
          @for (entry of stack(); track $index) {
            @if ($index > 0) {
              <mat-icon class="breadcrumb-separator">chevron_right</mat-icon>
            }
            @if ($index < stack().length - 1) {
              <button class="breadcrumb-item breadcrumb-link" (click)="navigate.emit($index)">
                <mat-icon class="breadcrumb-icon" [style.color]="getColor(entry.entityType)">{{ getIcon(entry.entityType) }}</mat-icon>
                <span>{{ entry.entityName || getLabel(entry.entityType) }}</span>
              </button>
            } @else {
              <span class="breadcrumb-item breadcrumb-current">
                <mat-icon class="breadcrumb-icon" [style.color]="getColor(entry.entityType)">{{ getIcon(entry.entityType) }}</mat-icon>
                <span>{{ entry.entityName || getLabel(entry.entityType) }}</span>
              </span>
            }
          }
        } @else {
          <!-- Collapsed: [first] > ... > [n-1] > [current] -->
          <button class="breadcrumb-item breadcrumb-link" (click)="navigate.emit(0)">
            <mat-icon class="breadcrumb-icon" [style.color]="getColor(stack()[0].entityType)">{{ getIcon(stack()[0].entityType) }}</mat-icon>
            <span>{{ stack()[0].entityName || getLabel(stack()[0].entityType) }}</span>
          </button>
          <mat-icon class="breadcrumb-separator">chevron_right</mat-icon>
          <span class="breadcrumb-item breadcrumb-ellipsis">...</span>
          <mat-icon class="breadcrumb-separator">chevron_right</mat-icon>
          <button class="breadcrumb-item breadcrumb-link" (click)="navigate.emit(stack().length - 2)">
            <mat-icon class="breadcrumb-icon" [style.color]="getColor(stack()[stack().length - 2].entityType)">{{ getIcon(stack()[stack().length - 2].entityType) }}</mat-icon>
            <span>{{ stack()[stack().length - 2].entityName || getLabel(stack()[stack().length - 2].entityType) }}</span>
          </button>
          <mat-icon class="breadcrumb-separator">chevron_right</mat-icon>
          <span class="breadcrumb-item breadcrumb-current">
            <mat-icon class="breadcrumb-icon" [style.color]="getColor(stack()[stack().length - 1].entityType)">{{ getIcon(stack()[stack().length - 1].entityType) }}</mat-icon>
            <span>{{ stack()[stack().length - 1].entityName || getLabel(stack()[stack().length - 1].entityType) }}</span>
          </span>
        }
      </nav>
    }
  `,
  styles: [`
    .breadcrumbs {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .breadcrumb-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      min-width: 0;
    }

    .breadcrumb-link {
      background: none;
      border: none;
      padding: 2px 4px;
      border-radius: 4px;
      cursor: pointer;
      color: var(--color-primary);
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--color-hover, rgba(0, 0, 0, 0.04));
        text-decoration: underline;
      }
    }

    .breadcrumb-current {
      color: var(--color-text);
      padding: 2px 4px;
    }

    .breadcrumb-ellipsis {
      color: var(--color-text-muted);
      padding: 2px 4px;
    }

    .breadcrumb-separator {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-text-muted);
      flex-shrink: 0;
    }

    .breadcrumb-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      flex-shrink: 0;
    }

    .breadcrumb-item span {
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }
  `],
})
export class PreviewBreadcrumbsComponent {
  readonly stack = input.required<PreviewEntry[]>();
  readonly navigate = output<number>();

  getIcon(entityType: string): string {
    return getEntityConfig(entityType)?.icon ?? 'link';
  }

  getColor(entityType: string): string {
    return getEntityConfig(entityType)?.color ?? 'var(--color-text-muted)';
  }

  getLabel(entityType: string): string {
    return getEntityConfig(entityType)?.label ?? entityType;
  }
}
