import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DuplicateService } from '../duplicate.service';
import {
  ContactComparisonRecord,
  CompanyComparisonRecord,
  ComparisonFieldRow,
  MergePreview,
} from '../duplicate.models';

// ---- Contact field definitions ----
const CONTACT_FIELDS: { key: string; label: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'mobilePhone', label: 'Mobile Phone' },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'department', label: 'Department' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'postalCode', label: 'Postal Code' },
  { key: 'description', label: 'Description' },
  { key: 'ownerName', label: 'Owner' },
];

// ---- Company field definitions ----
const COMPANY_FIELDS: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'industry', label: 'Industry' },
  { key: 'website', label: 'Website' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'country', label: 'Country' },
  { key: 'postalCode', label: 'Postal Code' },
  { key: 'size', label: 'Company Size' },
  { key: 'description', label: 'Description' },
  { key: 'ownerName', label: 'Owner' },
];

@Component({
  selector: 'app-merge-comparison',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatDividerModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './merge-comparison.component.scss',
  template: `
    <!-- Merge overlay -->
    @if (merging()) {
      <div class="loading-overlay">
        <div class="loading-overlay__visual">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
        <div class="loading-overlay__text">
          <div class="loading-overlay__title">{{ 'merge.mergingRecords' | transloco }}</div>
          <div class="loading-overlay__desc">{{ 'merge.transferringRelationships' | transloco }}</div>
        </div>
      </div>
    }

    <div class="merge-page">
      <!-- Header -->
      <div class="merge-header">
        <button mat-icon-button class="back-btn" routerLink="/duplicates/scan" aria-label="Back to scan">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="merge-header__text">
          <h1 class="merge-title">{{ entityType() === 'contact' ? ('merge.mergeContacts' | transloco) : ('merge.mergeCompanies' | transloco) }}</h1>
          <div class="merge-subtitle">{{ 'merge.subtitle' | transloco }}</div>
        </div>
      </div>

      <!-- Loading -->
      @if (pageLoading()) {
        <div class="page-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>{{ 'merge.loadingRecords' | transloco }}</p>
        </div>
      }

      @if (!pageLoading() && recordA() && recordB()) {
        <!-- Primary record selector -->
        <div class="primary-selector">
          <div
            class="record-card"
            [class.record-card--selected]="primaryRecord() === 'a'"
            (click)="setPrimary('a')"
          >
            <div class="record-card__label">
              {{ 'merge.recordA' | transloco }}
              @if (primaryRecord() === 'a') {
                <span class="primary-badge">
                  <mat-icon>star</mat-icon>
                  {{ 'merge.survivor' | transloco }}
                </span>
              }
            </div>
            <div class="record-card__name">{{ getRecordDisplayName(recordA()!) }}</div>
            <div class="record-card__detail">{{ getRecordDisplayDetail(recordA()!) }}</div>
            <div class="record-card__date">
              <mat-icon>schedule</mat-icon>
              {{ 'merge.updated' | transloco }} {{ formatDate(recordA()!.updatedAt) }}
            </div>
          </div>

          <div class="swap-section">
            <button
              mat-icon-button
              class="swap-btn"
              (click)="swapPrimary()"
              aria-label="Swap primary record"
            >
              <mat-icon>swap_horiz</mat-icon>
            </button>
          </div>

          <div
            class="record-card"
            [class.record-card--selected]="primaryRecord() === 'b'"
            (click)="setPrimary('b')"
          >
            <div class="record-card__label">
              {{ 'merge.recordB' | transloco }}
              @if (primaryRecord() === 'b') {
                <span class="primary-badge">
                  <mat-icon>star</mat-icon>
                  {{ 'merge.survivor' | transloco }}
                </span>
              }
            </div>
            <div class="record-card__name">{{ getRecordDisplayName(recordB()!) }}</div>
            <div class="record-card__detail">{{ getRecordDisplayDetail(recordB()!) }}</div>
            <div class="record-card__date">
              <mat-icon>schedule</mat-icon>
              {{ 'merge.updated' | transloco }} {{ formatDate(recordB()!.updatedAt) }}
            </div>
          </div>
        </div>

        <!-- Field comparison table -->
        <div class="comparison-section">
          <div class="section-label">
            <h2>{{ 'merge.fieldComparison' | transloco }}</h2>
            @if (diffCount() > 0) {
              <span class="diff-count-badge">{{ diffCount() }} {{ 'merge.differences' | transloco }}</span>
            }
          </div>
          <table class="comparison-table">
            <thead>
              <tr>
                <th>{{ 'merge.field' | transloco }}</th>
                <th>{{ 'merge.recordA' | transloco }}</th>
                <th>{{ 'merge.select' | transloco }}</th>
                <th>{{ 'merge.recordB' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of fieldRows(); track row.fieldName) {
                @if (row.fieldName === '__custom_fields_divider') {
                  <tr class="custom-fields-divider">
                    <td colspan="4">{{ 'merge.customFields' | transloco }}</td>
                  </tr>
                } @else {
                  <tr>
                    <td class="field-label">{{ row.label }}</td>
                    <td>
                      <span
                        class="field-value"
                        [class.field-value--diff]="row.isDifferent"
                        [class.field-value--same]="!row.isDifferent"
                        [class.field-value--empty]="row.valueA == null || row.valueA === ''"
                      >
                        {{ row.valueA != null && row.valueA !== '' ? row.valueA : '(empty)' }}
                      </span>
                    </td>
                    <td class="selection-cell">
                      @if (row.isDifferent) {
                        <mat-radio-group
                          [ngModel]="fieldSelections()[row.fieldName]"
                          (ngModelChange)="onFieldSelection(row.fieldName, $event)"
                        >
                          <mat-radio-button value="a" aria-label="Select Record A value"></mat-radio-button>
                          <mat-radio-button value="b" aria-label="Select Record B value"></mat-radio-button>
                        </mat-radio-group>
                      } @else {
                        <span class="same-check">
                          <mat-icon>check</mat-icon>
                        </span>
                      }
                    </td>
                    <td>
                      <span
                        class="field-value"
                        [class.field-value--diff]="row.isDifferent"
                        [class.field-value--same]="!row.isDifferent"
                        [class.field-value--empty]="row.valueB == null || row.valueB === ''"
                      >
                        {{ row.valueB != null && row.valueB !== '' ? row.valueB : '(empty)' }}
                      </span>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Relationship summary -->
        <div class="relationship-section">
          <div class="section-label">
            <h2>{{ 'merge.relationshipsToTransfer' | transloco }}</h2>
          </div>
          <div class="relationship-card">
            <div class="relationship-card__title">
              All relationships from
              <strong>{{ getLoserName() }}</strong>
              <span class="transfer-arrow"><mat-icon>east</mat-icon></span>
              <strong>{{ getSurvivorName() }}</strong>
            </div>

            @if (nonZeroRelationships().length > 0) {
              <div class="relationship-items">
                @for (rel of nonZeroRelationships(); track rel.label) {
                  <div class="relationship-item">
                    <span class="relationship-item__count">{{ rel.count }}</span>
                    <span class="relationship-item__label">{{ rel.label }}</span>
                  </div>
                }
              </div>
            } @else {
              <div class="no-relationships">
                {{ 'merge.noRelationships' | transloco }}
              </div>
            }
          </div>
        </div>

        <!-- Action footer -->
        <div class="action-footer">
          <button mat-stroked-button routerLink="/duplicates/scan">
            {{ 'merge.cancel' | transloco }}
          </button>
          <button
            mat-raised-button
            color="warn"
            class="merge-btn"
            (click)="openConfirmDialog()"
            [disabled]="merging()"
          >
            <mat-icon>merge</mat-icon>
            {{ 'merge.mergeRecords' | transloco }}
          </button>
        </div>
      }
    </div>
  `,
})
export class MergeComparisonComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly duplicateService = inject(DuplicateService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly translocoService = inject(TranslocoService);

  readonly entityType = signal<'contact' | 'company'>('contact');
  readonly id1 = signal('');
  readonly id2 = signal('');
  readonly pageLoading = signal(true);
  readonly merging = signal(false);

  readonly recordA = signal<ContactComparisonRecord | CompanyComparisonRecord | null>(null);
  readonly recordB = signal<ContactComparisonRecord | CompanyComparisonRecord | null>(null);
  readonly mergePreview = signal<MergePreview | null>(null);

  /** Which record is primary/survivor: 'a' or 'b' */
  readonly primaryRecord = signal<'a' | 'b'>('a');

  /** Field selections: field name -> 'a' or 'b' */
  readonly fieldSelections = signal<Record<string, 'a' | 'b'>>({});

  /** Computed field rows for comparison table */
  readonly fieldRows = computed(() => {
    const a = this.recordA();
    const b = this.recordB();
    if (!a || !b) return [];

    const fields =
      this.entityType() === 'contact' ? CONTACT_FIELDS : COMPANY_FIELDS;

    const rows: ComparisonFieldRow[] = [];

    // Standard fields
    for (const field of fields) {
      const valueA = (a as any)[field.key];
      const valueB = (b as any)[field.key];
      const isDifferent = this.valuesAreDifferent(valueA, valueB);

      rows.push({
        fieldName: field.key,
        label: field.label,
        valueA: this.formatFieldValue(valueA),
        valueB: this.formatFieldValue(valueB),
        isDifferent,
        isCustomField: false,
      });
    }

    // Custom fields divider and rows
    const customA = (a as any).customFields || {};
    const customB = (b as any).customFields || {};
    const allCustomKeys = [
      ...new Set([...Object.keys(customA), ...Object.keys(customB)]),
    ].sort();

    if (allCustomKeys.length > 0) {
      rows.push({
        fieldName: '__custom_fields_divider',
        label: '',
        valueA: null,
        valueB: null,
        isDifferent: false,
        isCustomField: false,
      });

      for (const key of allCustomKeys) {
        const valueA = customA[key];
        const valueB = customB[key];
        const isDifferent = this.valuesAreDifferent(valueA, valueB);

        rows.push({
          fieldName: `custom_${key}`,
          label: key,
          valueA: this.formatFieldValue(valueA),
          valueB: this.formatFieldValue(valueB),
          isDifferent,
          isCustomField: true,
        });
      }
    }

    return rows;
  });

  /** Count of differing fields */
  readonly diffCount = computed(() => {
    return this.fieldRows().filter(
      (r) => r.isDifferent && r.fieldName !== '__custom_fields_divider'
    ).length;
  });

  /** Non-zero relationship counts for display */
  readonly nonZeroRelationships = computed(() => {
    const preview = this.mergePreview();
    if (!preview) return [];

    const items: { label: string; count: number }[] = [];

    if (preview.contactCount > 0)
      items.push({ label: 'Contacts', count: preview.contactCount });
    if (preview.dealCount > 0)
      items.push({ label: 'Deals', count: preview.dealCount });
    if (preview.quoteCount > 0)
      items.push({ label: 'Quotes', count: preview.quoteCount });
    if (preview.requestCount > 0)
      items.push({ label: 'Requests', count: preview.requestCount });
    if (preview.noteCount > 0)
      items.push({ label: 'Notes', count: preview.noteCount });
    if (preview.attachmentCount > 0)
      items.push({ label: 'Attachments', count: preview.attachmentCount });
    if (preview.activityCount > 0)
      items.push({ label: 'Activities', count: preview.activityCount });
    if (preview.emailCount > 0)
      items.push({ label: 'Emails', count: preview.emailCount });
    if (preview.feedItemCount > 0)
      items.push({ label: 'Feed Items', count: preview.feedItemCount });
    if (preview.notificationCount > 0)
      items.push({ label: 'Notifications', count: preview.notificationCount });
    if (preview.leadCount > 0)
      items.push({ label: 'Leads', count: preview.leadCount });

    return items;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.queryParams;
    const entityType = params['entityType'] || 'contact';
    const id1 = params['id1'] || '';
    const id2 = params['id2'] || '';

    this.entityType.set(entityType as 'contact' | 'company');
    this.id1.set(id1);
    this.id2.set(id2);

    if (!id1 || !id2) {
      this.router.navigate(['/duplicates/scan']);
      return;
    }

    this.loadComparison();
  }

  setPrimary(record: 'a' | 'b'): void {
    this.primaryRecord.set(record);
    this.initFieldSelections();
    this.loadMergePreview();
  }

  swapPrimary(): void {
    this.primaryRecord.update((current) => (current === 'a' ? 'b' : 'a'));
    this.initFieldSelections();
    this.loadMergePreview();
  }

  onFieldSelection(fieldName: string, value: 'a' | 'b'): void {
    this.fieldSelections.update((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  openConfirmDialog(): void {
    const survivorName = this.getSurvivorName();
    const loserName = this.getLoserName();
    const preview = this.mergePreview();

    const dialogRef = this.dialog.open(MergeConfirmDialogComponent, {
      width: '480px',
      data: {
        survivorName,
        loserName,
        preview,
        nonZeroRelationships: this.nonZeroRelationships(),
        fieldSelections: this.fieldSelections(),
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.executeMerge();
      }
    });
  }

  getRecordDisplayName(
    record: ContactComparisonRecord | CompanyComparisonRecord
  ): string {
    if ('fullName' in record) {
      return (record as ContactComparisonRecord).fullName;
    }
    return (record as CompanyComparisonRecord).name;
  }

  getRecordDisplayDetail(
    record: ContactComparisonRecord | CompanyComparisonRecord
  ): string {
    if ('fullName' in record) {
      const c = record as ContactComparisonRecord;
      const parts: string[] = [];
      if (c.email) parts.push(c.email);
      if (c.companyName) parts.push(c.companyName);
      return parts.join(' \u00B7 ') || '';
    }
    const co = record as CompanyComparisonRecord;
    const parts: string[] = [];
    if (co.website) parts.push(co.website);
    if (co.email) parts.push(co.email);
    return parts.join(' \u00B7 ') || '';
  }

  getSurvivorName(): string {
    const record =
      this.primaryRecord() === 'a' ? this.recordA() : this.recordB();
    return record ? this.getRecordDisplayName(record) : '';
  }

  getLoserName(): string {
    const record =
      this.primaryRecord() === 'a' ? this.recordB() : this.recordA();
    return record ? this.getRecordDisplayName(record) : '';
  }

  formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  // ---- Private methods ----

  private loadComparison(): void {
    this.pageLoading.set(true);

    const handleResult = (result: any): void => {
      if (this.entityType() === 'contact') {
        this.recordA.set(result.contactA);
        this.recordB.set(result.contactB);
      } else {
        this.recordA.set(result.companyA);
        this.recordB.set(result.companyB);
      }

      // Auto-select primary based on most recently updated
      this.autoSelectPrimary();
      this.initFieldSelections();
      this.loadMergePreview();
      this.pageLoading.set(false);
    };

    const handleError = (): void => {
      this.snackBar.open(this.translocoService.translate('merge.messages.loadFailed'), 'OK', {
        duration: 5000,
      });
      this.pageLoading.set(false);
    };

    if (this.entityType() === 'contact') {
      this.duplicateService
        .getContactComparison(this.id1(), this.id2())
        .subscribe({ next: handleResult, error: handleError });
    } else {
      this.duplicateService
        .getCompanyComparison(this.id1(), this.id2())
        .subscribe({ next: handleResult, error: handleError });
    }
  }

  private autoSelectPrimary(): void {
    const a = this.recordA();
    const b = this.recordB();
    if (!a || !b) return;

    const updatedA = new Date(a.updatedAt).getTime();
    const updatedB = new Date(b.updatedAt).getTime();

    this.primaryRecord.set(updatedA >= updatedB ? 'a' : 'b');
  }

  private initFieldSelections(): void {
    const primary = this.primaryRecord();
    const rows = this.fieldRows();
    const selections: Record<string, 'a' | 'b'> = {};

    for (const row of rows) {
      if (row.fieldName === '__custom_fields_divider') continue;
      selections[row.fieldName] = primary;
    }

    this.fieldSelections.set(selections);
  }

  private loadMergePreview(): void {
    const survivorId =
      this.primaryRecord() === 'a' ? this.id1() : this.id2();
    const loserId =
      this.primaryRecord() === 'a' ? this.id2() : this.id1();

    const handlePreview = (preview: MergePreview): void => {
      this.mergePreview.set(preview);
    };

    const handleError = (): void => {
      // Preview failure is non-critical
      this.mergePreview.set(null);
    };

    if (this.entityType() === 'contact') {
      this.duplicateService
        .getContactMergePreview(survivorId, loserId)
        .subscribe({ next: handlePreview, error: handleError });
    } else {
      this.duplicateService
        .getCompanyMergePreview(survivorId, loserId)
        .subscribe({ next: handlePreview, error: handleError });
    }
  }

  private executeMerge(): void {
    this.merging.set(true);

    const survivorId =
      this.primaryRecord() === 'a' ? this.id1() : this.id2();
    const loserId =
      this.primaryRecord() === 'a' ? this.id2() : this.id1();

    // Build field selections map: field name -> chosen value
    const fieldSelections: Record<string, any> = {};
    const selections = this.fieldSelections();
    const a = this.recordA();
    const b = this.recordB();

    if (a && b) {
      for (const [fieldName, choice] of Object.entries(selections)) {
        if (fieldName === '__custom_fields_divider') continue;

        const isCustom = fieldName.startsWith('custom_');
        const sourceRecord = choice === 'a' ? a : b;

        if (isCustom) {
          const customKey = fieldName.replace('custom_', '');
          const customFields = (sourceRecord as any).customFields || {};
          fieldSelections[fieldName] = customFields[customKey] ?? null;
        } else {
          fieldSelections[fieldName] = (sourceRecord as any)[fieldName] ?? null;
        }
      }
    }

    const request = { survivorId, loserId, fieldSelections };

    const handleSuccess = (result: { survivorId: string }): void => {
      this.merging.set(false);
      this.snackBar.open(this.translocoService.translate('merge.messages.mergeSuccess'), 'OK', {
        duration: 5000,
      });

      const detailPath =
        this.entityType() === 'contact'
          ? `/contacts/${result.survivorId}`
          : `/companies/${result.survivorId}`;
      this.router.navigate([detailPath]);
    };

    const handleError = (): void => {
      this.merging.set(false);
      this.snackBar.open(this.translocoService.translate('merge.messages.mergeFailed'), 'OK', {
        duration: 5000,
      });
    };

    if (this.entityType() === 'contact') {
      this.duplicateService
        .mergeContacts(request)
        .subscribe({ next: handleSuccess, error: handleError });
    } else {
      this.duplicateService
        .mergeCompanies(request)
        .subscribe({ next: handleSuccess, error: handleError });
    }
  }

  private valuesAreDifferent(a: any, b: any): boolean {
    const normA = a == null || a === '' ? null : String(a);
    const normB = b == null || b === '' ? null : String(b);
    return normA !== normB;
  }

  private formatFieldValue(value: any): string | null {
    if (value == null) return null;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }
}

// ---- Merge Confirmation Dialog ----

@Component({
  selector: 'app-merge-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDividerModule, MatDialogModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .dialog-content {
      padding: var(--space-2) 0;
    }

    .dialog-title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.3px;
    }

    .merge-summary {
      margin-bottom: var(--space-4);
    }

    .merge-summary p {
      margin: var(--space-2) 0;
      font-size: var(--text-sm);
      color: var(--color-text);
      line-height: var(--leading-relaxed);
    }

    .merge-summary strong {
      color: var(--color-text);
      font-weight: var(--font-semibold);
    }

    .transfer-list {
      margin: var(--space-3) 0;
      padding: var(--space-3) var(--space-4);
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-border-subtle);
      font-size: var(--text-sm);
      color: var(--color-text);
      line-height: var(--leading-relaxed);
    }

    .warning-banner {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-top: var(--space-4);
      padding: var(--space-3) var(--space-4);
      background: color-mix(in srgb, var(--color-danger) 6%, var(--color-surface));
      border: 1px solid color-mix(in srgb, var(--color-danger) 20%, transparent);
      border-radius: var(--radius-md);
    }

    .warning-banner mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-danger);
      flex-shrink: 0;
    }

    .warning-banner span {
      font-size: var(--text-sm);
      color: var(--color-danger-text);
      font-weight: var(--font-medium);
      line-height: var(--leading-normal);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
    }

    .dialog-actions button {
      border-radius: var(--radius-md) !important;
      font-weight: var(--font-semibold) !important;
      height: 38px;
      min-width: 100px;
    }
  `,
  template: `
    <h2 mat-dialog-title class="dialog-title">{{ 'merge.confirmMerge' | transloco }}</h2>

    <mat-dialog-content>
      <div class="dialog-content">
        <div class="merge-summary">
          <p>
            <strong>{{ 'merge.survivingRecord' | transloco }}:</strong> {{ data.survivorName }}
          </p>
          <p>
            <strong>{{ 'merge.recordToMerge' | transloco }}:</strong> {{ data.loserName }}
          </p>

          @if (data.nonZeroRelationships.length > 0) {
            <div class="transfer-list">
              {{ formatTransferSummary() }} will be transferred.
            </div>
          }
        </div>

        <mat-divider></mat-divider>

        <div class="warning-banner">
          <mat-icon>warning</mat-icon>
          <span>{{ 'merge.warningMessage' | transloco }}</span>
        </div>
      </div>
    </mat-dialog-content>

    <div class="dialog-actions">
      <button mat-stroked-button mat-dialog-close>{{ 'merge.cancel' | transloco }}</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">
        {{ 'merge.confirmMerge' | transloco }}
      </button>
    </div>
  `,
})
export class MergeConfirmDialogComponent {
  readonly data: {
    survivorName: string;
    loserName: string;
    preview: MergePreview | null;
    nonZeroRelationships: { label: string; count: number }[];
    fieldSelections: Record<string, 'a' | 'b'>;
  } = inject(MAT_DIALOG_DATA);

  formatTransferSummary(): string {
    return this.data.nonZeroRelationships
      .map((r) => `${r.count} ${r.label}`)
      .join(', ');
  }
}
