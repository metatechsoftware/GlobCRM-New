import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SequenceStore } from '../sequence.store';
import { SequenceListItem } from '../sequence.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

@Component({
  selector: 'app-sequence-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TitleCasePipe,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
  ],
  providers: [SequenceStore],
  templateUrl: './sequence-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .sequence-list {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }

    .sequence-list__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .sequence-list__header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .sequence-list__subtitle {
      color: var(--text-secondary, #64748b);
      font-size: 14px;
      margin: 4px 0 0 0;
    }

    .sequence-list__loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .sequence-list__empty {
      text-align: center;
      padding: 64px 24px;
      color: var(--text-secondary, #64748b);
    }

    .sequence-list__empty mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .sequence-list__empty h3 {
      margin: 0 0 8px 0;
      font-weight: 500;
      color: var(--text-primary, #1e293b);
    }

    .sequence-list__table-wrap {
      overflow-x: auto;
    }

    table {
      width: 100%;
    }

    .sequence-list__name-link {
      color: var(--primary, #f97316);
      text-decoration: none;
      font-weight: 500;
    }

    .sequence-list__name-link:hover {
      text-decoration: underline;
    }

    .sequence-list__desc {
      font-size: 12px;
      color: var(--text-secondary, #64748b);
      margin-top: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 300px;
    }

    .sequence-list__status {
      display: inline-block;
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      font-weight: 500;
    }

    .status--draft {
      background-color: #e2e8f0;
      color: #475569;
    }

    .status--active {
      background-color: #dcfce7;
      color: #166534;
    }

    .status--paused {
      background-color: #fef3c7;
      color: #92400e;
    }

    .status--archived {
      background-color: #e2e8f0;
      color: #475569;
    }

    .sequence-list__row {
      cursor: pointer;
    }

    .sequence-list__row:hover {
      background-color: var(--surface-hover, rgba(0, 0, 0, 0.04));
    }

    .sequence-list__actions {
      display: flex;
      gap: 4px;
    }
  `,
})
export class SequenceListComponent implements OnInit {
  readonly store = inject(SequenceStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'name',
    'status',
    'steps',
    'enrolled',
    'active',
    'completed',
    'replyRate',
    'actions',
  ];

  ngOnInit(): void {
    this.store.loadSequences();
  }

  onDelete(seq: SequenceListItem): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: seq.name, type: 'sequence' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.store.deleteSequence(seq.id, () => {
        this.snackBar.open(
          `Sequence "${seq.name}" deleted.`,
          'Close',
          { duration: 3000 },
        );
      });
    });
  }
}
