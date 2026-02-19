import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
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
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../../core/api/api.service';
import { SequenceService } from '../sequence.service';

export interface EnrollmentDialogData {
  sequenceId: string;
  mode: 'enroll' | 're-enroll';
  enrollment?: {
    contactId: string;
    contactName: string;
    currentStepNumber: number;
  };
}

interface ContactSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface SelectedContact {
  id: string;
  name: string;
  email: string;
}

@Component({
  selector: 'app-enrollment-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .enrollment-dialog {
      min-width: 500px;
    }

    .enrollment-dialog__search {
      width: 100%;
      margin-bottom: var(--space-4, 16px);
    }

    .enrollment-dialog__results {
      max-height: 200px;
      overflow-y: auto;
      margin-bottom: var(--space-4, 16px);
      border: 1px solid var(--color-border-subtle, #f1f5f9);
      border-radius: var(--radius-md, 8px);
      padding: var(--space-1, 4px);
    }

    .enrollment-dialog__result-item {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      padding: var(--space-2, 8px) var(--space-3, 12px);
      cursor: pointer;
      border-radius: var(--radius-md, 8px);
      transition:
        background-color var(--duration-fast, 100ms) var(--ease-default);
    }

    .enrollment-dialog__result-item:hover {
      background-color: var(--color-highlight, rgba(249, 115, 22, 0.06));
    }

    .enrollment-dialog__result-item mat-icon {
      color: var(--color-text-muted, #9CA3AF);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .enrollment-dialog__result-name {
      font-weight: var(--font-semibold, 600);
      font-size: var(--text-base, 14px);
      color: var(--color-text, #1A1A1A);
    }

    .enrollment-dialog__result-email {
      font-size: var(--text-xs, 12px);
      color: var(--color-text-secondary, #64748b);
    }

    .enrollment-dialog__chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2, 8px);
      margin-bottom: var(--space-4, 16px);
    }

    .enrollment-dialog__chip {
      display: flex;
      align-items: center;
      gap: var(--space-1, 4px);
      background: var(--color-primary-soft, #FFF7ED);
      border: 1px solid var(--color-primary, #f97316);
      border-radius: var(--radius-full, 9999px);
      padding: var(--space-1, 4px) var(--space-2, 8px) var(--space-1, 4px) var(--space-3, 12px);
      font-size: var(--text-sm, 13px);
      font-weight: var(--font-medium, 500);
      color: var(--color-primary-text, #C2410C);
      transition: background-color var(--duration-fast, 100ms) var(--ease-default);
    }

    .enrollment-dialog__chip:hover {
      background: var(--color-primary-soft-hover, #FFEDD5);
    }

    .enrollment-dialog__chip-remove {
      cursor: pointer;
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-primary, #f97316);
      transition: color var(--duration-fast, 100ms) var(--ease-default);
    }

    .enrollment-dialog__chip-remove:hover {
      color: var(--color-danger, #EF4444);
    }

    .enrollment-dialog__warning {
      display: flex;
      align-items: flex-start;
      gap: var(--space-2, 8px);
      padding: var(--space-3, 12px);
      background: var(--color-warning-soft, #FFFBEB);
      border: 1px solid rgba(245, 158, 11, 0.2);
      border-radius: var(--radius-md, 8px);
      margin-bottom: var(--space-4, 16px);
      font-size: var(--text-sm, 13px);
      color: var(--color-warning-text, #B45309);
    }

    .enrollment-dialog__warning mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 1px;
      color: var(--color-warning, #F59E0B);
    }

    .enrollment-dialog__re-enroll {
      margin-top: var(--space-4, 16px);
    }

    .enrollment-dialog__re-enroll-label {
      font-size: var(--text-base, 14px);
      font-weight: var(--font-semibold, 600);
      margin-bottom: var(--space-2, 8px);
    }

    .enrollment-dialog__submitting {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      justify-content: center;
      padding: var(--space-4, 16px);
      color: var(--color-text-secondary, #6B7280);
      font-size: var(--text-sm, 13px);
    }
  `,
  template: `
    <div class="enrollment-dialog">
      <h2 mat-dialog-title>
        {{ data.mode === 're-enroll' ? 'Re-enroll Contact' : 'Enroll Contacts' }}
      </h2>

      <mat-dialog-content>
        @if (data.mode === 'enroll') {
          <!-- Contact Search -->
          <mat-form-field class="enrollment-dialog__search" appearance="outline">
            <mat-label>Search contacts</mat-label>
            <mat-icon matPrefix>search</mat-icon>
            <input matInput
                   [(ngModel)]="searchQuery"
                   (ngModelChange)="onSearch($event)"
                   placeholder="Type to search contacts..." />
          </mat-form-field>

          <!-- Search Results -->
          @if (searchResults().length > 0 && searchQuery) {
            <div class="enrollment-dialog__results">
              @for (contact of searchResults(); track contact.id) {
                <div class="enrollment-dialog__result-item"
                     (click)="addContact(contact)">
                  <mat-icon>person</mat-icon>
                  <div>
                    <div class="enrollment-dialog__result-name">
                      {{ contact.firstName }} {{ contact.lastName }}
                    </div>
                    <div class="enrollment-dialog__result-email">{{ contact.email }}</div>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Selected Contacts Chips -->
          @if (selectedContacts().length > 0) {
            <div class="enrollment-dialog__chips">
              @for (contact of selectedContacts(); track contact.id) {
                <div class="enrollment-dialog__chip">
                  <span>{{ contact.name }}</span>
                  <mat-icon class="enrollment-dialog__chip-remove"
                            (click)="removeContact(contact.id)">
                    close
                  </mat-icon>
                </div>
              }
            </div>
          }
        }

        @if (data.mode === 're-enroll' && data.enrollment) {
          <p>Re-enroll <strong>{{ data.enrollment.contactName }}</strong> into this sequence.</p>
        }

        <!-- Warning for multi-sequence enrollment -->
        @if (multiSequenceWarning()) {
          <div class="enrollment-dialog__warning">
            <mat-icon>warning</mat-icon>
            <span>{{ multiSequenceWarning() }}</span>
          </div>
        }

        <!-- Re-enrollment Start Position -->
        @if (data.mode === 're-enroll') {
          <div class="enrollment-dialog__re-enroll">
            <div class="enrollment-dialog__re-enroll-label">Start from:</div>
            <mat-radio-group [(ngModel)]="startFromStep">
              <mat-radio-button [value]="1">
                Start from beginning (Step 1)
              </mat-radio-button>
              @if (data.enrollment?.currentStepNumber) {
                <mat-radio-button [value]="data.enrollment!.currentStepNumber">
                  Resume from where they left off (Step {{ data.enrollment!.currentStepNumber }})
                </mat-radio-button>
              }
              <mat-radio-button [value]="customStep()">
                Start from specific step
              </mat-radio-button>
            </mat-radio-group>
            @if (startFromStep === customStep()) {
              <mat-form-field appearance="outline" style="width: 120px; margin-top: 8px;">
                <mat-label>Step number</mat-label>
                <input matInput
                       type="number"
                       min="1"
                       [(ngModel)]="customStepNumber" />
              </mat-form-field>
            }
          </div>
        }

        @if (submitting()) {
          <div class="enrollment-dialog__submitting">
            <mat-spinner diameter="24"></mat-spinner>
            <span>Enrolling...</span>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button
                color="primary"
                [disabled]="!canConfirm() || submitting()"
                (click)="confirm()">
          {{ data.mode === 're-enroll' ? 'Re-enroll' : 'Enroll' }}
          @if (data.mode === 'enroll' && selectedContacts().length > 0) {
            ({{ selectedContacts().length }})
          }
        </button>
      </mat-dialog-actions>
    </div>
  `,
})
export class EnrollmentDialogComponent {
  readonly dialogRef = inject(MatDialogRef<EnrollmentDialogComponent>);
  readonly data = inject<EnrollmentDialogData>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly sequenceService = inject(SequenceService);
  private readonly snackBar = inject(MatSnackBar);

  searchQuery = '';
  readonly searchResults = signal<ContactSearchResult[]>([]);
  readonly selectedContacts = signal<SelectedContact[]>([]);
  readonly multiSequenceWarning = signal<string | null>(null);
  readonly submitting = signal(false);

  startFromStep = 1;
  customStepNumber = 1;
  readonly customStep = signal(-1);

  private searchTimeout: any;

  canConfirm(): boolean {
    if (this.data.mode === 're-enroll') return true;
    return this.selectedContacts().length > 0;
  }

  onSearch(query: string): void {
    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (!query || query.length < 2) {
      this.searchResults.set([]);
      return;
    }

    this.searchTimeout = setTimeout(() => {
      const params = new HttpParams().set('search', query).set('pageSize', '10');
      this.api.get<any>('/api/contacts', params).subscribe({
        next: (response) => {
          const items = response.items ?? response;
          this.searchResults.set(
            (Array.isArray(items) ? items : []).map((c: any) => ({
              id: c.id,
              firstName: c.firstName ?? '',
              lastName: c.lastName ?? '',
              email: c.email ?? '',
            })),
          );
        },
        error: () => {
          this.searchResults.set([]);
        },
      });
    }, 300);
  }

  addContact(contact: ContactSearchResult): void {
    const already = this.selectedContacts().some((c) => c.id === contact.id);
    if (already) return;

    this.selectedContacts.set([
      ...this.selectedContacts(),
      {
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName}`.trim(),
        email: contact.email,
      },
    ]);

    this.searchQuery = '';
    this.searchResults.set([]);
  }

  removeContact(contactId: string): void {
    this.selectedContacts.set(
      this.selectedContacts().filter((c) => c.id !== contactId),
    );
  }

  confirm(): void {
    this.submitting.set(true);

    if (this.data.mode === 're-enroll' && this.data.enrollment) {
      const step =
        this.startFromStep === this.customStep()
          ? this.customStepNumber
          : this.startFromStep;

      this.sequenceService
        .enrollContact(this.data.sequenceId, {
          contactId: this.data.enrollment.contactId,
          startFromStep: step,
        })
        .subscribe({
          next: () => {
            this.submitting.set(false);
            this.snackBar.open('Contact re-enrolled.', 'Close', {
              duration: 3000,
            });
            this.dialogRef.close(true);
          },
          error: (err) => {
            this.submitting.set(false);
            this.snackBar.open(
              err?.message ?? 'Failed to re-enroll contact.',
              'Close',
              { duration: 5000 },
            );
          },
        });
      return;
    }

    // Enroll mode
    const contacts = this.selectedContacts();

    if (contacts.length === 1) {
      // Single enrollment
      this.sequenceService
        .enrollContact(this.data.sequenceId, {
          contactId: contacts[0].id,
        })
        .subscribe({
          next: (result) => {
            this.submitting.set(false);
            const warnings = result?.warnings;
            if (warnings?.length > 0) {
              this.multiSequenceWarning.set(warnings[0]);
            }
            this.snackBar.open('Contact enrolled.', 'Close', {
              duration: 3000,
            });
            this.dialogRef.close(true);
          },
          error: (err) => {
            this.submitting.set(false);
            this.snackBar.open(
              err?.message ?? 'Failed to enroll contact.',
              'Close',
              { duration: 5000 },
            );
          },
        });
    } else {
      // Bulk enrollment
      this.sequenceService
        .bulkEnroll(this.data.sequenceId, {
          contactIds: contacts.map((c) => c.id),
        })
        .subscribe({
          next: (result) => {
            this.submitting.set(false);
            const msg =
              result.skipped > 0
                ? `Enrolled ${result.enrolled} contacts, ${result.skipped} skipped (already enrolled).`
                : `Enrolled ${result.enrolled} contacts.`;
            this.snackBar.open(msg, 'Close', { duration: 5000 });
            this.dialogRef.close(true);
          },
          error: (err) => {
            this.submitting.set(false);
            this.snackBar.open(
              err?.message ?? 'Failed to enroll contacts.',
              'Close',
              { duration: 5000 },
            );
          },
        });
    }
  }
}
