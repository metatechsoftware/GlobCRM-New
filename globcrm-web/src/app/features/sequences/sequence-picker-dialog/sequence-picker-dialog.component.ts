import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { SequenceService } from '../sequence.service';
import { SequenceListItem } from '../sequence.models';

/**
 * Dialog for picking an active sequence.
 * Used by contacts list bulk enrollment and contact detail enrollment action.
 * Returns the selected SequenceListItem or undefined on cancel.
 */
@Component({
  selector: 'app-sequence-picker-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .picker {
      min-width: 400px;
    }

    .picker__search {
      width: 100%;
      margin-bottom: var(--space-2, 8px);
    }

    .picker__loading {
      display: flex;
      justify-content: center;
      padding: var(--space-8, 32px);
    }

    .picker__list {
      max-height: 360px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-1, 4px);
    }

    .picker__item {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-3, 12px) var(--space-4, 16px);
      cursor: pointer;
      border-radius: var(--radius-md, 8px);
      transition:
        background-color var(--duration-fast, 100ms) var(--ease-default),
        border-color var(--duration-fast, 100ms) var(--ease-default),
        box-shadow var(--duration-fast, 100ms) var(--ease-default);
      border: 2px solid transparent;
    }

    .picker__item:hover {
      background-color: var(--color-highlight, rgba(249, 115, 22, 0.06));
    }

    .picker__item--selected {
      border-color: var(--color-primary, #f97316);
      background-color: var(--color-primary-soft, #FFF7ED);
      box-shadow: 0 0 0 1px var(--color-primary, #f97316);
    }

    .picker__item mat-icon {
      color: var(--color-primary, #f97316);
      opacity: 0.6;
    }

    .picker__item--selected mat-icon {
      opacity: 1;
    }

    .picker__item-info {
      flex: 1;
      min-width: 0;
    }

    .picker__item-name {
      font-weight: var(--font-semibold, 600);
      font-size: var(--text-base, 14px);
      color: var(--color-text, #1A1A1A);
    }

    .picker__item-meta {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #64748b);
      margin-top: 2px;
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
      margin-bottom: var(--space-2, 8px);
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
  `,
  template: `
    <div class="picker">
      <h2 mat-dialog-title>{{ 'sequences.sequencePicker.title' | transloco }}</h2>

      <mat-dialog-content>
        <mat-form-field class="picker__search" appearance="outline">
          <mat-label>{{ 'sequences.sequencePicker.search' | transloco }}</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput
                 [(ngModel)]="searchQuery"
                 [placeholder]="'sequences.sequencePicker.searchPlaceholder' | transloco" />
        </mat-form-field>

        @if (loading()) {
          <div class="picker__loading">
            <mat-spinner diameter="32"></mat-spinner>
          </div>
        } @else if (filteredSequences().length === 0) {
          <div class="picker__empty">
            <mat-icon>schedule_send</mat-icon>
            <p>{{ 'sequences.sequencePicker.noSequences' | transloco }}</p>
          </div>
        } @else {
          <div class="picker__list">
            @for (seq of filteredSequences(); track seq.id) {
              <div class="picker__item"
                   [class.picker__item--selected]="selectedSequence()?.id === seq.id"
                   (click)="select(seq)">
                <mat-icon>schedule_send</mat-icon>
                <div class="picker__item-info">
                  <div class="picker__item-name">{{ seq.name }}</div>
                  <div class="picker__item-meta">
                    {{ seq.stepCount }} {{ 'sequences.sequencePicker.steps' | transloco }} &middot; {{ seq.totalEnrolled }} {{ 'sequences.sequencePicker.enrolled' | transloco }} &middot; {{ seq.status }}
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button
                color="primary"
                [disabled]="!selectedSequence()"
                (click)="confirm()">
          {{ 'sequences.sequencePicker.selectButton' | transloco }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class SequencePickerDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SequencePickerDialogComponent>);
  private readonly sequenceService = inject(SequenceService);

  readonly loading = signal(false);
  readonly sequences = signal<SequenceListItem[]>([]);
  readonly selectedSequence = signal<SequenceListItem | null>(null);
  searchQuery = '';

  readonly filteredSequences = computed(() => {
    const query = this.searchQuery.toLowerCase().trim();
    const seqs = this.sequences();
    if (!query) return seqs;
    return seqs.filter((s) => s.name.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    this.loading.set(true);
    this.sequenceService.getSequences().subscribe({
      next: (sequences) => {
        // Only show active sequences for enrollment
        this.sequences.set(sequences.filter((s) => s.status === 'active'));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  select(seq: SequenceListItem): void {
    this.selectedSequence.set(seq);
  }

  confirm(): void {
    const seq = this.selectedSequence();
    if (seq) {
      this.dialogRef.close(seq);
    }
  }
}
