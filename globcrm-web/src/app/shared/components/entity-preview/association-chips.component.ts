import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { AssociationChipDto, PreviewEntry } from '../../models/entity-preview.models';
import { getEntityConfig } from '../../services/entity-type-registry';

@Component({
  selector: 'app-association-chips',
  standalone: true,
  imports: [MatChipsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-section">
      <div class="section-title">Related</div>
      <mat-chip-set>
        @for (assoc of associations(); track assoc.entityType) {
          @if (assoc.count <= 3) {
            @for (item of assoc.items; track item.id) {
              <mat-chip (click)="onChipClick(assoc.entityType, item.id, item.name)">
                @if (getIcon(assoc.entityType); as icon) {
                  <mat-icon matChipAvatar>{{ icon }}</mat-icon>
                }
                {{ item.name }}
              </mat-chip>
            }
          } @else {
            <mat-chip (click)="onCountChipClick(assoc.entityType)">
              @if (getIcon(assoc.entityType); as icon) {
                <mat-icon matChipAvatar>{{ icon }}</mat-icon>
              }
              {{ assoc.count }} {{ getLabel(assoc.entityType) }}
            </mat-chip>
          }
        }
      </mat-chip-set>
    </div>
  `,
  styles: [`
    .preview-section {
      border-top: 1px solid var(--color-border);
      padding-top: 16px;
      margin-top: 16px;
    }

    .section-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      font-weight: 600;
    }

    mat-chip {
      cursor: pointer;
      transition: all 0.15s ease;
      --mdc-chip-elevated-container-color: var(--color-surface, #fff);
      --mdc-chip-hover-state-layer-opacity: 0.12;

      &:hover {
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
        --mdc-chip-elevated-container-color: var(--color-highlight, rgba(0, 0, 0, 0.06));
      }
    }

    ::ng-deep .mdc-evolution-chip__action--presentational {
      cursor: pointer !important;
    }
  `],
})
export class AssociationChipsComponent {
  readonly associations = input.required<AssociationChipDto[]>();
  readonly chipClick = output<PreviewEntry>();

  getIcon(entityType: string): string {
    return getEntityConfig(entityType)?.icon ?? 'link';
  }

  getLabel(entityType: string): string {
    return getEntityConfig(entityType)?.labelPlural ?? entityType;
  }

  onChipClick(entityType: string, entityId: string, entityName: string): void {
    this.chipClick.emit({ entityType, entityId, entityName });
  }

  onCountChipClick(entityType: string): void {
    // For count chips, we don't open a preview -- this is a navigational hint
    // The parent can decide how to handle it. Emit with empty id to signal "list view".
    this.chipClick.emit({ entityType, entityId: '', entityName: '' });
  }
}
