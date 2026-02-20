import { Component, ChangeDetectionStrategy, input, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { PreviewSidebarStore } from '../../stores/preview-sidebar.store';
import { getEntityConfig } from '../../services/entity-type-registry';

@Component({
  selector: 'app-preview-entity-link',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="entity-link" (click)="onClick()">
      <mat-icon class="entity-link-icon" [style.color]="iconColor">{{ icon }}</mat-icon>
      <span>{{ entityName() }}</span>
    </button>
  `,
  styles: [`
    :host {
      display: inline;
    }

    .entity-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 0;
      font-size: 13px;
      font-weight: 500;
      color: var(--color-primary);
      cursor: pointer;
      text-align: right;
      font-family: inherit;

      &:hover {
        text-decoration: underline;
      }
    }

    .entity-link-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
  `],
})
export class PreviewEntityLinkComponent {
  readonly entityType = input.required<string>();
  readonly entityId = input.required<string>();
  readonly entityName = input.required<string>();

  private readonly store = inject(PreviewSidebarStore);

  get icon(): string {
    return getEntityConfig(this.entityType())?.icon ?? 'link';
  }

  get iconColor(): string {
    return getEntityConfig(this.entityType())?.color ?? 'var(--color-text-muted)';
  }

  onClick(): void {
    this.store.pushPreview({
      entityType: this.entityType(),
      entityId: this.entityId(),
      entityName: this.entityName(),
    });
  }
}
