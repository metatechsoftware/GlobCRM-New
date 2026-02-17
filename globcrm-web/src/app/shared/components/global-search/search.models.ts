export interface SearchResponse {
  groups: SearchGroup[];
  totalCount: number;
}

export interface SearchGroup {
  entityType: string;
  items: SearchHit[];
}

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  entityType: string;
  url: string;
}
