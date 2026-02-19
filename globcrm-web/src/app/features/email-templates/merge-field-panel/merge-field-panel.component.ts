import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MergeFieldGroup, MergeField } from '../email-template.models';

/**
 * Entity color configuration for merge field chips.
 * Colors match the Unlayer merge tag group colors for visual consistency.
 */
const ENTITY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  contact: { bg: '#E3F2FD', text: '#1565C0', label: 'Contact' },
  company: { bg: '#E8F5E9', text: '#2E7D32', label: 'Company' },
  deal: { bg: '#FFF3E0', text: '#E65100', label: 'Deal' },
  lead: { bg: '#F3E5F5', text: '#7B1FA2', label: 'Lead' },
};

/**
 * Side panel component for browsing and copying merge fields.
 * Displays merge fields grouped by entity with color-coded chips.
 * Clicking a chip copies the merge tag syntax to clipboard.
 *
 * This is supplementary to Unlayer's built-in merge tag toolbar dropdown
 * and inline {{ autocomplete which are configured via editor options.
 */
@Component({
  selector: 'app-merge-field-panel',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './merge-field-panel.component.html',
  styleUrl: './merge-field-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MergeFieldPanelComponent {
  private readonly clipboard = inject(Clipboard);
  private readonly snackBar = inject(MatSnackBar);

  /** Merge fields grouped by entity type */
  readonly mergeFields = input<MergeFieldGroup>({});

  /** Event emitted when user clicks close button */
  readonly closePanel = output<void>();

  /** Get entity groups for display */
  get entityGroups(): string[] {
    return Object.keys(this.mergeFields());
  }

  readonly copiedField = signal<string | null>(null);

  /** Get the display config for an entity group */
  getEntityConfig(group: string): { bg: string; text: string; label: string } {
    return ENTITY_COLORS[group.toLowerCase()] || {
      bg: '#ECEFF1',
      text: '#37474F',
      label: group,
    };
  }

  /** Get icon name for an entity group */
  getEntityIcon(group: string): string {
    const icons: Record<string, string> = {
      contact: 'people',
      company: 'business',
      deal: 'handshake',
      lead: 'person_search',
    };
    return icons[group.toLowerCase()] ?? 'label';
  }

  /** Get fields for a specific group */
  getFields(group: string): MergeField[] {
    return this.mergeFields()[group] || [];
  }

  /** Copy merge tag syntax to clipboard */
  copyMergeTag(field: MergeField): void {
    const tag = `{{${field.key}}}`;
    this.clipboard.copy(tag);
    this.copiedField.set(field.key);
    setTimeout(() => this.copiedField.set(null), 1500);
    this.snackBar.open(
      `Copied ${tag} -- paste in editor or use Unlayer toolbar to insert`,
      'Close',
      { duration: 3000 },
    );
  }
}
