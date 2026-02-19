import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  effect,
  computed,
} from '@angular/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { ReportCategory } from '../report.models';

interface EntityOption {
  value: string;
  label: string;
  icon: string;
}

const ENTITY_OPTIONS: EntityOption[] = [
  { value: 'Contact', label: 'Contacts', icon: 'person' },
  { value: 'Deal', label: 'Deals', icon: 'handshake' },
  { value: 'Company', label: 'Companies', icon: 'business' },
  { value: 'Lead', label: 'Leads', icon: 'trending_up' },
  { value: 'Activity', label: 'Activities', icon: 'event' },
  { value: 'Quote', label: 'Quotes', icon: 'request_quote' },
  { value: 'Request', label: 'Requests', icon: 'support_agent' },
  { value: 'Product', label: 'Products', icon: 'inventory_2' },
];

/**
 * Entity source selection panel for the report builder sidebar.
 * Provides entity type dropdown, report name, and description fields.
 * Expanded by default in the sidebar accordion.
 */
@Component({
  selector: 'app-entity-source-panel',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
    FormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-expansion-panel [expanded]="true" class="entity-source-panel">
      <mat-expansion-panel-header>
        <mat-panel-title>
          <mat-icon>dataset</mat-icon>
          Data Source
        </mat-panel-title>
      </mat-expansion-panel-header>

      <div class="entity-source-panel__content">
        <mat-form-field appearance="outline" class="entity-source-panel__field">
          <mat-label>Report Name</mat-label>
          <input
            matInput
            [ngModel]="nameValue()"
            (ngModelChange)="onNameChange($event)"
            placeholder="Untitled Report"
          />
        </mat-form-field>

        <mat-form-field appearance="outline" class="entity-source-panel__field">
          <mat-label>Entity Type</mat-label>
          <mat-select
            [ngModel]="entityTypeValue()"
            (ngModelChange)="onEntityTypeChange($event)"
          >
            <mat-select-trigger>
              {{ selectedEntityLabel() }}
            </mat-select-trigger>
            @for (entity of entityOptions; track entity.value) {
              <mat-option [value]="entity.value">
                <div class="entity-option">
                  <mat-icon>{{ entity.icon }}</mat-icon>
                  <span>{{ entity.label }}</span>
                </div>
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="entity-source-panel__field">
          <mat-label>Category</mat-label>
          <mat-select
            [ngModel]="categoryIdValue()"
            (ngModelChange)="onCategoryChange($event)"
          >
            <mat-option [value]="null">None</mat-option>
            @for (cat of categories(); track cat.id) {
              <mat-option [value]="cat.id">{{ cat.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="entity-source-panel__field">
          <mat-label>Description</mat-label>
          <textarea
            matInput
            [ngModel]="descriptionValue()"
            (ngModelChange)="onDescriptionChange($event)"
            placeholder="Optional description..."
            rows="2"
          ></textarea>
        </mat-form-field>
      </div>
    </mat-expansion-panel>
  `,
  styles: `
    .entity-source-panel {
      &__content {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      &__field {
        width: 100%;
      }
    }

    .entity-option {
      display: flex;
      align-items: center;
      gap: 8px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: var(--color-text-secondary, #6B7280);
      }
    }
  `,
})
export class EntitySourcePanelComponent {
  readonly entityType = input<string>('');
  readonly name = input<string>('');
  readonly description = input<string>('');
  readonly categoryId = input<string | null>(null);
  readonly categories = input<ReportCategory[]>([]);

  readonly entityTypeChange = output<string>();
  readonly nameChange = output<string>();
  readonly descriptionChange = output<string>();
  readonly categoryIdChange = output<string | null>();

  readonly entityOptions = ENTITY_OPTIONS;

  readonly selectedEntityLabel = computed(() => {
    const value = this.entityTypeValue();
    if (!value) return '';
    const option = this.entityOptions.find(e => e.value === value);
    return option?.label ?? value;
  });

  // Local signals for two-way binding
  readonly entityTypeValue = signal('');
  readonly nameValue = signal('');
  readonly descriptionValue = signal('');
  readonly categoryIdValue = signal<string | null>(null);

  constructor() {
    // Sync inputs to local signals for edit mode pre-population
    effect(() => {
      const et = this.entityType();
      if (et) this.entityTypeValue.set(et);
    });
    effect(() => {
      const n = this.name();
      if (n) this.nameValue.set(n);
    });
    effect(() => {
      const d = this.description();
      if (d) this.descriptionValue.set(d);
    });
    effect(() => {
      const c = this.categoryId();
      if (c !== undefined) this.categoryIdValue.set(c);
    });
  }

  onEntityTypeChange(value: string): void {
    this.entityTypeValue.set(value);
    this.entityTypeChange.emit(value);
  }

  onNameChange(value: string): void {
    this.nameValue.set(value);
    this.nameChange.emit(value);
  }

  onDescriptionChange(value: string): void {
    this.descriptionValue.set(value);
    this.descriptionChange.emit(value);
  }

  onCategoryChange(value: string | null): void {
    this.categoryIdValue.set(value);
    this.categoryIdChange.emit(value);
  }
}
