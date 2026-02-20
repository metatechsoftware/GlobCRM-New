import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EmailTemplateService } from '../../email-templates/email-template.service';
import { EmailTemplateListItem } from '../../email-templates/email-template.models';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

export interface TemplatePickerData {
  selectedTemplateId?: string;
}

export interface TemplatePickerResult {
  id: string;
  name: string;
  subject: string | null;
}

@Component({
  selector: 'app-template-picker-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    SafeHtmlPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .picker {
      min-width: 500px;
    }

    .picker__search {
      width: 100%;
      margin-bottom: var(--space-4, 16px);
    }

    .picker__loading {
      display: flex;
      justify-content: center;
      padding: var(--space-8, 32px);
    }

    .picker__empty {
      text-align: center;
      padding: var(--space-8, 32px);
      color: var(--color-text-secondary, #64748b);
    }

    .picker__empty mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      opacity: 0.4;
      display: block;
      margin: 0 auto var(--space-2, 8px);
    }

    .picker__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-3, 12px);
      max-height: 400px;
      overflow-y: auto;
      padding: var(--space-1, 4px);
    }

    .template-card {
      border: 2px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-md, 8px);
      padding: var(--space-3, 12px);
      cursor: pointer;
      background: var(--color-surface, #fff);
      transition:
        border-color var(--duration-fast, 100ms) var(--ease-default),
        box-shadow var(--duration-fast, 100ms) var(--ease-default),
        transform var(--duration-fast, 100ms) var(--ease-default);
    }

    .template-card:hover {
      border-color: var(--color-primary, #f97316);
      box-shadow: 0 4px 12px rgba(249, 115, 22, 0.12);
      transform: translateY(-1px);
    }

    .template-card--selected {
      border-color: var(--color-primary, #f97316);
      background: var(--color-primary-soft, #FFF7ED);
      box-shadow: 0 0 0 1px var(--color-primary, #f97316), 0 4px 12px rgba(249, 115, 22, 0.15);
    }

    .template-card__name {
      font-weight: var(--font-semibold, 600);
      font-size: var(--text-base, 14px);
      margin: 0 0 var(--space-1, 4px) 0;
      color: var(--color-text, #1e293b);
    }

    .template-card__subject {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #64748b);
      margin: 0 0 var(--space-2, 8px) 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .template-card__category {
      display: inline-block;
      font-size: 10px;
      font-weight: var(--font-semibold, 600);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--color-text-muted, #9CA3AF);
      padding: 2px 6px;
      background: var(--color-bg-secondary, #F0F0EE);
      border-radius: var(--radius-sm, 4px);
    }

    .template-card__preview {
      width: 100%;
      height: 80px;
      border: 1px solid var(--color-border, #e2e8f0);
      border-radius: var(--radius-sm, 4px);
      margin-top: var(--space-2, 8px);
      pointer-events: none;
    }
  `,
  template: `
    <div class="picker">
      <h2 mat-dialog-title>Select Email Template</h2>

      <mat-dialog-content>
        <mat-form-field class="picker__search" appearance="outline">
          <mat-label>Search templates</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput
                 [(ngModel)]="searchQuery"
                 (ngModelChange)="onSearchChange($event)"
                 placeholder="Search by name..." />
        </mat-form-field>

        @if (loading()) {
          <div class="picker__loading">
            <mat-spinner diameter="36"></mat-spinner>
          </div>
        } @else if (filteredTemplates().length === 0) {
          <div class="picker__empty">
            <mat-icon>drafts</mat-icon>
            <p>No templates found</p>
          </div>
        } @else {
          <div class="picker__grid">
            @for (template of filteredTemplates(); track template.id) {
              <div class="template-card"
                   [class.template-card--selected]="selectedId() === template.id"
                   (click)="selectTemplate(template)">
                <p class="template-card__name">{{ template.name }}</p>
                @if (template.subject) {
                  <p class="template-card__subject">{{ template.subject }}</p>
                }
                @if (template.categoryName) {
                  <span class="template-card__category">{{ template.categoryName }}</span>
                }
                @if (template.htmlBody) {
                  <iframe class="template-card__preview"
                          [srcdoc]="template.htmlBody | safeHtml"
                          sandbox
                          scrolling="no"
                          title="Template preview"></iframe>
                }
              </div>
            }
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary"
                [disabled]="!selectedId()"
                (click)="confirm()">
          Select Template
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class TemplatePickerDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<TemplatePickerDialogComponent>);
  private readonly data = inject<TemplatePickerData>(MAT_DIALOG_DATA, { optional: true });
  private readonly templateService = inject(EmailTemplateService);

  readonly templates = signal<EmailTemplateListItem[]>([]);
  readonly loading = signal(true);
  readonly selectedId = signal<string | null>(null);
  searchQuery = '';

  readonly filteredTemplates = computed(() => {
    const all = this.templates();
    const query = this.searchQuery?.toLowerCase() ?? '';
    if (!query) return all;
    return all.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (t.subject && t.subject.toLowerCase().includes(query)),
    );
  });

  ngOnInit(): void {
    if (this.data?.selectedTemplateId) {
      this.selectedId.set(this.data.selectedTemplateId);
    }

    this.templateService.getTemplates().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onSearchChange(_query: string): void {
    // filteredTemplates computed signal handles filtering
  }

  selectTemplate(template: EmailTemplateListItem): void {
    this.selectedId.set(template.id);
  }

  confirm(): void {
    const id = this.selectedId();
    if (!id) return;

    const template = this.templates().find((t) => t.id === id);
    if (!template) return;

    const result: TemplatePickerResult = {
      id: template.id,
      name: template.name,
      subject: template.subject,
    };

    this.dialogRef.close(result);
  }
}
