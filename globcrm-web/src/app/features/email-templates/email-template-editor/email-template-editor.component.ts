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
import { MatSidenavModule } from '@angular/material/sidenav';
import { EmailEditorModule, EmailEditorComponent } from 'angular-email-editor';
import { EmailTemplateStore } from '../email-template.store';
import { MergeFieldGroup } from '../email-template.models';
import { MergeFieldPanelComponent } from '../merge-field-panel/merge-field-panel.component';

/**
 * Email template editor page wrapping the Unlayer drag-and-drop editor.
 * Supports creating new templates and editing existing ones.
 * Merge tags are configured from API-loaded merge fields with entity-specific colors.
 * Saves both design JSON (for re-editing) and compiled HTML (for rendering/sending).
 */
@Component({
  selector: 'app-email-template-editor',
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
    MatSidenavModule,
    EmailEditorModule,
    MergeFieldPanelComponent,
  ],
  providers: [EmailTemplateStore],
  templateUrl: './email-template-editor.component.html',
  styleUrl: './email-template-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmailTemplateEditorComponent implements OnInit {
  @ViewChild('emailEditor') emailEditor!: EmailEditorComponent;

  /** Route param: template ID (null for create mode) */
  readonly id = input<string | undefined>(undefined);

  readonly store = inject(EmailTemplateStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  // ─── Form State ────────────────────────────────────────────────────────

  readonly templateName = signal('');
  readonly templateSubject = signal('');
  readonly selectedCategoryId = signal<string | null>(null);
  readonly isShared = signal(true);
  readonly saving = signal(false);
  readonly editorReady = signal(false);
  readonly showMergePanel = signal(false);

  readonly isEditMode = computed(() => !!this.id());
  readonly pageTitle = computed(() => (this.isEditMode() ? 'Edit Template' : 'New Template'));

  // ─── Unlayer Editor Options ────────────────────────────────────────────

  readonly editorOptions = computed(() => {
    const mergeFields = this.store.mergeFields();
    return {
      displayMode: 'email' as const,
      features: {
        textEditor: {
          spellChecker: true,
        },
      },
      appearance: {
        theme: 'light' as const,
      },
      mergeTags: this.buildMergeTags(mergeFields),
    };
  });

  constructor() {
    // When merge fields load, update the editor merge tags dynamically
    effect(() => {
      const mergeFields = this.store.mergeFields();
      if (
        this.editorReady() &&
        this.emailEditor?.editor &&
        Object.keys(mergeFields).length > 0
      ) {
        const tags = this.buildMergeTags(mergeFields);
        this.emailEditor.editor.setMergeTags(tags);
      }
    });

    // When template loads (edit mode), populate form fields and load design
    effect(() => {
      const template = this.store.selectedTemplate();
      if (template && this.editorReady()) {
        this.templateName.set(template.name);
        this.templateSubject.set(template.subject ?? '');
        this.selectedCategoryId.set(template.categoryId);
        this.isShared.set(template.isShared);

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
    this.store.loadCategories();
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
      this.templateSubject.set(template.subject ?? '');
      this.selectedCategoryId.set(template.categoryId);
      this.isShared.set(template.isShared);

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
      const tags = this.buildMergeTags(mergeFields);
      this.emailEditor.editor.setMergeTags(tags);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────

  save(): void {
    if (!this.templateName().trim()) {
      this.snackBar.open('Template name is required', 'Close', {
        duration: 3000,
      });
      return;
    }

    this.saving.set(true);

    this.emailEditor.exportHtml((data: { design: object; html: string }) => {
      const request = {
        name: this.templateName().trim(),
        subject: this.templateSubject().trim() || null,
        designJson: JSON.stringify(data.design),
        htmlBody: data.html,
        categoryId: this.selectedCategoryId(),
        isShared: this.isShared(),
      };

      const templateId = this.id();
      if (templateId) {
        // Update existing
        this.store.updateTemplate(templateId, request, () => {
          this.saving.set(false);
          this.snackBar.open('Template saved successfully', 'Close', {
            duration: 3000,
          });
        });
      } else {
        // Create new
        this.store.createTemplate(request, () => {
          this.saving.set(false);
          this.snackBar.open('Template created successfully', 'Close', {
            duration: 3000,
          });
          this.router.navigate(['/email-templates']);
        });
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/email-templates']);
  }

  toggleMergePanel(): void {
    this.showMergePanel.update((v) => !v);
  }

  // ─── Merge Tag Builder ─────────────────────────────────────────────────

  /**
   * Builds Unlayer-compatible merge tags configuration from API merge fields.
   * Each entity group gets a color property so merge tags render as
   * entity-color-coded chip/badge pills inside the Unlayer editor.
   */
  private buildMergeTags(mergeFields: MergeFieldGroup): Record<string, unknown> {
    const entityColors: Record<string, string> = {
      contact: '#2196F3', // Blue
      company: '#4CAF50', // Green
      deal: '#FF9800', // Orange
      lead: '#9C27B0', // Purple
    };

    const entityNames: Record<string, string> = {
      contact: 'Contact',
      company: 'Company',
      deal: 'Deal',
      lead: 'Lead',
    };

    const tags: Record<string, unknown> = {};

    for (const [group, fields] of Object.entries(mergeFields)) {
      const groupKey = group.toLowerCase();
      const mergeTags: Record<string, { name: string; value: string }> = {};

      for (const field of fields) {
        const fieldKey = field.key.replace(`${groupKey}.`, '');
        mergeTags[fieldKey] = {
          name: field.label,
          value: `{{${field.key}}}`,
        };
      }

      tags[groupKey] = {
        name: entityNames[groupKey] || group,
        color: entityColors[groupKey] || '#607D8B',
        mergeTags,
      };
    }

    return tags;
  }
}
