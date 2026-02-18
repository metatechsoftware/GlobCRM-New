import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { PipelineService } from '../../deals/pipeline.service';
import { PipelineDto } from '../../deals/deal.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
  selector: 'app-pipeline-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatCardModule,
  ],
  template: `
    <div class="pipeline-list-container">
      <div class="page-header">
        <h1>Pipeline Management</h1>
        <button mat-flat-button color="primary" routerLink="/settings/pipelines/new">
          <mat-icon>add</mat-icon>
          New Pipeline
        </button>
      </div>

      @if (isLoading()) {
        <div class="loading-container">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Loading pipelines...</p>
        </div>
      } @else if (errorMessage()) {
        <div class="error-container">
          <mat-icon class="error-icon">error_outline</mat-icon>
          <p>{{ errorMessage() }}</p>
          <button mat-flat-button color="primary" (click)="loadPipelines()">
            <mat-icon>refresh</mat-icon>
            Retry
          </button>
        </div>
      } @else {
        <table mat-table [dataSource]="pipelines()" class="pipelines-table">
          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Name</th>
            <td mat-cell *matCellDef="let pipeline">{{ pipeline.name }}</td>
          </ng-container>

          <!-- Description Column -->
          <ng-container matColumnDef="description">
            <th mat-header-cell *matHeaderCellDef>Description</th>
            <td mat-cell *matCellDef="let pipeline" class="description-cell">
              {{ pipeline.description || '-' }}
            </td>
          </ng-container>

          <!-- Team Column -->
          <ng-container matColumnDef="team">
            <th mat-header-cell *matHeaderCellDef>Team</th>
            <td mat-cell *matCellDef="let pipeline">
              {{ pipeline.teamName || 'All Teams' }}
            </td>
          </ng-container>

          <!-- Stages Column -->
          <ng-container matColumnDef="stageCount">
            <th mat-header-cell *matHeaderCellDef>Stages</th>
            <td mat-cell *matCellDef="let pipeline">{{ pipeline.stageCount }}</td>
          </ng-container>

          <!-- Deals Column -->
          <ng-container matColumnDef="dealCount">
            <th mat-header-cell *matHeaderCellDef>Deals</th>
            <td mat-cell *matCellDef="let pipeline">{{ pipeline.dealCount }}</td>
          </ng-container>

          <!-- Default Column -->
          <ng-container matColumnDef="isDefault">
            <th mat-header-cell *matHeaderCellDef>Default</th>
            <td mat-cell *matCellDef="let pipeline">
              @if (pipeline.isDefault) {
                <mat-chip-set>
                  <mat-chip color="primary" highlighted>Default</mat-chip>
                </mat-chip-set>
              }
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let pipeline">
              <div class="action-buttons">
                <button
                  mat-icon-button
                  (click)="onEdit(pipeline)"
                  matTooltip="Edit pipeline"
                >
                  <mat-icon>edit</mat-icon>
                </button>
                <button
                  mat-icon-button
                  color="warn"
                  (click)="onDelete(pipeline)"
                  [disabled]="pipeline.dealCount > 0"
                  [matTooltip]="pipeline.dealCount > 0 ? 'Cannot delete pipeline with deals' : 'Delete pipeline'"
                >
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>

          <!-- No data row -->
          <tr class="mat-mdc-no-data-row" *matNoDataRow>
            <td [attr.colspan]="displayedColumns.length" class="no-data-cell">
              No pipelines found. Create your first pipeline to get started.
            </td>
          </tr>
        </table>
      }
    </div>
  `,
  styles: [`
    .pipeline-list-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
      }
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;

      p {
        margin-top: 16px;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 0;

      .error-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        color: #f44336;
      }

      p {
        margin: 16px 0;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    .pipelines-table {
      width: 100%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      border-radius: 4px;
    }

    .description-cell {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .action-buttons {
      display: flex;
      gap: 4px;
    }

    .no-data-cell {
      text-align: center;
      padding: 32px !important;
      color: rgba(0, 0, 0, 0.6);
    }
  `],
})
export class PipelineListComponent implements OnInit {
  private readonly pipelineService = inject(PipelineService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  pipelines = signal<PipelineDto[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  displayedColumns = [
    'name',
    'description',
    'team',
    'stageCount',
    'dealCount',
    'isDefault',
    'actions',
  ];

  ngOnInit(): void {
    this.loadPipelines();
  }

  loadPipelines(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pipelineService.getAll().subscribe({
      next: (pipelines) => {
        this.pipelines.set(pipelines);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load pipelines.');
        this.isLoading.set(false);
      },
    });
  }

  onEdit(pipeline: PipelineDto): void {
    this.router.navigate(['/settings/pipelines', pipeline.id]);
  }

  onDelete(pipeline: PipelineDto): void {
    if (pipeline.dealCount > 0) {
      this.snackBar.open(
        'Cannot delete a pipeline that has deals. Move or delete deals first.',
        'Close',
        { duration: 5000 }
      );
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: pipeline.name, type: 'pipeline' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.pipelineService.delete(pipeline.id).subscribe({
        next: () => {
          this.snackBar.open(
            `Pipeline "${pipeline.name}" deleted.`,
            'Close',
            { duration: 3000 }
          );
          this.loadPipelines();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || 'Failed to delete pipeline.',
            'Close',
            { duration: 5000 }
          );
        },
      });
    });
  }
}
