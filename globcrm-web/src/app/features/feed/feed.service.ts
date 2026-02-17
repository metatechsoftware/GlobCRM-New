import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';
import { ApiService } from '../../core/api/api.service';
import {
  FeedItemDto,
  FeedCommentDto,
  CreateFeedPostRequest,
  CreateCommentRequest,
} from './feed.models';

interface FeedPagedResult {
  items: FeedItemDto[];
  totalCount: number;
}

interface FeedDetailResult {
  item: FeedItemDto;
  comments: FeedCommentDto[];
}

/**
 * API service for feed operations.
 * Communicates with FeedController endpoints.
 */
@Injectable({ providedIn: 'root' })
export class FeedService {
  private readonly api = inject(ApiService);

  /** GET /api/feed?page={page}&pageSize={pageSize} */
  getFeed(page: number, pageSize: number): Observable<FeedPagedResult> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.api.get<FeedPagedResult>('/api/feed', params);
  }

  /** POST /api/feed */
  createPost(request: CreateFeedPostRequest): Observable<FeedItemDto> {
    return this.api.post<FeedItemDto>('/api/feed', request);
  }

  /** GET /api/feed/{id} */
  getFeedItem(id: string): Observable<FeedDetailResult> {
    return this.api.get<FeedDetailResult>(`/api/feed/${id}`);
  }

  /** POST /api/feed/{feedItemId}/comments */
  addComment(feedItemId: string, request: CreateCommentRequest): Observable<FeedCommentDto> {
    return this.api.post<FeedCommentDto>(`/api/feed/${feedItemId}/comments`, request);
  }

  /** DELETE /api/feed/{id} */
  deleteFeedItem(id: string): Observable<void> {
    return this.api.delete<void>(`/api/feed/${id}`);
  }
}
