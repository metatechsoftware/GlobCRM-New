import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';
import { EmailTemplateStore } from '../email-template.store';
import { EmailTemplateListItem } from '../email-template.models';
import {
  CloneTemplateDialogComponent,
  CloneTemplateDialogResult,
} from './clone-template-dialog.component';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

/**
 * Email template list page with visual HTML thumbnail previews in a responsive card grid.
 * Supports category filtering, search, clone, and delete actions.
 * Component-provides EmailTemplateStore for per-page instance.
 */
@Component({
  selector: 'app-email-template-list',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    HasPermissionDirective,
  ],
  providers: [EmailTemplateStore],
  templateUrl: './email-template-list.component.html',
  styleUrl: './email-template-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplateListComponent implements OnInit {
  readonly store = inject(EmailTemplateStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly searchValue = signal('');
  readonly selectedCategoryId = signal<string | null>(null);

  ngOnInit(): void {
    this.store.loadTemplates();
    this.store.loadCategories();
  }

  onSearchChange(value: string): void {
    this.searchValue.set(value);
    this.store.setFilters({
      search: value || undefined,
      categoryId: this.selectedCategoryId() ?? undefined,
    });
  }

  onCategorySelect(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    this.store.setFilters({
      categoryId: categoryId ?? undefined,
      search: this.searchValue() || undefined,
    });
  }

  createTemplate(): void {
    this.router.navigate(['/email-templates', 'new']);
  }

  editTemplate(template: EmailTemplateListItem): void {
    this.router.navigate(['/email-templates', template.id, 'edit']);
  }

  cloneTemplate(template: EmailTemplateListItem): void {
    const dialogRef = this.dialog.open(CloneTemplateDialogComponent, {
      width: '400px',
      data: { originalName: template.name },
    });

    dialogRef.afterClosed().subscribe((result: CloneTemplateDialogResult | undefined) => {
      if (result?.name) {
        this.store.cloneTemplate(template.id, result.name, () => {
          this.snackBar.open('Template cloned successfully', 'Close', {
            duration: 3000,
          });
        });
      }
    });
  }

  deleteTemplate(template: EmailTemplateListItem): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      data: {
        type: 'Email Template',
        name: template.name,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.store.deleteTemplate(template.id, () => {
          this.snackBar.open('Template deleted', 'Close', {
            duration: 3000,
          });
        });
      }
    });
  }
}
