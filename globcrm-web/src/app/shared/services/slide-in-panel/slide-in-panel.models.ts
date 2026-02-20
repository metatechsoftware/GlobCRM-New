import { Observable } from 'rxjs';

/** Entity types that can be created from the slide-in panel. */
export type SlideInEntityType = 'Contact' | 'Company' | 'Deal' | 'Activity' | 'Note' | 'Email';

/** Defines an optional follow-up step after entity creation. */
export interface FollowUpStep {
  label: string;
  icon: string;
  action: 'link-to-company' | 'schedule-follow-up' | 'add-note';
  entityTypes?: SlideInEntityType[];
}

/** Configuration for opening a slide-in panel. */
export interface SlideInConfig {
  entityType: SlideInEntityType;
  title?: string;
  followUpSteps?: FollowUpStep[];
  context?: 'standalone' | 'preview-sidebar';
  parentEntityType?: string;
  parentEntityId?: string;
}

/** Returned when opening a slide-in panel. Emits after both creation and follow-up are resolved. */
export interface SlideInPanelRef {
  afterClosed: Observable<SlideInResult | null>;
}

/** Result after entity creation, includes which follow-up was chosen (if any). */
export interface SlideInResult {
  entity: { id: string; [key: string]: any };
  entityType: string;
  followUpAction?: string;
}

/** Tracks which step the panel is currently showing. */
export type SlideInStep = 'form' | 'follow-up';
