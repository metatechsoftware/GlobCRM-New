import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  TargetDto,
  CreateTargetRequest,
  UpdateTargetRequest,
} from '../../models/dashboard.models';
import { DashboardStore } from '../../stores/dashboard.store';
import { TargetProgressComponent } from '../widgets/target-progress/target-progress.component';
import {
  TargetFormDialogComponent,
  TargetFormDialogData,
} from '../target-form-dialog/target-form-dialog.component';

/**
 * Target management panel showing all targets as progress cards in a grid.
 * Provides add, edit, and delete operations for KPI targets.
 */
@Component({
  selector: 'app-target-management',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    TranslocoPipe,
    TargetProgressComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .targets {
      padding: var(--space-6, 24px) 0;
    }

    .targets__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-6, 24px);
    }

    .targets__title {
      margin: 0;
      font-size: var(--text-xl, 1.25rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #111827);
    }

    .targets__grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-4, 16px);
    }

    .targets__card {
      position: relative;
      background: var(--color-surface, #FFFFFF);
      border: 1px solid var(--color-border-subtle, #F3F4F6);
      border-radius: var(--radius-lg, 12px);
      overflow: hidden;
      transition: box-shadow 0.15s ease;
    }

    .targets__card:hover {
      box-shadow: var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06));
    }

    .targets__card-actions {
      position: absolute;
      top: var(--space-2, 8px);
      right: var(--space-2, 8px);
      display: flex;
      gap: var(--space-1, 4px);
      opacity: 0;
      transition: opacity 0.15s ease;
    }

    .targets__card:hover .targets__card-actions {
      opacity: 1;
    }

    .targets__card-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      background: var(--color-surface, #FFFFFF);
      border-radius: var(--radius-sm, 4px);
      color: var(--color-text-muted, #9CA3AF);
      cursor: pointer;
      padding: 0;
      box-shadow: var(--shadow-xs, 0 1px 2px rgba(0,0,0,0.05));
    }

    .targets__card-action-btn:hover {
      background: var(--color-highlight, rgba(249, 115, 22, 0.08));
      color: var(--color-text, #111827);
    }

    .targets__card-action-btn--delete:hover {
      background: var(--color-danger-soft, rgba(204, 96, 96, 0.08));
      color: var(--color-danger, #EF4444);
    }

    .targets__card-action-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .targets__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-3, 12px);
      padding: var(--space-12, 48px) 0;
      text-align: center;
      color: var(--color-text-muted, #9CA3AF);
    }

    .targets__empty mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.4;
    }

    .targets__empty h3 {
      margin: 0;
      font-size: var(--text-lg, 1.125rem);
      font-weight: var(--font-semibold, 600);
      color: var(--color-text, #111827);
    }

    .targets__empty p {
      margin: 0;
      font-size: var(--text-sm, 0.8125rem);
      max-width: 320px;
    }

    @media (max-width: 1024px) {
      .targets__grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .targets__grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  template: `
    <div class="targets">
      <div class="targets__header">
        <h2 class="targets__title">{{ 'dashboard.targets.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="onAddTarget()">
          <mat-icon>add</mat-icon>
          {{ 'dashboard.targets.addTarget' | transloco }}
        </button>
      </div>

      @if (targets().length > 0) {
        <div class="targets__grid">
          @for (target of targets(); track target.id) {
            <div class="targets__card">
              <div class="targets__card-actions">
                <button
                  class="targets__card-action-btn"
                  (click)="onEditTarget(target)"
                  [title]="'dashboard.targets.editTarget' | transloco"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  class="targets__card-action-btn targets__card-action-btn--delete"
                  (click)="onDeleteTarget(target)"
                  [title]="'dashboard.targets.delete' | transloco"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
              <app-target-progress [target]="target" />
            </div>
          }
        </div>
      } @else {
        <div class="targets__empty">
          <mat-icon>track_changes</mat-icon>
          <h3>{{ 'dashboard.targets.empty.title' | transloco }}</h3>
          <p>{{ 'dashboard.targets.empty.description' | transloco }}</p>
          <button mat-stroked-button (click)="onAddTarget()">
            <mat-icon>add</mat-icon>
            {{ 'dashboard.targets.empty.createButton' | transloco }}
          </button>
        </div>
      }
    </div>
  `,
})
export class TargetManagementComponent {
  readonly targets = input.required<TargetDto[]>();

  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly store = inject(DashboardStore);
  private readonly translocoService = inject(TranslocoService);

  onAddTarget(): void {
    const dialogRef = this.dialog.open(TargetFormDialogComponent, {
      width: '480px',
    });
    dialogRef.afterClosed().subscribe((result: CreateTargetRequest | undefined) => {
      if (!result) return;
      this.store.createTarget(result);
      this.snackBar.open(this.translocoService.translate('dashboard.targets.created'), 'OK', { duration: 2000 });
    });
  }

  onEditTarget(target: TargetDto): void {
    const data: TargetFormDialogData = { target };
    const dialogRef = this.dialog.open(TargetFormDialogComponent, {
      data,
      width: '480px',
    });
    dialogRef.afterClosed().subscribe((result: UpdateTargetRequest | undefined) => {
      if (!result) return;
      this.store.updateTarget(target.id, result);
      this.snackBar.open(this.translocoService.translate('dashboard.targets.updated'), 'OK', { duration: 2000 });
    });
  }

  onDeleteTarget(target: TargetDto): void {
    const ref = this.snackBar.open(
      this.translocoService.translate('dashboard.targets.deleteConfirm', { name: target.name }),
      this.translocoService.translate('dashboard.targets.delete'),
      { duration: 5000 },
    );
    ref.onAction().subscribe(() => {
      this.store.deleteTarget(target.id);
      this.snackBar.open(this.translocoService.translate('dashboard.targets.deleted'), 'OK', { duration: 2000 });
    });
  }
}
