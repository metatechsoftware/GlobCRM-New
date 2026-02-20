export type CreateDialogEntityType = 'Contact' | 'Company' | 'Deal' | 'Activity' | 'Product' | 'Lead' | 'Note';

export interface EntityFormDialogData {
  entityType: CreateDialogEntityType;
  /** Optional pre-fill context for entity creation from detail pages */
  prefill?: {
    entityType?: string;
    entityId?: string;
    entityName?: string;
  };
}

export interface EntityFormDialogResult {
  entity: { id: string; [key: string]: any };
  action: 'close' | 'view';
}
