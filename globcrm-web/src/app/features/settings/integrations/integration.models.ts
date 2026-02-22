export type IntegrationCategory =
  | 'communication'
  | 'accounting'
  | 'marketing'
  | 'storage'
  | 'calendar'
  | 'developer-tools';

export const CATEGORY_ICONS: Record<IntegrationCategory | 'all', string> = {
  all: 'apps',
  communication: 'chat_bubble',
  accounting: 'calculate',
  marketing: 'campaign',
  storage: 'cloud',
  calendar: 'calendar_month',
  'developer-tools': 'code',
};

export interface CredentialFieldDef {
  key: string;
  label: string;
  type: 'password' | 'text';
  required: boolean;
  placeholder?: string;
}

export interface IntegrationCatalogItem {
  key: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  iconPath: string;
  brandColor: string;
  isPopular: boolean;
  credentialFields: CredentialFieldDef[];
}

export interface IntegrationConnection {
  id: string;
  integrationKey: string;
  status: 'Connected' | 'Disconnected';
  credentialMask: string | null;
  connectedByUserId: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export interface IntegrationActivityLogEntry {
  id: string;
  action: string;
  performedByUserName: string;
  details: string | null;
  createdAt: string;
}

export interface IntegrationViewModel {
  catalog: IntegrationCatalogItem;
  connection: IntegrationConnection | null;
  isConnected: boolean;
}
