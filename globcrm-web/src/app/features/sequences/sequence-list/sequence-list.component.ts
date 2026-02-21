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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
    TranslocoPipe,
  ],
  providers: [SequenceStore],
  templateUrl: './sequence-list.component.html',
  styleUrl: './sequence-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SequenceListComponent implements OnInit {
  readonly store = inject(SequenceStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

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

  getActiveCount(): number {
    return this.store.sequences().filter(s => s.status === 'active').length;
  }

  getPausedCount(): number {
    return this.store.sequences().filter(s => s.status === 'paused').length;
  }

  getDraftCount(): number {
    return this.store.sequences().filter(s => s.status === 'draft').length;
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
          this.transloco.translate('sequences.messages.deleted', { name: seq.name }),
          this.transloco.translate('common.close'),
          { duration: 3000 },
        );
      });
    });
  }
}
