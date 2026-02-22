import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { QuoteTemplateStore } from '../quote-template.store';
import { QuoteTemplateListItem } from '../quote-template.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';

/**
 * Quote template list page with card grid layout and thumbnail previews.
 * Supports clone, set-default, delete, and edit actions via three-dot menu.
 * Uses QuoteTemplateStore provided at route level (shared with editor).
 */
@Component({
  selector: 'app-quote-template-list',
  standalone: true,
  imports: [
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './quote-template-list.component.html',
  styleUrl: './quote-template-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteTemplateListComponent implements OnInit {
  readonly store = inject(QuoteTemplateStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  ngOnInit(): void {
    this.store.loadTemplates();
  }

  createTemplate(): void {
    this.router.navigate(['/quote-templates', 'new']);
  }

  editTemplate(id: string): void {
    this.router.navigate(['/quote-templates', 'edit', id]);
  }

  cloneTemplate(template: QuoteTemplateListItem): void {
    this.store.cloneTemplate(template.id, () => {
      this.snackBar.open(
        this.transloco.translate('quoteTemplates.messages.cloned'),
        this.transloco.translate('common.close'),
        { duration: 3000 },
      );
    });
  }

  setDefault(template: QuoteTemplateListItem): void {
    this.store.setDefault(template.id, () => {
      this.snackBar.open(
        this.transloco.translate('quoteTemplates.messages.setAsDefault'),
        this.transloco.translate('common.close'),
        { duration: 3000 },
      );
    });
  }

  deleteTemplate(template: QuoteTemplateListItem): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        type: 'Quote Template',
        name: template.name,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.store.deleteTemplate(template.id, () => {
          this.snackBar.open(
            this.transloco.translate('quoteTemplates.messages.deleted'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
        });
      }
    });
  }

  getThumbnailUrl(template: QuoteTemplateListItem): string | null {
    return template.thumbnailUrl || null;
  }
}
