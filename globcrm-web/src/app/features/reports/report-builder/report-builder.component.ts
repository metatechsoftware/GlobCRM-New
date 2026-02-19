import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ReportStore } from '../report.store';

/**
 * Report builder shell with two-panel layout. Left sidebar (320px) for
 * configuration panels, right preview area for report results.
 *
 * This shell will be expanded by:
 * - Plan 05: sidebar configuration panels (field picker, filter builder, etc.)
 * - Plan 06: report viewer components (table, chart, aggregates)
 */
@Component({
  selector: 'app-report-builder',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule],
  providers: [ReportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="report-builder">
      <!-- Header -->
      <div class="report-builder__header">
        <div class="report-builder__header-left">
          <a mat-icon-button routerLink="/reports" class="report-builder__back">
            <mat-icon>arrow_back</mat-icon>
          </a>
          <h1>{{ id() ? 'Edit Report' : 'New Report' }}</h1>
        </div>
        <div class="report-builder__header-actions">
          <button mat-stroked-button disabled>
            <mat-icon>play_arrow</mat-icon>
            Run Report
          </button>
          <button mat-raised-button color="primary" disabled>
            <mat-icon>save</mat-icon>
            Save
          </button>
        </div>
      </div>

      <!-- Two-Panel Layout -->
      <div class="report-builder__content">
        <!-- Left Sidebar -->
        <div class="report-builder__sidebar">
          <div class="report-builder__sidebar-placeholder">
            <mat-icon>tune</mat-icon>
            <h3>Configuration</h3>
            <p>Configuration panels will go here</p>
            <ul>
              <li>Entity type & chart type selection</li>
              <li>Field picker with drag-and-drop ordering</li>
              <li>Filter builder with AND/OR groups</li>
              <li>Grouping & aggregation settings</li>
              <li>Chart configuration options</li>
            </ul>
          </div>
        </div>

        <!-- Right Preview Area -->
        <div class="report-builder__preview">
          <div class="report-builder__preview-placeholder">
            <mat-icon>table_chart</mat-icon>
            <h3>Report Preview</h3>
            <p>Report results will appear here</p>
            <ul>
              <li>Data table with sorting and pagination</li>
              <li>Chart visualization (bar, line, pie, funnel)</li>
              <li>Aggregate summary cards</li>
              <li>Export and share controls</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .report-builder {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: calc(100vh - 64px);
    }

    /* Header */
    .report-builder__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-3, 12px) var(--space-6, 24px);
      border-bottom: 1px solid var(--color-border, #E8E8E6);
      background: var(--color-surface, #fff);
    }

    .report-builder__header-left {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);

      h1 {
        margin: 0;
        font-size: var(--text-lg, 18px);
        font-weight: var(--font-semibold, 600);
        color: var(--color-text, #1A1A1A);
      }
    }

    .report-builder__back {
      color: var(--color-text-secondary, #6B7280);
    }

    .report-builder__header-actions {
      display: flex;
      gap: var(--space-2, 8px);
    }

    /* Two-Panel Layout */
    .report-builder__content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .report-builder__sidebar {
      width: 320px;
      min-width: 320px;
      border-right: 1px solid var(--color-border, #E8E8E6);
      background: var(--color-surface, #fff);
      overflow-y: auto;
      padding: var(--space-4, 16px);
    }

    .report-builder__preview {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-6, 24px);
      background: var(--color-bg-secondary, #F0F0EE);
    }

    /* Placeholders */
    .report-builder__sidebar-placeholder,
    .report-builder__preview-placeholder {
      text-align: center;
      padding: var(--space-10, 40px) var(--space-4, 16px);
      color: var(--color-text-secondary, #6B7280);

      mat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        margin-bottom: var(--space-3, 12px);
        opacity: 0.4;
      }

      h3 {
        margin: 0 0 var(--space-2, 8px) 0;
        font-weight: var(--font-medium, 500);
        color: var(--color-text, #1A1A1A);
      }

      p {
        margin: 0 0 var(--space-4, 16px) 0;
        font-size: var(--text-sm, 13px);
      }

      ul {
        text-align: left;
        font-size: var(--text-xs, 12px);
        margin: 0;
        padding-left: var(--space-5, 20px);
        color: var(--color-text-muted, #9CA3AF);

        li {
          margin-bottom: var(--space-1, 4px);
        }
      }
    }

    /* Responsive */
    @media (max-width: 768px) {
      .report-builder__content {
        flex-direction: column;
      }

      .report-builder__sidebar {
        width: 100%;
        min-width: auto;
        max-height: 40vh;
        border-right: none;
        border-bottom: 1px solid var(--color-border, #E8E8E6);
      }
    }
  `,
})
export class ReportBuilderComponent implements OnInit {
  readonly id = input<string>();
  private readonly store = inject(ReportStore);

  ngOnInit(): void {
    const reportId = this.id();
    if (reportId) {
      this.store.loadReport(reportId);
    }
  }
}
