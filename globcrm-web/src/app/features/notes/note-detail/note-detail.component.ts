import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { AuthStore } from '../../../core/auth/auth.store';
import { NoteService } from '../note.service';
import { NoteDetailDto } from '../note.models';
import { ConfirmDeleteDialogComponent } from '../../settings/roles/role-list.component';

/**
 * Note detail page displaying full rich text content.
 *
 * Features:
 * - Title as page header
 * - Full rich text body rendered via [innerHTML] (Angular auto-sanitizes)
 * - Metadata: author name, entity link (clickable), created/updated dates
 * - Edit button navigates to /notes/{id}/edit
 * - Delete button with confirmation dialog
 * - Author-only edit/delete (checks current user against authorId, or admin)
 */
@Component({
  selector: 'app-note-detail',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    HasPermissionDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .detail-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 24px;
    }

    .detail-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-left h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    .action-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--mat-sys-surface-container, #f5f5f5);
      border-radius: 8px;
    }

    .action-bar .spacer {
      flex: 1;
    }

    .meta-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .meta-card {
      padding: 16px;
      background: var(--mat-sys-surface-container-low, #fafafa);
      border-radius: 8px;
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
    }

    .meta-card .label {
      font-size: 12px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-card .value {
      font-size: 14px;
      font-weight: 500;
    }

    .meta-card a {
      color: var(--mat-sys-primary, #1976d2);
      text-decoration: none;
    }

    .meta-card a:hover {
      text-decoration: underline;
    }

    .note-body {
      background: var(--mat-sys-surface, #fff);
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
      border-radius: 8px;
      padding: 24px;
      font-size: 14px;
      line-height: 1.7;
    }

    .note-body ::ng-deep h1 {
      font-size: 1.5em;
      margin-bottom: 8px;
    }

    .note-body ::ng-deep h2 {
      font-size: 1.3em;
      margin-bottom: 8px;
    }

    .note-body ::ng-deep h3 {
      font-size: 1.1em;
      margin-bottom: 8px;
    }

    .note-body ::ng-deep ul,
    .note-body ::ng-deep ol {
      padding-left: 24px;
      margin-bottom: 8px;
    }

    .note-body ::ng-deep a {
      color: var(--mat-sys-primary, #1976d2);
    }

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6));
    }

    @media (max-width: 768px) {
      .detail-header {
        flex-direction: column;
        gap: 12px;
      }

      .action-bar {
        flex-direction: column;
      }

      .meta-cards {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
  template: `
    @if (isLoading()) {
      <div class="loading-container">
        <mat-spinner diameter="48"></mat-spinner>
      </div>
    } @else if (note()) {
      <div class="detail-container">
        <!-- Header -->
        <div class="detail-header">
          <div class="header-left">
            <a mat-icon-button routerLink="/notes" aria-label="Back to notes">
              <mat-icon>arrow_back</mat-icon>
            </a>
            <h1>{{ note()!.title }}</h1>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="action-bar">
          @if (canEditOrDelete()) {
            <button mat-stroked-button [routerLink]="['/notes', note()!.id, 'edit']">
              <mat-icon>edit</mat-icon> Edit
            </button>
            <button mat-stroked-button (click)="onDelete()" color="warn">
              <mat-icon>delete</mat-icon> Delete
            </button>
          }
          <span class="spacer"></span>
        </div>

        <!-- Metadata Cards -->
        <div class="meta-cards">
          @if (note()!.authorName) {
            <div class="meta-card">
              <div class="label">Author</div>
              <div class="value">{{ note()!.authorName }}</div>
            </div>
          }
          <div class="meta-card">
            <div class="label">Entity Type</div>
            <div class="value">{{ note()!.entityType }}</div>
          </div>
          @if (note()!.entityName) {
            <div class="meta-card">
              <div class="label">{{ note()!.entityType }}</div>
              <div class="value">
                <a [routerLink]="getEntityRoute()">{{ note()!.entityName }}</a>
              </div>
            </div>
          }
          <div class="meta-card">
            <div class="label">Created</div>
            <div class="value">{{ note()!.createdAt | date:'medium' }}</div>
          </div>
          @if (note()!.updatedAt !== note()!.createdAt) {
            <div class="meta-card">
              <div class="label">Updated</div>
              <div class="value">{{ note()!.updatedAt | date:'medium' }}</div>
            </div>
          }
        </div>

        <!-- Note Body (rendered HTML) -->
        <div class="note-body" [innerHTML]="note()!.body"></div>
      </div>
    } @else {
      <div class="empty-state">
        <h2>Note not found</h2>
        <a mat-button routerLink="/notes">Back to Notes</a>
      </div>
    }
  `,
})
export class NoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly noteService = inject(NoteService);
  private readonly authStore = inject(AuthStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  /** Note detail data. */
  note = signal<NoteDetailDto | null>(null);
  isLoading = signal(true);

  /** Current note ID from route. */
  private noteId = '';

  /**
   * Computed: whether current user can edit/delete this note.
   * Author-only or admin role.
   */
  canEditOrDelete = computed(() => {
    const n = this.note();
    if (!n) return false;
    const currentUserId = this.authStore.user()?.id;
    const isAdmin = this.authStore.userRole() === 'Admin';
    return n.authorId === currentUserId || isAdmin;
  });

  ngOnInit(): void {
    this.noteId = this.route.snapshot.paramMap.get('id') ?? '';
    if (!this.noteId) {
      this.isLoading.set(false);
      return;
    }

    this.loadNote();
  }

  /** Load note detail data. */
  private loadNote(): void {
    this.isLoading.set(true);
    this.noteService.getById(this.noteId).subscribe({
      next: (note) => {
        this.note.set(note);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Build a route to the linked entity for navigation.
   * Maps entity type to the corresponding route.
   */
  getEntityRoute(): string[] {
    const n = this.note();
    if (!n) return ['/'];

    const routeMap: Record<string, string> = {
      Company: '/companies',
      Contact: '/contacts',
      Deal: '/deals',
      Quote: '/quotes',
      Request: '/requests',
    };

    const basePath = routeMap[n.entityType] ?? '/';
    return [basePath, n.entityId];
  }

  /** Delete note with confirmation dialog. */
  onDelete(): void {
    const n = this.note();
    if (!n) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: n.title, type: 'note' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.noteService.delete(this.noteId).subscribe({
          next: () => {
            this.snackBar.open('Note deleted', 'OK', { duration: 3000 });
            this.router.navigate(['/notes']);
          },
          error: () => {
            this.snackBar.open('Failed to delete note', 'OK', {
              duration: 5000,
            });
          },
        });
      }
    });
  }
}
