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
  Formula = 'formula',
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
  [CustomFieldType.Formula]: 'Formula',
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
  formulaExpression: string | null;
  formulaResultType: string | null; // 'number' | 'text' | 'date'
  dependsOnFieldIds: string[] | null;
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
  formulaExpression?: string;
  formulaResultType?: string;
}

export interface UpdateCustomFieldRequest {
  label?: string;
  sortOrder?: number;
  sectionId?: string | null;
  validation?: Partial<CustomFieldValidation>;
  options?: FieldOption[];
  formulaExpression?: string;
  formulaResultType?: string;
}

export interface FieldInfo {
  name: string;
  label: string;
  dataType: string; // 'number' | 'text' | 'date' | 'boolean'
  category: string; // 'System' | 'Custom' | 'Formula'
}

export interface ValidateFormulaRequest {
  entityType: string;
  expression: string;
  excludeFieldId?: string;
}

export interface ValidateFormulaResponse {
  valid: boolean;
  errors: string[];
}

export interface PreviewFormulaRequest {
  entityType: string;
  expression: string;
  sampleEntityId?: string;
}

export interface PreviewFormulaResponse {
  value: any;
  error: string | null;
}

/** Represents a formula error marker in customFields values */
export interface FormulaError {
  __formulaError: boolean;
  message: string;
}

export function isFormulaError(value: any): value is FormulaError {
  return value && typeof value === 'object' && value.__formulaError === true;
}
