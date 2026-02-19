import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { FormsModule } from '@angular/forms';
import { WorkflowStore } from '../workflow.store';
import { WorkflowListItem } from '../workflow.models';
import { WorkflowCardComponent } from './workflow-card.component';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

/**
 * Workflow list page with card grid layout displaying miniaturized flow
 * diagram thumbnails. Locked decision: card grid with SVG flow thumbnails,
 * NOT DynamicTable.
 *
 * Features:
 * - CSS Grid with responsive columns (1 mobile, 2 medium, 3 large)
 * - Entity type and status filter dropdowns
 * - Skeleton loading state with pulsing cards
 * - Empty state with create CTA
 * - Pagination for > 20 workflows
 */
@Component({
  selector: 'app-workflow-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatPaginatorModule,
    WorkflowCardComponent,
  ],
  providers: [WorkflowStore],
  templateUrl: './workflow-list.component.html',
  styleUrl: './workflow-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowListComponent implements OnInit {
  readonly store = inject(WorkflowStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly entityTypeFilter = signal<string>('');
  readonly statusFilter = signal<string>('');

  readonly entityTypes = [
    { value: '', label: 'All Entity Types' },
    { value: 'Contact', label: 'Contact' },
    { value: 'Company', label: 'Company' },
    { value: 'Deal', label: 'Deal' },
    { value: 'Lead', label: 'Lead' },
    { value: 'Activity', label: 'Activity' },
  ];

  readonly statuses = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
  ];

  /** Skeleton items for loading state */
  readonly skeletonItems = [1, 2, 3, 4];

  /** Stats ribbon counts */
  readonly activeCount = computed(() =>
    this.store.workflows().filter(w => w.status === 'active').length,
  );
  readonly pausedCount = computed(() =>
    this.store.workflows().filter(w => w.status === 'paused').length,
  );
  readonly draftCount = computed(() =>
    this.store.workflows().filter(w => w.status === 'draft').length,
  );

  ngOnInit(): void {
    this.loadWorkflows();
  }

  onEntityTypeChange(value: string): void {
    this.entityTypeFilter.set(value);
    this.loadWorkflows();
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value);
    this.loadWorkflows();
  }

  onPageChange(event: PageEvent): void {
    this.store.loadWorkflows({
      entityType: this.entityTypeFilter() || undefined,
      status: this.statusFilter() || undefined,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    });
  }

  onCardClick(workflow: WorkflowListItem): void {
    this.router.navigate(['/workflows', workflow.id]);
  }

  onToggleStatus(workflow: WorkflowListItem): void {
    this.store.toggleStatus(workflow.id, !workflow.isActive);
    const action = workflow.isActive ? 'disabled' : 'enabled';
    this.snackBar.open(
      `Workflow "${workflow.name}" ${action}.`,
      'Close',
      { duration: 3000 },
    );
  }

  onEdit(workflow: WorkflowListItem): void {
    this.router.navigate(['/workflows', workflow.id, 'edit']);
  }

  onDuplicate(workflow: WorkflowListItem): void {
    this.store.duplicateWorkflow(workflow.id, (duplicated) => {
      this.snackBar.open(
        `Workflow duplicated as "${duplicated.name}".`,
        'Close',
        { duration: 3000 },
      );
      this.loadWorkflows();
    });
  }

  onDelete(workflow: WorkflowListItem): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: workflow.name, type: 'workflow' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.store.deleteWorkflow(workflow.id, () => {
        this.snackBar.open(
          `Workflow "${workflow.name}" deleted.`,
          'Close',
          { duration: 3000 },
        );
      });
    });
  }

  private loadWorkflows(): void {
    this.store.loadWorkflows({
      entityType: this.entityTypeFilter() || undefined,
      status: this.statusFilter() || undefined,
    });
  }
}
