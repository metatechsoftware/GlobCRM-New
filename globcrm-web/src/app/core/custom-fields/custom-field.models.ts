/**
 * Custom field models matching backend CustomFieldDefinition entities.
 * Used by CustomFieldService, FilterPanel, and entity detail pages.
 */

export enum CustomFieldType {
  Text = 'text',
  Number = 'number',
  Date = 'date',
  Dropdown = 'dropdown',
  Checkbox = 'checkbox',
  MultiSelect = 'multiSelect',
  Currency = 'currency',
  File = 'file',
  Relation = 'relation',
}

/** Human-readable labels for display in dropdowns and UI. */
export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  [CustomFieldType.Text]: 'Text',
  [CustomFieldType.Number]: 'Number',
  [CustomFieldType.Date]: 'Date',
  [CustomFieldType.Dropdown]: 'Dropdown',
  [CustomFieldType.Checkbox]: 'Checkbox',
  [CustomFieldType.MultiSelect]: 'Multi-Select',
  [CustomFieldType.Currency]: 'Currency',
  [CustomFieldType.File]: 'File',
  [CustomFieldType.Relation]: 'Relation',
};

export interface CustomFieldValidation {
  required: boolean;
  minLength: number | null;
  maxLength: number | null;
  minValue: number | null;
  maxValue: number | null;
  regexPattern: string | null;
  unique: boolean;
}

export interface FieldOption {
  value: string;
  label: string;
  color: string | null;
  sortOrder: number;
}

export interface CustomFieldDefinition {
  id: string;
  entityType: string;
  name: string;
  label: string;
  fieldType: CustomFieldType;
  sortOrder: number;
  sectionId: string | null;
  validation: CustomFieldValidation;
  options: FieldOption[] | null;
  relationEntityType: string | null;
}

export interface CustomFieldSection {
  id: string;
  entityType: string;
  name: string;
  sortOrder: number;
}

export interface CreateCustomFieldRequest {
  entityType: string;
  name: string;
  label: string;
  fieldType: CustomFieldType;
  sortOrder: number;
  sectionId?: string;
  validation?: Partial<CustomFieldValidation>;
  options?: FieldOption[];
  relationEntityType?: string;
}

export interface UpdateCustomFieldRequest {
  label?: string;
  sortOrder?: number;
  sectionId?: string | null;
  validation?: Partial<CustomFieldValidation>;
  options?: FieldOption[];
}
