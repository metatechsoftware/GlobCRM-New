import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CustomFieldService } from '../../../core/custom-fields/custom-field.service';
import {
  CustomFieldDefinition,
  CustomFieldSection,
  CustomFieldType,
  FieldOption,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
} from '../../../core/custom-fields/custom-field.models';

export interface CustomFieldEditDialogData {
  mode: 'create' | 'edit';
  field?: CustomFieldDefinition;
  entityType: string;
  sections: CustomFieldSection[];
  existingFields: CustomFieldDefinition[];
}

const ENTITY_TYPES = [
  'Contact',
  'Company',
  'Deal',
  'Activity',
  'Quote',
  'Request',
  'Product',
];

@Component({
  selector: 'app-custom-field-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './custom-field-edit-dialog.component.html',
})
export class CustomFieldEditDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CustomFieldEditDialogComponent>);
  readonly data = inject<CustomFieldEditDialogData>(MAT_DIALOG_DATA);
  private readonly fieldService = inject(CustomFieldService);

  readonly fieldTypes = Object.values(CustomFieldType);
  readonly entityTypes = ENTITY_TYPES;
  readonly saving = signal<boolean>(false);

  form!: FormGroup;

  readonly isCreateMode = computed(() => this.data.mode === 'create');
  readonly selectedFieldType = signal<CustomFieldType | null>(null);

  readonly showTextValidation = computed(() => {
    const t = this.selectedFieldType();
    return t === CustomFieldType.Text;
  });

  readonly showNumberValidation = computed(() => {
    const t = this.selectedFieldType();
    return t === CustomFieldType.Number || t === CustomFieldType.Currency;
  });

  readonly showOptions = computed(() => {
    const t = this.selectedFieldType();
    return t === CustomFieldType.Dropdown || t === CustomFieldType.MultiSelect;
  });

  readonly showRelation = computed(() => {
    const t = this.selectedFieldType();
    return t === CustomFieldType.Relation;
  });

  ngOnInit(): void {
    this.buildForm();
    if (this.data.field) {
      this.populateForm(this.data.field);
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      label: ['', Validators.required],
      name: [{ value: '', disabled: !this.isCreateMode() }],
      fieldType: [
        { value: CustomFieldType.Text, disabled: !this.isCreateMode() },
        Validators.required,
      ],
      sectionId: [null],
      sortOrder: [0],
      // Validation
      required: [false],
      unique: [false],
      minLength: [null],
      maxLength: [null],
      minValue: [null],
      maxValue: [null],
      regexPattern: [''],
      // Relation
      relationEntityType: [null],
      // Options managed separately
    });

    // Auto-generate name from label (create mode only)
    if (this.isCreateMode()) {
      this.form.get('label')?.valueChanges.subscribe((label: string) => {
        if (label) {
          const name = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          this.form.get('name')?.setValue(name, { emitEvent: false });
        }
      });
    }

    // Track field type changes
    this.form.get('fieldType')?.valueChanges.subscribe((type: CustomFieldType) => {
      this.selectedFieldType.set(type);
    });

    // Set initial field type signal
    this.selectedFieldType.set(
      this.data.field?.fieldType ?? CustomFieldType.Text
    );
  }

  private populateForm(field: CustomFieldDefinition): void {
    this.form.patchValue({
      label: field.label,
      name: field.name,
      fieldType: field.fieldType,
      sectionId: field.sectionId,
      sortOrder: field.sortOrder,
      required: field.validation?.required ?? false,
      unique: field.validation?.unique ?? false,
      minLength: field.validation?.minLength,
      maxLength: field.validation?.maxLength,
      minValue: field.validation?.minValue,
      maxValue: field.validation?.maxValue,
      regexPattern: field.validation?.regexPattern ?? '',
      relationEntityType: field.relationEntityType,
    });

    // Populate options
    if (field.options) {
      this.options.clear();
      for (const opt of field.options) {
        this.options.push(this.createOptionGroup(opt));
      }
    }

    this.selectedFieldType.set(field.fieldType);
  }

  get options(): FormArray {
    if (!this.form.contains('options')) {
      this.form.addControl('options', this.fb.array([]));
    }
    return this.form.get('options') as FormArray;
  }

  private createOptionGroup(opt?: FieldOption): FormGroup {
    return this.fb.group({
      value: [opt?.value ?? '', Validators.required],
      label: [opt?.label ?? '', Validators.required],
      color: [opt?.color ?? ''],
      sortOrder: [opt?.sortOrder ?? this.options.length],
    });
  }

  addOption(): void {
    this.options.push(this.createOptionGroup());
  }

  removeOption(index: number): void {
    this.options.removeAt(index);
    // Re-number sort orders
    for (let i = 0; i < this.options.length; i++) {
      this.options.at(i).get('sortOrder')?.setValue(i);
    }
  }

  moveOption(index: number, direction: 'up' | 'down'): void {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.options.length) return;

    const current = this.options.at(index);
    const target = this.options.at(newIndex);

    const currentOrder = current.get('sortOrder')?.value;
    current.get('sortOrder')?.setValue(target.get('sortOrder')?.value);
    target.get('sortOrder')?.setValue(currentOrder);

    // Swap in the FormArray
    this.options.removeAt(index);
    this.options.insert(newIndex, current);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formValue = this.form.getRawValue();

    if (this.isCreateMode()) {
      const request: CreateCustomFieldRequest = {
        entityType: this.data.entityType,
        name: formValue.name,
        label: formValue.label,
        fieldType: formValue.fieldType,
        sortOrder: formValue.sortOrder ?? 0,
        sectionId: formValue.sectionId ?? undefined,
        validation: {
          required: formValue.required ?? false,
          unique: formValue.unique ?? false,
          minLength: formValue.minLength,
          maxLength: formValue.maxLength,
          minValue: formValue.minValue,
          maxValue: formValue.maxValue,
          regexPattern: formValue.regexPattern || null,
        },
        options: this.showOptions() ? formValue.options : undefined,
        relationEntityType: this.showRelation()
          ? formValue.relationEntityType
          : undefined,
      };

      this.fieldService.createField(request).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
        },
      });
    } else {
      const request: UpdateCustomFieldRequest = {
        label: formValue.label,
        sortOrder: formValue.sortOrder,
        sectionId: formValue.sectionId,
        validation: {
          required: formValue.required ?? false,
          unique: formValue.unique ?? false,
          minLength: formValue.minLength,
          maxLength: formValue.maxLength,
          minValue: formValue.minValue,
          maxValue: formValue.maxValue,
          regexPattern: formValue.regexPattern || null,
        },
        options: this.showOptions() ? formValue.options : undefined,
      };

      this.fieldService.updateField(this.data.field!.id, request).subscribe({
        next: () => {
          this.saving.set(false);
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
        },
      });
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
