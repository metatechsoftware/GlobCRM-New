import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmailEditorModule, EmailEditorComponent } from 'angular-email-editor';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { QuoteTemplateStore } from '../quote-template.store';
import { QuoteTemplatePreviewComponent, QuotePreviewDialogData } from '../quote-template-preview/quote-template-preview.component';

/**
 * Full-page Unlayer template editor for quote PDF templates.
 * Uses displayMode: 'web' (not 'email') for full-page document layout.
 * Merge tags configured with all categories: quote, line_items (with repeat rules),
 * contact, company, deal, organization.
 * Saves both design JSON (for re-editing) and compiled HTML (for Fluid/Playwright rendering).
 */
@Component({
  selector: 'app-quote-template-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    EmailEditorModule,
    TranslocoPipe,
  ],
  templateUrl: './quote-template-editor.component.html',
  styleUrl: './quote-template-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuoteTemplateEditorComponent implements OnInit {
  @ViewChild('emailEditor') emailEditor!: EmailEditorComponent;

  /** Route param: template ID (undefined for create mode) */
  readonly id = input<string | undefined>(undefined);

  readonly store = inject(QuoteTemplateStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

  // ─── Form State ────────────────────────────────────────────────────────

  readonly templateName = signal('');
  readonly pageSize = signal<'A4' | 'Letter'>('A4');
  readonly pageOrientation = signal<'portrait' | 'landscape'>('portrait');
  readonly marginTop = signal('20mm');
  readonly marginRight = signal('15mm');
  readonly marginBottom = signal('20mm');
  readonly marginLeft = signal('15mm');
  readonly isDefault = signal(false);
  readonly saving = signal(false);
  readonly editorReady = signal(false);

  readonly isEditMode = computed(() => !!this.id());
  readonly pageTitle = computed(() =>
    this.isEditMode()
      ? this.transloco.translate('quoteTemplates.editor.editTitle')
      : this.transloco.translate('quoteTemplates.editor.newTitle'),
  );

  // ─── Unlayer Editor Options (CRITICAL: displayMode 'web') ────────────

  readonly editorOptions = computed(() => ({
    displayMode: 'web' as const,
    features: {
      textEditor: { spellChecker: true },
    },
    appearance: {
      theme: 'light' as const,
    },
    mergeTags: this.buildQuoteMergeTags(),
  }));

  constructor() {
    // When merge fields load from API, update editor merge tags dynamically
    effect(() => {
      const mergeFields = this.store.mergeFields();
      if (
        this.editorReady() &&
        this.emailEditor?.editor &&
        Object.keys(mergeFields).length > 0
      ) {
        const tags = this.buildQuoteMergeTags();
        this.emailEditor.editor.setMergeTags(tags);
      }
    });

    // When template loads (edit mode), populate form fields and load design
    effect(() => {
      const template = this.store.selectedTemplate();
      if (template && this.editorReady()) {
        this.templateName.set(template.name);
        this.pageSize.set(template.pageSize as 'A4' | 'Letter');
        this.pageOrientation.set(template.pageOrientation as 'portrait' | 'landscape');
        this.marginTop.set(template.pageMarginTop);
        this.marginRight.set(template.pageMarginRight);
        this.marginBottom.set(template.pageMarginBottom);
        this.marginLeft.set(template.pageMarginLeft);
        this.isDefault.set(template.isDefault);

        try {
          const design = JSON.parse(template.designJson);
          this.emailEditor.loadDesign(design);
        } catch {
          // If design JSON is invalid, start with blank editor
        }
      }
    });
  }

  ngOnInit(): void {
    this.store.loadMergeFields();

    const templateId = this.id();
    if (templateId) {
      this.store.loadTemplate(templateId);
    }
  }

  // ─── Editor Events ─────────────────────────────────────────────────────

  onEditorLoaded(): void {
    // Editor script loaded
  }

  onEditorReady(): void {
    this.editorReady.set(true);

    // If we already have a template loaded (edit mode), load its design
    const template = this.store.selectedTemplate();
    if (template) {
      this.templateName.set(template.name);
      this.pageSize.set(template.pageSize as 'A4' | 'Letter');
      this.pageOrientation.set(template.pageOrientation as 'portrait' | 'landscape');
      this.marginTop.set(template.pageMarginTop);
      this.marginRight.set(template.pageMarginRight);
      this.marginBottom.set(template.pageMarginBottom);
      this.marginLeft.set(template.pageMarginLeft);
      this.isDefault.set(template.isDefault);

      try {
        const design = JSON.parse(template.designJson);
        this.emailEditor.loadDesign(design);
      } catch {
        // If design JSON is invalid, start with blank editor
      }
    }

    // Set merge tags if already loaded
    const mergeFields = this.store.mergeFields();
    if (Object.keys(mergeFields).length > 0) {
      const tags = this.buildQuoteMergeTags();
      this.emailEditor.editor.setMergeTags(tags);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────

  save(): void {
    if (!this.templateName().trim()) {
      this.snackBar.open(
        this.transloco.translate('quoteTemplates.messages.nameRequired'),
        this.transloco.translate('common.close'),
        { duration: 3000 },
      );
      return;
    }

    this.saving.set(true);

    this.emailEditor.exportHtml((data: { design: object; html: string }) => {
      const request = {
        name: this.templateName().trim(),
        designJson: JSON.stringify(data.design),
        htmlBody: data.html,
        pageSize: this.pageSize(),
        pageOrientation: this.pageOrientation(),
        pageMarginTop: this.marginTop(),
        pageMarginRight: this.marginRight(),
        pageMarginBottom: this.marginBottom(),
        pageMarginLeft: this.marginLeft(),
        isDefault: this.isDefault(),
      };

      const templateId = this.id();
      if (templateId) {
        // Update existing
        this.store.updateTemplate(templateId, request, () => {
          this.saving.set(false);
          this.snackBar.open(
            this.transloco.translate('quoteTemplates.messages.saved'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
        });
      } else {
        // Create new
        this.store.createTemplate(request, () => {
          this.saving.set(false);
          this.snackBar.open(
            this.transloco.translate('quoteTemplates.messages.created'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
          this.router.navigate(['/quote-templates']);
        });
      }
    });
  }

  // ─── Preview ─────────────────────────────────────────────────────────

  openPreview(): void {
    const templateId = this.id();
    if (!templateId) {
      this.snackBar.open(
        this.transloco.translate('quoteTemplates.messages.saveBeforePreview'),
        this.transloco.translate('common.close'),
        { duration: 3000 },
      );
      return;
    }

    // Save current state first, then open preview
    this.emailEditor.exportHtml((data: { design: object; html: string }) => {
      const request = {
        name: this.templateName().trim(),
        designJson: JSON.stringify(data.design),
        htmlBody: data.html,
        pageSize: this.pageSize(),
        pageOrientation: this.pageOrientation(),
        pageMarginTop: this.marginTop(),
        pageMarginRight: this.marginRight(),
        pageMarginBottom: this.marginBottom(),
        pageMarginLeft: this.marginLeft(),
        isDefault: this.isDefault(),
      };

      this.store.updateTemplate(templateId, request, () => {
        this.dialog.open(QuoteTemplatePreviewComponent, {
          width: '90vw',
          maxWidth: '900px',
          height: '85vh',
          data: { templateId } as QuotePreviewDialogData,
        });
      });
    });
  }

  goBack(): void {
    this.router.navigate(['/quote-templates']);
  }

  // ─── Merge Tag Builder ─────────────────────────────────────────────────

  /**
   * Builds Unlayer-compatible merge tags with all quote template categories.
   * Uses entity-specific colors for visual merge tag chips in the editor.
   * Line items include rules.repeat for Fluid {% for %} loop support.
   */
  private buildQuoteMergeTags(): Record<string, unknown> {
    return {
      quote: {
        name: 'Quote',
        color: '#EA580C',
        mergeTags: {
          number: { name: 'Quote Number', value: '{{quote.number}}', sample: 'Q-0042' },
          title: { name: 'Title', value: '{{quote.title}}', sample: 'Enterprise License' },
          description: { name: 'Description', value: '{{quote.description}}', sample: 'Annual enterprise software licensing and support agreement' },
          status: { name: 'Status', value: '{{quote.status}}', sample: 'Draft' },
          issue_date: { name: 'Issue Date', value: '{{quote.issue_date}}', sample: '2026-02-21' },
          expiry_date: { name: 'Expiry Date', value: '{{quote.expiry_date}}', sample: '2026-03-21' },
          subtotal: { name: 'Subtotal', value: '{{quote.subtotal}}', sample: '10,000.00' },
          discount_total: { name: 'Discount Total', value: '{{quote.discount_total}}', sample: '500.00' },
          tax_total: { name: 'Tax Total', value: '{{quote.tax_total}}', sample: '1,710.00' },
          grand_total: { name: 'Grand Total', value: '{{quote.grand_total}}', sample: '11,210.00' },
          notes: { name: 'Notes', value: '{{quote.notes}}', sample: 'Payment due within 30 days.' },
          version: { name: 'Version', value: '{{quote.version}}', sample: '1' },
        },
      },
      line_items: {
        name: 'Line Items',
        color: '#FB923C',
        rules: {
          repeat: {
            name: 'Repeat for Each Line Item',
            before: '{% for item in line_items %}',
            after: '{% endfor %}',
          },
        },
        mergeTags: {
          description: { name: 'Description', value: '{{item.description}}', sample: 'Enterprise License' },
          quantity: { name: 'Quantity', value: '{{item.quantity}}', sample: '10' },
          unit_price: { name: 'Unit Price', value: '{{item.unit_price}}', sample: '1,000.00' },
          discount_percent: { name: 'Discount %', value: '{{item.discount_percent}}', sample: '5' },
          tax_percent: { name: 'Tax %', value: '{{item.tax_percent}}', sample: '18' },
          line_total: { name: 'Line Total', value: '{{item.line_total}}', sample: '10,000.00' },
          net_total: { name: 'Net Total', value: '{{item.net_total}}', sample: '10,710.00' },
        },
      },
      contact: {
        name: 'Contact',
        color: '#60A5FA',
        mergeTags: {
          first_name: { name: 'First Name', value: '{{contact.first_name}}', sample: 'John' },
          last_name: { name: 'Last Name', value: '{{contact.last_name}}', sample: 'Doe' },
          email: { name: 'Email', value: '{{contact.email}}', sample: 'john@acme.com' },
          phone: { name: 'Phone', value: '{{contact.phone}}', sample: '+1-555-0100' },
          job_title: { name: 'Job Title', value: '{{contact.job_title}}', sample: 'VP of Procurement' },
        },
      },
      company: {
        name: 'Company',
        color: '#34D399',
        mergeTags: {
          name: { name: 'Company Name', value: '{{company.name}}', sample: 'Acme Corp' },
          industry: { name: 'Industry', value: '{{company.industry}}', sample: 'Technology' },
          website: { name: 'Website', value: '{{company.website}}', sample: 'https://acme.com' },
          phone: { name: 'Phone', value: '{{company.phone}}', sample: '+1-555-0200' },
          address: { name: 'Address', value: '{{company.address}}', sample: '123 Main St, San Francisco, CA' },
        },
      },
      deal: {
        name: 'Deal',
        color: '#FBBF24',
        mergeTags: {
          title: { name: 'Deal Title', value: '{{deal.title}}', sample: 'Enterprise License Deal' },
          value: { name: 'Value', value: '{{deal.value}}', sample: '50,000.00' },
          stage: { name: 'Stage', value: '{{deal.stage}}', sample: 'Proposal' },
          close_date: { name: 'Close Date', value: '{{deal.close_date}}', sample: '2026-04-15' },
        },
      },
      organization: {
        name: 'Organization',
        color: '#A78BFA',
        mergeTags: {
          name: { name: 'Org Name', value: '{{organization.name}}', sample: 'My CRM Company' },
          logo_url: { name: 'Logo URL', value: '{{organization.logo_url}}', sample: 'https://example.com/logo.png' },
          address: { name: 'Address', value: '{{organization.address}}', sample: '456 Business Ave, New York, NY' },
          phone: { name: 'Phone', value: '{{organization.phone}}', sample: '+1-555-0300' },
          email: { name: 'Email', value: '{{organization.email}}', sample: 'info@company.com' },
          website: { name: 'Website', value: '{{organization.website}}', sample: 'https://company.com' },
        },
      },
    };
  }
}
