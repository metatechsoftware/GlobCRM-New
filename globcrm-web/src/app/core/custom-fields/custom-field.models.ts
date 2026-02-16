/**
 * Custom field models matching backend CustomFieldDefinition entities.
 * Used by CustomFieldService, FilterPanel, and entity detail pages.
 */

export enum CustomFieldType {
  Text = 'Text',
  Number = 'Number',
  Date = 'Date',
  Dropdown = 'Dropdown',
  Checkbox = 'Checkbox',
  MultiSelect = 'MultiSelect',
  Currency = 'Currency',
  File = 'File',
  Relation = 'Relation',
}

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
