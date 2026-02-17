import { Injectable, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { AuthStore } from '../auth/auth.store';
import { environment } from '../../../environments/environment.development';
import { NotificationDto } from '../../features/notifications/notification.models';
import { ImportProgress } from '../../features/import/import.models';

export interface FeedItemDto {
  id: string;
  type: string;
  content: string;
  entityType?: string;
  entityId?: string;
  authorId?: string;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  commentCount: number;
}

export interface FeedCommentDto {
  feedItemId: string;
  comment: {
    id: string;
    content: string;
    authorId?: string;
    authorName: string;
    authorAvatarUrl?: string;
    createdAt: string;
  };
}

/**
 * Singleton SignalR connection manager.
 * Manages WebSocket lifecycle with auto-reconnect, exposes typed observables
 * for ReceiveNotification, FeedUpdate, and FeedCommentAdded hub events.
 * Connection starts after login and stops on logout (driven by AppComponent).
 */
@Injectable({ providedIn: 'root' })
export class SignalRService {
  private readonly authStore = inject(AuthStore);

  private connection: signalR.HubConnection | null = null;

  /** Current connection state signal. */
  readonly connectionState = signal<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // Private subjects for hub events
  private readonly notificationSubject = new Subject<NotificationDto>();
  private readonly feedUpdateSubject = new Subject<FeedItemDto>();
  private readonly feedCommentSubject = new Subject<FeedCommentDto>();
  private readonly importProgressSubject = new Subject<ImportProgress>();

  /** Emits when a ReceiveNotification hub event is received. */
  readonly notification$ = this.notificationSubject.asObservable();

  /** Emits when a FeedUpdate hub event is received. */
  readonly feedUpdate$ = this.feedUpdateSubject.asObservable();

  /** Emits when a FeedCommentAdded hub event is received. */
  readonly feedComment$ = this.feedCommentSubject.asObservable();

  /** Emits when an ImportProgress hub event is received. */
  readonly importProgress$ = this.importProgressSubject.asObservable();

  /**
   * Builds and starts the SignalR hub connection.
   * Registers handlers for ReceiveNotification, FeedUpdate, FeedCommentAdded.
   * Configures automatic reconnect with backoff: [0, 2s, 10s, 30s].
   */
  start(): void {
    if (this.connection) {
      return;
    }

    this.connectionState.set('connecting');

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(`${environment.apiUrl}/hubs/crm`, {
        accessTokenFactory: () => this.authStore.accessToken() ?? '',
      })
      .withAutomaticReconnect([0, 2000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Register hub event handlers
    this.connection.on('ReceiveNotification', (dto: NotificationDto) => {
      this.notificationSubject.next(dto);
    });

    this.connection.on('FeedUpdate', (dto: FeedItemDto) => {
      this.feedUpdateSubject.next(dto);
    });

    this.connection.on('FeedCommentAdded', (dto: FeedCommentDto) => {
      this.feedCommentSubject.next(dto);
    });

    this.connection.on('ImportProgress', (dto: ImportProgress) => {
      this.importProgressSubject.next(dto);
    });

    // Connection state handlers
    this.connection.onreconnecting(() => {
      this.connectionState.set('connecting');
    });

    this.connection.onreconnected(() => {
      this.connectionState.set('connected');
    });

    this.connection.onclose(() => {
      this.connectionState.set('disconnected');
    });

    this.connection
      .start()
      .then(() => this.connectionState.set('connected'))
      .catch((err) => {
        console.error('SignalR connection failed:', err);
        this.connectionState.set('disconnected');
      });
  }

  /**
   * Stops the SignalR connection and resets state.
   */
  stop(): void {
    if (this.connection) {
      this.connection.stop().catch(() => {
        // Ignore stop errors
      });
      this.connection = null;
      this.connectionState.set('disconnected');
    }
  }
}
