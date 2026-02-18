import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';

/**
 * Calendar event DTO matching backend CalendarEventDto.
 * Returned by CalendarController GET /api/calendar.
 */
export interface CalendarEventDto {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  extendedProps: {
    type: string;
    status: string;
    priority: string;
    assignedToName: string | null;
    ownerName: string | null;
  };
}

/**
 * Filter parameters for calendar event queries.
 */
export interface CalendarFilters {
  type?: string | null;
  ownerId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * Service for calendar-related API calls.
 * Queries /api/calendar with date-range and optional filters.
 * Also provides activity due-date update for drag-and-drop rescheduling.
 */
@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly api = inject(ApiService);

  /**
   * Get calendar events within a date range with optional filters.
   * Maps to GET /api/calendar?start=...&end=...&type=...&ownerId=...&entityType=...&entityId=...
   */
  getEvents(start: string, end: string, filters?: CalendarFilters): Observable<CalendarEventDto[]> {
    let params = new HttpParams()
      .set('start', start)
      .set('end', end);

    if (filters?.type) {
      params = params.set('type', filters.type);
    }
    if (filters?.ownerId) {
      params = params.set('ownerId', filters.ownerId);
    }
    if (filters?.entityType) {
      params = params.set('entityType', filters.entityType);
    }
    if (filters?.entityId) {
      params = params.set('entityId', filters.entityId);
    }

    return this.api.get<CalendarEventDto[]>('/api/calendar', params);
  }
}
