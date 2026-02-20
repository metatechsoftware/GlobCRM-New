import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { MyDayDto } from './my-day.models';

/**
 * API service for the My Day personal dashboard.
 * Component-provided (NOT providedIn: 'root') — instantiated per My Day page.
 */
@Injectable()
export class MyDayService {
  private readonly api = inject(ApiService);

  /** Fetch all My Day widget data in a single batched response. */
  getMyDay(): Observable<MyDayDto> {
    return this.api.get<MyDayDto>('/api/my-day');
  }

  /** Mark a task (activity) as completed inline. */
  completeTask(taskId: string): Observable<void> {
    return this.api.patch<void>(`/api/my-day/tasks/${taskId}/complete`);
  }

  /** Record a recently viewed entity for the current user. */
  trackView(entityType: string, entityId: string, entityName: string): Observable<void> {
    return this.api.post<void>('/api/my-day/track-view', { entityType, entityId, entityName });
  }
}
