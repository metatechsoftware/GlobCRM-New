export interface EntityPreviewDto {
  id: string;
  entityType: string;
  name: string;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  ownerId: string | null;
  fields: Record<string, any>;
  pinnedCustomFields: CustomFieldPreviewDto[];
  associations: AssociationChipDto[];
  pipelineStage: PipelineStagePreviewDto | null;
  recentActivities: RecentActivityDto[];
}

export interface CustomFieldPreviewDto {
  label: string;
  fieldType: string;
  value: any;
}

export interface AssociationChipDto {
  entityType: string;
  count: number;
  items: AssociationItemDto[];
}

export interface AssociationItemDto {
  id: string;
  name: string;
}

export interface PipelineStagePreviewDto {
  pipelineName: string;
  currentStageId: string;
  currentStageName: string;
  currentSortOrder: number;
  allStages: StageInfoDto[];
}

export interface StageInfoDto {
  id: string;
  name: string;
  sortOrder: number;
  color: string | null;
}

export interface RecentActivityDto {
  id: string;
  subject: string;
  type: string;
  status: string;
  createdAt: string;
}

export interface PreviewEntry {
  entityType: string;
  entityId: string;
  entityName?: string;
}
