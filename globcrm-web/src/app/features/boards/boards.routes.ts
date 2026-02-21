import { Routes } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';
import { BoardStore } from './boards.store';
import { BoardsListComponent } from './boards-list/boards-list.component';

export const BOARD_ROUTES: Routes = [
  {
    path: '',
    providers: [provideTranslocoScope('boards'), BoardStore],
    children: [
      { path: '', component: BoardsListComponent },
      {
        path: ':id',
        loadComponent: () =>
          import('./board-detail/board-detail.component').then(
            (m) => m.BoardDetailComponent,
          ),
      },
    ],
  },
];
