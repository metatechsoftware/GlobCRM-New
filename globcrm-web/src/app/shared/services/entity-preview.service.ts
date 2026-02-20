import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { EntityPreviewDto } from '../models/entity-preview.models';

@Injectable({ providedIn: 'root' })
export class EntityPreviewService {
  private readonly api = inject(ApiService);

  getPreview(entityType: string, entityId: string): Observable<EntityPreviewDto> {
    return this.api.get<EntityPreviewDto>(
      `/api/entities/${entityType.toLowerCase()}/${entityId}/preview`
    );
  }

  trackView(entityType: string, entityId: string, entityName: string): Observable<void> {
    return this.api.post<void>('/api/my-day/track-view', { entityType, entityId, entityName });
  }
}
