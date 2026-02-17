/**
 * Deal and Pipeline entity models matching backend DTOs.
 * Used by DealService, PipelineService, and DealStore.
 */

// ─── Pipeline Models ────────────────────────────────────────────────────────

export interface PipelineDto {
  id: string;
  name: string;
  description: string | null;
  teamId: string | null;
  teamName: string | null;
  isDefault: boolean;
  stageCount: number;
  dealCount: number;
  createdAt: string;
}

export interface PipelineDetailDto extends PipelineDto {
  stages: PipelineStageDto[];
}

export interface PipelineStageDto {
  id: string;
  name: string;
  sortOrder: number;
  color: string;
  defaultProbability: number;
  isWon: boolean;
  isLost: boolean;
  requiredFields: Record<string, any>;
}

export interface CreatePipelineRequest {
  name: string;
  description?: string | null;
  teamId?: string | null;
  isDefault: boolean;
  stages: CreateStageRequest[];
}

export interface UpdatePipelineRequest {
  name: string;
  description?: string | null;
  teamId?: string | null;
  isDefault: boolean;
  stages: CreateStageRequest[];
}

export interface CreateStageRequest {
  name: string;
  sortOrder: number;
  color: string;
  defaultProbability: number;
  isWon: boolean;
  isLost: boolean;
  requiredFields?: Record<string, any>;
}

// ─── Deal Models ────────────────────────────────────────────────────────────

export interface DealListDto {
  id: string;
  title: string;
  value: number | null;
  probability: number | null;
  expectedCloseDate: string | null;
  stageName: string;
  stageColor: string;
  pipelineName: string;
  companyName: string | null;
  ownerName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface DealDetailDto extends DealListDto {
  description: string | null;
  actualCloseDate: string | null;
  pipelineId: string;
  pipelineStageId: string;
  companyId: string | null;
  ownerId: string | null;
  linkedContacts: LinkedContactDto[];
  linkedProducts: LinkedProductDto[];
}

export interface LinkedContactDto {
  id: string;
  name: string;
}

export interface LinkedProductDto {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number | null;
}

export interface CreateDealRequest {
  title: string;
  value?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  pipelineId: string;
  pipelineStageId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  description?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateDealRequest {
  title: string;
  value?: number | null;
  probability?: number | null;
  expectedCloseDate?: string | null;
  pipelineId: string;
  pipelineStageId?: string | null;
  companyId?: string | null;
  ownerId?: string | null;
  description?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateStageRequest {
  stageId: string;
}

export interface LinkProductRequest {
  productId: string;
  quantity?: number;
  unitPrice?: number | null;
}

// ─── Kanban Models ──────────────────────────────────────────────────────────

export interface KanbanDto {
  pipelineId: string;
  pipelineName: string;
  stages: KanbanStageDto[];
}

export interface KanbanStageDto {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  isWon: boolean;
  isLost: boolean;
  deals: DealKanbanCardDto[];
}

export interface DealKanbanCardDto {
  id: string;
  title: string;
  value: number | null;
  companyName: string | null;
  ownerName: string | null;
  expectedCloseDate: string | null;
}
