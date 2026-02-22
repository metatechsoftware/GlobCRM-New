import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { QuoteTemplateService } from '../quote-template.service';
import { ApiService } from '../../../core/api/api.service';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';

export interface QuotePreviewDialogData {
  templateId: string;
}

interface QuoteOption {
  id: string;
  quoteNumber: string;
  title: string;
}

/**
 * Preview dialog for quote PDF templates.
 * Shows rendered template HTML with real quote data in an iframe.
 * Includes quote selector dropdown and PDF download button.
 * Opens as a MatDialog from the editor toolbar.
 */
@Component({
  selector: 'app-quote-template-preview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslocoPipe,
    SafeHtmlPipe,
  ],
  templateUrl: './quote-template-preview.component.html',
  styleUrl: './quote-template-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteTemplatePreviewComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<QuoteTemplatePreviewComponent>);
  private readonly data: QuotePreviewDialogData = inject(MAT_DIALOG_DATA);
  private readonly service = inject(QuoteTemplateService);
  private readonly api = inject(ApiService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  // ---- State ----
  readonly quotes = signal<QuoteOption[]>([]);
  readonly selectedQuoteId = signal<string | null>(null);
  readonly previewHtml = signal<string | null>(null);
  readonly loading = signal(false);
  readonly loadingQuotes = signal(false);
  readonly downloading = signal(false);
  readonly error = signal<string | null>(null);

  get templateId(): string {
    return this.data.templateId;
  }

  ngOnInit(): void {
    this.loadQuotes();
  }

  // ---- Load Quotes ----

  loadQuotes(): void {
    this.loadingQuotes.set(true);
    this.api
      .get<{ items: any[] }>('/api/quotes', undefined)
      .subscribe({
        next: (result) => {
          const options: QuoteOption[] = (result.items || []).map((q: any) => ({
            id: q.id,
            quoteNumber: q.quoteNumber ?? q.number ?? '',
            title: q.title ?? '',
          }));
          this.quotes.set(options);
          this.loadingQuotes.set(false);

          // Auto-select first quote if available
          if (options.length > 0) {
            this.selectedQuoteId.set(options[0].id);
            this.loadPreview();
          }
        },
        error: () => {
          this.loadingQuotes.set(false);
        },
      });
  }

  // ---- Quote Selection ----

  onQuoteSelected(quoteId: string): void {
    this.selectedQuoteId.set(quoteId);
    this.loadPreview();
  }

  // ---- Preview ----

  loadPreview(): void {
    const quoteId = this.selectedQuoteId();
    if (!quoteId) return;

    this.loading.set(true);
    this.error.set(null);

    this.service.getPreviewHtml(this.templateId, quoteId).subscribe({
      next: (html: string) => {
        this.previewHtml.set(html);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.transloco.translate('quoteTemplates.preview.error'));
        this.loading.set(false);
      },
    });
  }

  // ---- PDF Download ----

  downloadPdf(): void {
    const quoteId = this.selectedQuoteId();
    if (!quoteId) return;

    this.downloading.set(true);

    this.service.generatePdf(quoteId, this.templateId).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `quote-${quoteId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.snackBar.open(
          this.transloco.translate('quoteTemplates.preview.downloadError'),
          this.transloco.translate('common.close'),
          { duration: 3000 },
        );
        this.downloading.set(false);
      },
    });
  }

  // ---- Close ----

  close(): void {
    this.dialogRef.close();
  }
}
