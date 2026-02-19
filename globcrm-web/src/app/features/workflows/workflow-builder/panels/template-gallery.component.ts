import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  inject,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import {
  WorkflowTemplateListItem,
  WorkflowDefinition,
} from '../../workflow.models';
import { WorkflowService } from '../../workflow.service';

@Component({
  selector: 'app-template-gallery',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatDialogModule,
  ],
  template: `
    <div class="gallery">
      <div class="gallery__header">
        <h3>Template Gallery</h3>
        <button mat-icon-button (click)="close.emit()" class="gallery__close">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-tab-group (selectedIndexChange)="onCategoryChange($event)"
                     class="gallery__tabs">
        <mat-tab label="All"></mat-tab>
        <mat-tab label="Sales"></mat-tab>
        <mat-tab label="Engagement"></mat-tab>
        <mat-tab label="Operational"></mat-tab>
        <mat-tab label="Custom"></mat-tab>
      </mat-tab-group>

      <div class="gallery__list">
        @if (loading()) {
          <div class="gallery__loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (filteredTemplates().length === 0) {
          <div class="gallery__empty">
            <mat-icon>dashboard</mat-icon>
            <p>No templates found</p>
          </div>
        } @else {
          @for (template of filteredTemplates(); track template.id) {
            <div class="template-card">
              <div class="template-card__info">
                <span class="template-card__name">{{ template.name }}</span>
                @if (template.description) {
                  <span class="template-card__desc">{{ template.description }}</span>
                }
                <div class="template-card__meta">
                  <span class="template-card__entity-badge">{{ template.entityType }}</span>
                  @if (template.isSystem) {
                    <span class="template-card__system-badge">System</span>
                  } @else {
                    <span class="template-card__custom-badge">Custom</span>
                  }
                  <span class="template-card__nodes">{{ template.nodeCount }} nodes</span>
                </div>
              </div>
              <button mat-stroked-button
                      (click)="onApplyTemplate(template)"
                      class="template-card__apply">
                Apply
              </button>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: `
    .gallery {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .gallery__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-border);

      h3 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-semibold);
      }
    }

    .gallery__close {
      width: 32px;
      height: 32px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .gallery__tabs {
      ::ng-deep .mat-mdc-tab-labels {
        padding: 0 8px;
      }

      ::ng-deep .mat-mdc-tab {
        min-width: 0;
        padding: 0 12px;
        font-size: var(--text-sm);
      }
    }

    .gallery__list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 16px;
    }

    .gallery__loading {
      display: flex;
      justify-content: center;
      padding: 32px;
    }

    .gallery__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      color: var(--color-text-muted);

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 8px;
      }

      p {
        margin: 0;
        font-size: var(--text-sm);
      }
    }

    .template-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      margin-bottom: 8px;
      transition: border-color var(--duration-fast);

      &:hover {
        border-color: var(--color-primary);
      }
    }

    .template-card__info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .template-card__name {
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .template-card__desc {
      font-size: var(--text-xs);
      color: var(--color-text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .template-card__meta {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .template-card__entity-badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--color-info-soft);
      color: var(--color-info-text);
      font-weight: var(--font-medium);
    }

    .template-card__system-badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--color-secondary-soft);
      color: var(--color-secondary-text);
      font-weight: var(--font-medium);
    }

    .template-card__custom-badge {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--color-success-soft);
      color: var(--color-success-text);
      font-weight: var(--font-medium);
    }

    .template-card__nodes {
      font-size: 10px;
      color: var(--color-text-muted);
    }

    .template-card__apply {
      white-space: nowrap;
      font-size: var(--text-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TemplateGalleryComponent implements OnInit {
  readonly entityType = input<string>('');
  readonly templateApplied = output<WorkflowDefinition>();
  readonly close = output<void>();

  private readonly service = inject(WorkflowService);
  private readonly dialog = inject(MatDialog);

  readonly templates = signal<WorkflowTemplateListItem[]>([]);
  readonly loading = signal(false);
  readonly selectedCategory = signal<string>('');

  readonly filteredTemplates = signal<WorkflowTemplateListItem[]>([]);

  private readonly categories = ['', 'Sales', 'Engagement', 'Operational', 'Custom'];

  ngOnInit(): void {
    this.loadTemplates();
  }

  onCategoryChange(index: number): void {
    this.selectedCategory.set(this.categories[index] || '');
    this.filterTemplates();
  }

  onApplyTemplate(template: WorkflowTemplateListItem): void {
    // Confirm dialog before applying
    if (confirm('This will replace your current workflow. Continue?')) {
      this.loading.set(true);
      this.service.getTemplate(template.id).subscribe({
        next: (fullTemplate) => {
          this.templateApplied.emit(fullTemplate.definition);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
    }
  }

  private loadTemplates(): void {
    this.loading.set(true);
    this.service.getTemplates(undefined, this.entityType() || undefined).subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.filterTemplates();
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private filterTemplates(): void {
    const cat = this.selectedCategory();
    const all = this.templates();
    if (!cat) {
      this.filteredTemplates.set(all);
    } else if (cat === 'Custom') {
      this.filteredTemplates.set(all.filter((t) => !t.isSystem));
    } else {
      this.filteredTemplates.set(
        all.filter((t) => t.category.toLowerCase() === cat.toLowerCase()),
      );
    }
  }
}
