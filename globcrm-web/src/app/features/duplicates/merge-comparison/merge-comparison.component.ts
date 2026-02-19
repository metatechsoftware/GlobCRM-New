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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
    }

    .merge-page {
      padding: var(--space-6);
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Header */
    .merge-header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-6);
    }

    .merge-header h1 {
      margin: 0;
      font-size: var(--text-2xl);
      font-weight: var(--font-bold);
      color: var(--color-text);
      letter-spacing: -0.3px;
    }

    /* Primary selector cards */
    .primary-selector {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
      align-items: stretch;
    }

    .record-card {
      padding: var(--space-4);
      border: 2px solid var(--color-border);
      border-radius: var(--radius-lg);
      background: var(--color-surface);
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .record-card:hover {
      box-shadow: var(--shadow-sm);
    }

    .record-card--selected {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 5%, var(--color-surface));
    }

    .record-card__label {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-2);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--color-text-muted);
    }

    .primary-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      padding: 2px var(--space-2);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
      color: var(--color-primary);
      text-transform: none;
      letter-spacing: normal;
    }

    .record-card__name {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      margin-bottom: var(--space-1);
    }

    .record-card__detail {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
    }

    .swap-section {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Field comparison table */
    .comparison-section {
      margin-bottom: var(--space-6);
    }

    .comparison-section h2 {
      margin: 0 0 var(--space-4);
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .comparison-table th {
      padding: var(--space-3) var(--space-4);
      background: var(--color-surface-alt, #f8f9fa);
      font-size: var(--text-sm);
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      text-align: left;
      border-bottom: 1px solid var(--color-border);
    }

    .comparison-table th:nth-child(3) {
      text-align: center;
      width: 80px;
    }

    .comparison-table td {
      padding: var(--space-3) var(--space-4);
      font-size: var(--text-sm);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-border);
      vertical-align: middle;
    }

    .comparison-table tr:last-child td {
      border-bottom: none;
    }

    .field-label {
      font-weight: var(--font-medium);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .field-value {
      word-break: break-word;
    }

    .field-value--empty {
      color: var(--color-text-muted);
      font-style: italic;
    }

    .field-value--diff {
      background: color-mix(in srgb, var(--color-warning) 12%, transparent);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
    }

    .field-value--same {
      color: var(--color-text-muted);
    }

    .selection-cell {
      text-align: center;
    }

    .custom-fields-divider {
      background: var(--color-surface-alt, #f8f9fa);
    }

    .custom-fields-divider td {
      font-weight: var(--font-semibold);
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: var(--space-2) var(--space-4);
    }

    /* Relationship summary */
    .relationship-section {
      margin-bottom: var(--space-6);
    }

    .relationship-section h2 {
      margin: 0 0 var(--space-4);
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .relationship-card {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
    }

    .relationship-card__title {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      margin-bottom: var(--space-3);
    }

    .relationship-items {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .relationship-item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      background: var(--color-surface-alt, #f8f9fa);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
    }

    .relationship-item__count {
      font-weight: var(--font-bold);
      color: var(--color-primary);
    }

    .relationship-item__label {
      color: var(--color-text-muted);
    }

    .no-relationships {
      font-size: var(--text-sm);
      color: var(--color-text-muted);
      font-style: italic;
    }

    /* Action footer */
    .action-footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border);
    }

    /* Loading overlay */
    .loading-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.85);
      z-index: 1000;
      gap: var(--space-4);
    }

    .loading-overlay p {
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    /* Loading state */
    .page-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-12);
      gap: var(--space-4);
    }

    .page-loading p {
      color: var(--color-text-muted);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .merge-page {
        padding: var(--space-4);
      }

      .primary-selector {
        grid-template-columns: 1fr;
      }

      .swap-section {
        justify-content: center;
      }

      .comparison-table {
        display: block;
        overflow-x: auto;
      }
    }
  `,
  template: `
    <!-- Merge overlay -->
    @if (merging()) {
      <div class="loading-overlay">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Merging records...</p>
      </div>
    }

    <div class="merge-page">
      <!-- Header -->
      <div class="merge-header">
        <button mat-icon-button routerLink="/duplicates/scan" aria-label="Back to scan">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>Merge {{ entityType() === 'contact' ? 'Contacts' : 'Companies' }}</h1>
      </div>

      <!-- Loading -->
      @if (pageLoading()) {
        <div class="page-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading records for comparison...</p>
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
              Record A
              @if (primaryRecord() === 'a') {
                <span class="primary-badge">
                  <mat-icon style="font-size: 14px; width: 14px; height: 14px;">star</mat-icon>
                  Primary (Survivor)
                </span>
              }
            </div>
            <div class="record-card__name">{{ getRecordDisplayName(recordA()!) }}</div>
            <div class="record-card__detail">{{ getRecordDisplayDetail(recordA()!) }}</div>
          </div>

          <div class="swap-section">
            <button
              mat-icon-button
              color="primary"
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
              Record B
              @if (primaryRecord() === 'b') {
                <span class="primary-badge">
                  <mat-icon style="font-size: 14px; width: 14px; height: 14px;">star</mat-icon>
                  Primary (Survivor)
                </span>
              }
            </div>
            <div class="record-card__name">{{ getRecordDisplayName(recordB()!) }}</div>
            <div class="record-card__detail">{{ getRecordDisplayDetail(recordB()!) }}</div>
          </div>
        </div>

        <!-- Field comparison table -->
        <div class="comparison-section">
          <h2>Field Comparison</h2>
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Record A</th>
                <th>Select</th>
                <th>Record B</th>
              </tr>
            </thead>
            <tbody>
              @for (row of fieldRows(); track row.fieldName) {
                @if (row.fieldName === '__custom_fields_divider') {
                  <tr class="custom-fields-divider">
                    <td colspan="4">Custom Fields</td>
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
                        <mat-icon style="font-size: 18px; width: 18px; height: 18px; color: var(--color-text-muted);">check</mat-icon>
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
          <h2>Relationships to Transfer</h2>
          <div class="relationship-card">
            <div class="relationship-card__title">
              Relationships will be transferred from
              <strong>{{ getLoserName() }}</strong> to
              <strong>{{ getSurvivorName() }}</strong>:
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
                No relationships to transfer.
              </div>
            }
          </div>
        </div>

        <!-- Action footer -->
        <div class="action-footer">
          <button mat-stroked-button routerLink="/duplicates/scan">
            Cancel
          </button>
          <button
            mat-raised-button
            color="warn"
            (click)="openConfirmDialog()"
            [disabled]="merging()"
          >
            <mat-icon>merge</mat-icon>
            Merge Records
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
      return parts.join(' - ') || '';
    }
    const co = record as CompanyComparisonRecord;
    const parts: string[] = [];
    if (co.website) parts.push(co.website);
    if (co.email) parts.push(co.email);
    return parts.join(' - ') || '';
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
      this.snackBar.open('Failed to load records for comparison', 'OK', {
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
      this.snackBar.open('Records merged successfully', 'OK', {
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
      this.snackBar.open('Merge failed. No changes were made.', 'OK', {
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
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDividerModule, MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .dialog-content {
      padding: var(--space-4) 0;
    }

    .dialog-title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: var(--font-bold);
    }

    .merge-summary {
      margin-bottom: var(--space-4);
    }

    .merge-summary p {
      margin: var(--space-2) 0;
      font-size: var(--text-sm);
      color: var(--color-text);
    }

    .merge-summary strong {
      color: var(--color-text);
    }

    .transfer-list {
      margin: var(--space-3) 0;
      padding: var(--space-3);
      background: var(--color-surface-alt, #f8f9fa);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--color-text);
    }

    .warning-text {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-top: var(--space-4);
      padding: var(--space-3);
      background: color-mix(in srgb, var(--color-warning) 10%, transparent);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--color-warning);
      font-weight: var(--font-medium);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding-top: var(--space-4);
    }
  `,
  template: `
    <h2 mat-dialog-title class="dialog-title">Confirm Merge</h2>

    <mat-dialog-content>
      <div class="dialog-content">
        <div class="merge-summary">
          <p>
            <strong>Surviving record:</strong> {{ data.survivorName }}
          </p>
          <p>
            <strong>Record to merge:</strong> {{ data.loserName }}
          </p>

          @if (data.nonZeroRelationships.length > 0) {
            <div class="transfer-list">
              {{ formatTransferSummary() }} will be transferred.
            </div>
          }
        </div>

        <mat-divider></mat-divider>

        <div class="warning-text">
          <mat-icon>warning</mat-icon>
          This action cannot be easily undone.
        </div>
      </div>
    </mat-dialog-content>

    <div class="dialog-actions">
      <button mat-stroked-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">
        Confirm Merge
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
