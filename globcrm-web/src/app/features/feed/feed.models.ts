/**
 * Feed item type enum.
 */
export enum FeedItemType {
  SystemEvent = 'SystemEvent',
  SocialPost = 'SocialPost',
}

/**
 * Feed item DTO returned by the API.
 */
export interface FeedItemDto {
  id: string;
  type: FeedItemType | string;
  content: string;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
  commentCount: number;
}

/**
 * Feed comment DTO returned by the API.
 */
export interface FeedCommentDto {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  createdAt: string;
}

/**
 * Request body for creating a social post.
 */
export interface CreateFeedPostRequest {
  content: string;
}

/**
 * Request body for adding a comment to a feed item.
 */
export interface CreateCommentRequest {
  content: string;
}
