/**
 * Contact entity models matching backend DTOs.
 * Used by ContactService and ContactStore.
 */

export interface ContactDto {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
  ownerName: string | null;
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ContactDetailDto extends ContactDto {
  mobilePhone: string | null;
  department: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  description: string | null;
  ownerId: string | null;
}

export interface CreateContactRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  description?: string | null;
  companyId?: string | null;
  customFields?: Record<string, any>;
}

export interface UpdateContactRequest {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  description?: string | null;
  companyId?: string | null;
  customFields?: Record<string, any>;
}
