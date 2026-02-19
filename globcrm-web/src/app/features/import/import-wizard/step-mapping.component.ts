import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ImportStore } from '../stores/import.store';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import {
  EntityFieldDef,
  ImportFieldMapping,
  DuplicateStrategy,
  COMPANY_CORE_FIELDS,
  CONTACT_CORE_FIELDS,
  DEAL_CORE_FIELDS,
} from '../import.models';

interface MappingRow {
  csvColumn: string;
  entityField: string;
  isCustomField: boolean;
}

/**
 * Step 2: Map CSV columns to entity fields (core + custom) with skip option.
 * Auto-matches CSV headers by case-insensitive name similarity.
 * Provides duplicate strategy selection (skip/overwrite/merge).
 * Shows sample data preview for reference.
 */
@Component({
  selector: 'app-step-mapping',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './step-mapping.component.scss',
  template: `
    <div class="mapping-container">
      <!-- Mapping Rows -->
      <div class="mapping-rows">
        @for (row of mappings(); track row.csvColumn; let i = $index) {
          <div class="mapping-row" [style.animation-delay]="i * 40 + 'ms'">
            <div class="mapping-source">
              <span class="column-badge">{{ row.csvColumn }}</span>
              <div class="sample-chips">
                @for (sample of getSampleValues(row.csvColumn); track $index) {
                  <span class="sample-chip">{{ sample }}</span>
                }
              </div>
            </div>

            <div class="mapping-arrow">
              <div class="arrow-line"></div>
              <mat-icon>arrow_forward</mat-icon>
              <div class="arrow-line"></div>
            </div>

            <div class="mapping-target">
              <mat-form-field appearance="outline" class="field-select">
                <mat-label>Map to field</mat-label>
                <mat-select [(value)]="row.entityField"
                            (selectionChange)="onFieldChange(row, $event.value)">
                  <mat-option value="">(Skip this column)</mat-option>
                  <mat-optgroup label="Core Fields">
                    @for (field of coreFields(); track field.key) {
                      <mat-option [value]="field.key">
                        {{ field.label }}
                        @if (field.required) {
                          <span style="color: var(--color-danger);"> *</span>
                        }
                      </mat-option>
                    }
                  </mat-optgroup>
                  @if (customFields().length > 0) {
                    <mat-optgroup label="Custom Fields">
                      @for (field of customFields(); track field.key) {
                        <mat-option [value]="'custom:' + field.key">
                          {{ field.label }}
                        </mat-option>
                      }
                    </mat-optgroup>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        }
      </div>

      <!-- Duplicate Strategy Cards -->
      <div class="strategy-section">
        <h3>Duplicate Handling</h3>
        <div class="strategy-cards">
          <button class="strategy-card"
                  [class.selected]="duplicateStrategy === 'skip'"
                  (click)="duplicateStrategy = 'skip'">
            <mat-icon>block</mat-icon>
            <span class="strategy-label">Skip</span>
            <span class="strategy-desc">Existing records won't be modified</span>
          </button>
          <button class="strategy-card"
                  [class.selected]="duplicateStrategy === 'overwrite'"
                  (click)="duplicateStrategy = 'overwrite'">
            <mat-icon>swap_horiz</mat-icon>
            <span class="strategy-label">Overwrite</span>
            <span class="strategy-desc">Replace all fields with imported data</span>
          </button>
          <button class="strategy-card"
                  [class.selected]="duplicateStrategy === 'merge'"
                  (click)="duplicateStrategy = 'merge'">
            <mat-icon>merge_type</mat-icon>
            <span class="strategy-label">Merge</span>
            <span class="strategy-desc">Only update non-empty fields</span>
          </button>
        </div>
      </div>

      @if (store.error()) {
        <div class="error-msg">{{ store.error() }}</div>
      }

      <div class="step-actions">
        <button mat-button (click)="stepBack.emit()">Back</button>
        <button mat-raised-button color="primary"
                [disabled]="store.loading()"
                (click)="onNext()">
          @if (store.loading()) {
            <mat-spinner diameter="20"></mat-spinner>
          }
          Next
        </button>
      </div>
    </div>
  `,
})
export class StepMappingComponent implements OnInit {
  readonly store = inject(ImportStore);
  private readonly customFieldService = inject(CustomFieldService);

  @Output() stepComplete = new EventEmitter<void>();
  @Output() stepBack = new EventEmitter<void>();

  readonly mappings = signal<MappingRow[]>([]);
  readonly coreFields = signal<EntityFieldDef[]>([]);
  readonly customFields = signal<EntityFieldDef[]>([]);

  duplicateStrategy: DuplicateStrategy = 'skip';

  ngOnInit(): void {
    const upload = this.store.uploadResponse();
    if (!upload) return;

    // Determine entity type from store
    const entityType = this.store.entityType();

    // Set core fields based on entity type
    this.coreFields.set(this.getCoreFieldsForType(entityType));

    // Load custom fields for the entity type
    this.customFieldService.getFieldsByEntityType(entityType).subscribe({
      next: (fields) => {
        const customDefs: EntityFieldDef[] = fields.map((f) => ({
          key: f.name,
          label: f.label,
          required: f.validation?.required ?? false,
          type: f.fieldType.toLowerCase(),
        }));
        this.customFields.set(customDefs);

        // Initialize mappings with auto-match
        this.initMappings(upload.headers, customDefs);
      },
      error: () => {
        // Initialize mappings without custom fields
        this.initMappings(upload.headers, []);
      },
    });
  }

  private getCoreFieldsForType(type: string): EntityFieldDef[] {
    switch (type) {
      case 'Company':
        return COMPANY_CORE_FIELDS;
      case 'Deal':
        return DEAL_CORE_FIELDS;
      default:
        return CONTACT_CORE_FIELDS;
    }
  }

  private initMappings(headers: string[], customDefs: EntityFieldDef[]): void {
    const allFields = [
      ...this.coreFields(),
      ...customDefs.map((f) => ({ ...f, key: `custom:${f.key}` })),
    ];

    const rows: MappingRow[] = headers.map((header) => {
      const matched = this.autoMatch(header, allFields);
      return {
        csvColumn: header,
        entityField: matched?.key ?? '',
        isCustomField: matched?.key?.startsWith('custom:') ?? false,
      };
    });

    this.mappings.set(rows);
  }

  /**
   * Auto-match a CSV header to an entity field by case-insensitive,
   * trimmed, and space/underscore-normalized name comparison.
   */
  private autoMatch(
    header: string,
    fields: EntityFieldDef[],
  ): EntityFieldDef | null {
    const normalized = header.trim().toLowerCase().replace(/[_\s]+/g, '');

    for (const field of fields) {
      const fieldNorm = field.key.toLowerCase().replace(/[_\s]+/g, '');
      const labelNorm = field.label.toLowerCase().replace(/[_\s]+/g, '');

      if (normalized === fieldNorm || normalized === labelNorm) {
        return field;
      }
    }
    return null;
  }

  onFieldChange(row: MappingRow, value: string): void {
    row.entityField = value;
    row.isCustomField = value.startsWith('custom:');
  }

  getSampleValues(csvColumn: string): string[] {
    const upload = this.store.uploadResponse();
    if (!upload?.sampleRows) return [];
    return upload.sampleRows
      .slice(0, 3)
      .map((row) => row[csvColumn] ?? '')
      .filter((v) => v !== '');
  }

  onNext(): void {
    const rows = this.mappings();
    const mappings: ImportFieldMapping[] = rows
      .filter((r) => r.entityField !== '')
      .map((r) => ({
        csvColumn: r.csvColumn,
        entityField: r.isCustomField
          ? r.entityField.replace('custom:', '')
          : r.entityField,
        isCustomField: r.isCustomField,
      }));

    this.store.saveMapping(mappings, this.duplicateStrategy);
    // The store advances to step 2 on success, then wizard component handles navigation
    // Listen for step change to emit stepComplete
    const checkInterval = setInterval(() => {
      if (this.store.step() >= 2) {
        clearInterval(checkInterval);
        this.stepComplete.emit();
      }
    }, 100);
    // Safety timeout after 10s
    setTimeout(() => clearInterval(checkInterval), 10000);
  }
}
