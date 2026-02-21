import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { BoardStore } from '../boards.store';
import { BoardListDto, BOARD_TEMPLATES } from '../boards.models';
import { BoardCreateDialogComponent } from '../board-create-dialog/board-create-dialog.component';

interface SystemBoard {
  nameKey: string;
  descriptionKey: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-boards-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './boards-list.component.html',
  styleUrl: './boards-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardsListComponent implements OnInit {
  readonly boardStore = inject(BoardStore);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  readonly templates = BOARD_TEMPLATES;

  readonly systemBoards: SystemBoard[] = [
    {
      nameKey: 'boards.systemBoards.dealPipeline.name',
      descriptionKey: 'boards.systemBoards.dealPipeline.description',
      icon: 'handshake',
      route: '/deals/kanban',
    },
    {
      nameKey: 'boards.systemBoards.activityBoard.name',
      descriptionKey: 'boards.systemBoards.activityBoard.description',
      icon: 'task_alt',
      route: '/activities/kanban',
    },
  ];

  readonly myBoards = computed(() => {
    const userId = this.authStore.user()?.id;
    if (!userId) return [];
    return this.boardStore.boards().filter(
      (b) => b.creatorId === userId && b.visibility === 'private',
    );
  });

  readonly teamBoards = computed(() => {
    const userId = this.authStore.user()?.id;
    return this.boardStore.boards().filter(
      (b) =>
        b.visibility === 'team' ||
        b.visibility === 'public' ||
        (b.visibility === 'private' && b.creatorId !== userId),
    );
  });

  readonly hasCustomBoards = computed(
    () => this.boardStore.boards().length > 0,
  );

  ngOnInit(): void {
    this.boardStore.loadBoards();
  }

  navigateToSystem(route: string): void {
    this.router.navigate([route]);
  }

  navigateToBoard(board: BoardListDto): void {
    this.router.navigate(['/boards', board.id]);
  }

  openCreateDialog(templateKey?: string): void {
    const dialogRef = this.dialog.open(BoardCreateDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      data: { templateKey: templateKey ?? null },
      panelClass: 'boards-create-dialog',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.created) {
        this.boardStore.loadBoards();
      }
    });
  }

  deleteBoard(event: Event, board: BoardListDto): void {
    event.stopPropagation();
    const message = this.transloco.translate('boards.delete.message');
    if (!confirm(message)) return;

    this.boardStore.deleteBoard(
      board.id,
      () => {
        this.snackBar.open(
          this.transloco.translate('boards.snackbar.deleted'),
          '',
          { duration: 3000 },
        );
      },
      () => {
        this.snackBar.open(
          this.transloco.translate('boards.snackbar.error'),
          '',
          { duration: 3000 },
        );
      },
    );
  }

  getBoardColorStyle(board: BoardListDto): Record<string, string> {
    return board.color
      ? { 'background-color': board.color }
      : { 'background-color': 'var(--orange-500)' };
  }
}
