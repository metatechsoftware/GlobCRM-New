import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { FeedListComponent } from './feed-list/feed-list.component';

export const FEED_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('feed')],
    children: [
      {
        path: '',
        component: FeedListComponent,
      },
    ],
  },
];
