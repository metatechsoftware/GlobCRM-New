export type CreateDialogEntityType = 'Contact' | 'Company' | 'Deal' | 'Activity' | 'Product';

export interface EntityFormDialogData {
  entityType: CreateDialogEntityType;
}

export interface EntityFormDialogResult {
  entity: { id: string; [key: string]: any };
  action: 'close' | 'view';
}
