/**
 * Company entity models matching backend DTOs.
 * Used by CompanyService and CompanyStore.
 */

export interface CompanyDto {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  ownerName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetailDto extends CompanyDto {
  address: string | null;
  postalCode: string | null;
  size: string | null;
  description: string | null;
  ownerId: string | null;
  contactCount: number;
}

export interface CreateCompanyRequest {
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  size?: string | null;
  description?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateCompanyRequest {
  name: string;
  industry?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  size?: string | null;
  description?: string | null;
  customFields?: Record<string, any>;
}
