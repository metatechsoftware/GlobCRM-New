import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/api/api.service';
import {
  IntegrationConnection,
  IntegrationActivityLogEntry,
} from './integration.models';

/**
 * API service for integration marketplace lifecycle:
 * list connections, connect, disconnect, test, and activity log.
 */
@Injectable({ providedIn: 'root' })
export class IntegrationService {
  private readonly api = inject(ApiService);
  private readonly basePath = '/api/integrations';

  /** List all integration connections for the current tenant. */
  getConnections(): Observable<IntegrationConnection[]> {
    return this.api.get<IntegrationConnection[]>(this.basePath);
  }

  /** Connect a new integration with provided credentials. */
  connect(
    integrationKey: string,
    credentials: Record<string, string>,
  ): Observable<IntegrationConnection> {
    return this.api.post<IntegrationConnection>(`${this.basePath}/connect`, {
      integrationKey,
      credentials,
    });
  }

  /** Disconnect an existing integration (clears stored credentials). */
  disconnect(id: string): Observable<IntegrationConnection> {
    return this.api.post<IntegrationConnection>(
      `${this.basePath}/${id}/disconnect`,
    );
  }

  /** Test an active integration connection. */
  testConnection(id: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>(
      `${this.basePath}/${id}/test`,
    );
  }

  /** Get activity log entries for an integration. */
  getActivityLog(id: string): Observable<IntegrationActivityLogEntry[]> {
    return this.api.get<IntegrationActivityLogEntry[]>(
      `${this.basePath}/${id}/activity`,
    );
  }
}
