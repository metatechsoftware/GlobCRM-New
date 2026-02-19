import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  input,
  computed,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  MatDialog,
  MatDialogModule,
} from '@angular/material/dialog';
import { WorkflowStore } from '../workflow.store';
import { WorkflowService } from '../workflow.service';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { SaveAsTemplateDialogComponent } from './save-as-template-dialog.component';
import { ExecutionLogListComponent } from '../workflow-logs/execution-log-list.component';

@Component({
  selector: 'app-workflow-detail',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    ExecutionLogListComponent,
  ],
  providers: [WorkflowStore],
  templateUrl: './workflow-detail.component.html',
  styleUrl: './workflow-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkflowDetailComponent implements OnInit {
  /** Route param :id provided by withComponentInputBinding() */
  readonly id = input.required<string>();

  readonly store = inject(WorkflowStore);
  private readonly service = inject(WorkflowService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  /** Stats computed from execution logs */
  readonly successRate = computed(() => {
    const logs = this.store.executionLogs();
    if (logs.length === 0) return 0;
    const succeeded = logs.filter((l) => l.status === 'succeeded').length;
    return Math.round((succeeded / logs.length) * 100);
  });

  readonly failedCount = computed(() => {
    const logs = this.store.executionLogs();
    return logs.filter(
      (l) => l.status === 'failed' || l.status === 'partiallyFailed',
    ).length;
  });

  readonly recentLogs = computed(() => {
    return this.store.executionLogs().slice(0, 5);
  });

  /** Relative time helper */
  getRelativeTime(dateStr?: string): string {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  /** Format trigger summary text for display */
  formatTrigger(trigger: string): string {
    return trigger
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\s/, '')
      .trim();
  }

  ngOnInit(): void {
    const wfId = this.id();
    this.store.loadWorkflow(wfId);
    this.store.loadExecutionLogs(wfId, 1, 20);
  }

  // ---- Status Actions ----

  toggleStatus(): void {
    const wf = this.store.selectedWorkflow();
    if (!wf) return;
    const newActive = !wf.isActive;
    this.store.toggleStatus(wf.id, newActive);
    this.snackBar.open(
      newActive ? 'Workflow activated.' : 'Workflow deactivated.',
      'Close',
      { duration: 3000 },
    );
  }

  // ---- Duplicate ----

  duplicateWorkflow(): void {
    const wf = this.store.selectedWorkflow();
    if (!wf) return;
    this.store.duplicateWorkflow(wf.id, (duplicated) => {
      this.snackBar.open('Workflow duplicated.', 'Close', { duration: 3000 });
      this.router.navigate(['/workflows', duplicated.id]);
    });
  }

  // ---- Save as Template ----

  openSaveAsTemplate(): void {
    const wf = this.store.selectedWorkflow();
    if (!wf) return;

    const dialogRef = this.dialog.open(SaveAsTemplateDialogComponent, {
      width: '480px',
      data: { workflowId: wf.id, workflowName: wf.name },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.service
          .saveAsTemplate(wf.id, result)
          .subscribe({
            next: () => {
              this.snackBar.open('Saved as template.', 'Close', {
                duration: 3000,
              });
            },
            error: () => {
              this.snackBar.open('Failed to save template.', 'Close', {
                duration: 3000,
              });
            },
          });
      }
    });
  }

  // ---- Delete ----

  confirmDelete(): void {
    const wf = this.store.selectedWorkflow();
    if (!wf) return;

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: wf.name, type: 'workflow' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;
      this.store.deleteWorkflow(wf.id, () => {
        this.snackBar.open('Workflow deleted.', 'Close', { duration: 3000 });
        this.router.navigate(['/workflows']);
      });
    });
  }

  /** Flow summary when full definition is loaded */
  getFlowSummary(): string {
    const wf = this.store.selectedWorkflow();
    if (!wf?.definition) return '';
    const triggers = wf.definition.triggers?.length ?? 0;
    const conditions = wf.definition.conditions?.length ?? 0;
    const actions = wf.definition.actions?.length ?? 0;
    return `${triggers} trigger${triggers !== 1 ? 's' : ''} → ${conditions} condition${conditions !== 1 ? 's' : ''} → ${actions} action${actions !== 1 ? 's' : ''}`;
  }
}
