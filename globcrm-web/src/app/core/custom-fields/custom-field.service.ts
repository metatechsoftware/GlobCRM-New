import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import {
  CustomFieldDefinition,
  CustomFieldSection,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  FieldInfo,
  ValidateFormulaRequest,
  ValidateFormulaResponse,
  PreviewFormulaRequest,
  PreviewFormulaResponse,
} from './custom-field.models';

/**
 * Service for managing custom field definitions via the backend API.
 * Handles CRUD operations for custom fields and sections per entity type.
 */
@Injectable({ providedIn: 'root' })
export class CustomFieldService {
  private readonly api = inject(ApiService);

  /**
   * Get all custom field definitions for a specific entity type.
   */
  getFieldsByEntityType(
    entityType: string,
  ): Observable<CustomFieldDefinition[]> {
    return this.api.get<CustomFieldDefinition[]>(
      `/api/custom-fields/${entityType}`,
    );
  }

  /**
   * Create a new custom field definition.
   */
  createField(
    field: CreateCustomFieldRequest,
  ): Observable<CustomFieldDefinition> {
    return this.api.post<CustomFieldDefinition>('/api/custom-fields', field);
  }

  /**
   * Update an existing custom field definition.
   */
  updateField(
    id: string,
    field: UpdateCustomFieldRequest,
  ): Observable<CustomFieldDefinition> {
    return this.api.put<CustomFieldDefinition>(
      `/api/custom-fields/${id}`,
      field,
    );
  }

  /**
   * Soft-delete a custom field definition.
   */
  deleteField(id: string): Observable<void> {
    return this.api.delete<void>(`/api/custom-fields/${id}`);
  }

  /**
   * Restore a soft-deleted custom field definition.
   */
  restoreField(id: string): Observable<void> {
    return this.api.post<void>(`/api/custom-fields/${id}/restore`);
  }

  /**
   * Get custom field sections for a specific entity type.
   */
  getSections(entityType: string): Observable<CustomFieldSection[]> {
    return this.api.get<CustomFieldSection[]>(
      `/api/custom-fields/sections/${entityType}`,
    );
  }

  /**
   * Validate a formula expression against an entity type's available fields.
   */
  validateFormula(
    request: ValidateFormulaRequest,
  ): Observable<ValidateFormulaResponse> {
    return this.api.post<ValidateFormulaResponse>(
      '/api/custom-fields/validate-formula',
      request,
    );
  }

  /**
   * Preview a formula result using sample or real entity data.
   */
  previewFormula(
    request: PreviewFormulaRequest,
  ): Observable<PreviewFormulaResponse> {
    return this.api.post<PreviewFormulaResponse>(
      '/api/custom-fields/preview-formula',
      request,
    );
  }

  /**
   * Get available fields for formula autocomplete, grouped by category.
   */
  getFieldRegistry(entityType: string): Observable<FieldInfo[]> {
    return this.api.get<FieldInfo[]>(
      `/api/custom-fields/field-registry/${entityType}`,
    );
  }
}
