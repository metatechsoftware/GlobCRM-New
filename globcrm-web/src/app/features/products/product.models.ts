/**
 * Product entity models matching backend DTOs.
 * Used by ProductService and ProductStore.
 */

export interface ProductDto {
  id: string;
  name: string;
  description: string | null;
  unitPrice: number;
  sku: string | null;
  category: string | null;
  isActive: boolean;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string | null;
  unitPrice: number;
  sku?: string | null;
  category?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateProductRequest {
  name: string;
  description?: string | null;
  unitPrice: number;
  sku?: string | null;
  category?: string | null;
  isActive: boolean;
  customFields?: Record<string, any>;
}
