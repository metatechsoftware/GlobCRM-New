import { inject } from '@angular/core';
import {
  signalStore,
  withState,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { forkJoin } from 'rxjs';
import { FeedService } from './feed.service';
import { AttachmentService } from '../../shared/services/attachment.service';
import { FeedItemDto, FeedCommentDto, CreateFeedPostPayload } from './feed.models';

interface FeedState {
  items: FeedItemDto[];
  selectedItem: FeedItemDto | null;
  comments: FeedCommentDto[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
}

const initialState: FeedState = {
  items: [],
  selectedItem: null,
  comments: [],
  isLoading: false,
  total: 0,
  page: 1,
  pageSize: 20,
};

/**
 * Feed signal store -- component-provided (NOT root).
 * Each feed page gets its own instance.
 * Manages feed items, selected item with comments, and pagination.
 */
export const FeedStore = signalStore(
  withState(initialState),
  withMethods((store) => {
    const feedService = inject(FeedService);
    const attachmentService = inject(AttachmentService);

    return {
      /** Load feed items (first page). */
      loadFeed(): void {
        patchState(store, { isLoading: true });
        feedService.getFeed(1, store.pageSize()).subscribe({
          next: (result) => {
            patchState(store, {
              items: result.items,
              total: result.totalCount,
              page: 1,
              isLoading: false,
            });
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      /** Load more items (next page), append to existing. */
      loadMore(): void {
        const nextPage = store.page() + 1;
        patchState(store, { isLoading: true });
        feedService.getFeed(nextPage, store.pageSize()).subscribe({
          next: (result) => {
            patchState(store, {
              items: [...store.items(), ...result.items],
              total: result.totalCount,
              page: nextPage,
              isLoading: false,
            });
          },
          error: () => {
            patchState(store, { isLoading: false });
          },
        });
      },

      /** Create a social post with optional file attachments (two-step). */
      createPost(payload: CreateFeedPostPayload): void {
        feedService.createPost({ content: payload.content }).subscribe({
          next: (item) => {
            // Prepend item immediately (optimistic)
            patchState(store, {
              items: [item, ...store.items()],
              total: store.total() + 1,
            });

            // If files exist, upload them and update attachment count
            if (payload.files.length > 0) {
              forkJoin(
                payload.files.map((f) =>
                  attachmentService.upload('feeditem', item.id, f),
                ),
              ).subscribe({
                next: (attachments) => {
                  const updatedItems = store.items().map((i) =>
                    i.id === item.id
                      ? { ...i, attachmentCount: attachments.length }
                      : i,
                  );
                  patchState(store, { items: updatedItems });
                },
              });
            }
          },
        });
      },

      /** Load a single feed item with its comments. */
      loadFeedItem(id: string): void {
        feedService.getFeedItem(id).subscribe({
          next: (result) => {
            patchState(store, {
              selectedItem: result.item,
              comments: result.comments,
            });
          },
        });
      },

      /** Add a comment to a feed item. */
      addComment(feedItemId: string, content: string): void {
        feedService.addComment(feedItemId, { content }).subscribe({
          next: (comment) => {
            patchState(store, {
              comments: [...store.comments(), comment],
            });
            // Increment commentCount on the parent item in the list
            const updatedItems = store.items().map((item) =>
              item.id === feedItemId
                ? { ...item, commentCount: item.commentCount + 1 }
                : item,
            );
            patchState(store, { items: updatedItems });
          },
        });
      },

      /** Delete a feed item and remove from list. */
      deleteFeedItem(id: string): void {
        feedService.deleteFeedItem(id).subscribe({
          next: () => {
            patchState(store, {
              items: store.items().filter((item) => item.id !== id),
              total: store.total() - 1,
            });
          },
        });
      },

      /** Prepend a new item to the top of the list (for real-time updates). */
      prependItem(item: FeedItemDto): void {
        patchState(store, {
          items: [item, ...store.items()],
          total: store.total() + 1,
        });
      },
    };
  }),
);
