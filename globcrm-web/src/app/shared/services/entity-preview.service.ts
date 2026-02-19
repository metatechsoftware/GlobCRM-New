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
}
