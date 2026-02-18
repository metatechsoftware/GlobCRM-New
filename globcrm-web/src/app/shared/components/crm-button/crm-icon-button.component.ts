import { Component, input, output, computed } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export type IconButtonVariant = 'default' | 'primary' | 'danger' | 'outline';
export type IconButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'crm-icon-button',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatIconModule, MatTooltipModule],
  template: `
    <button
      [type]="type()"
      [disabled]="isDisabled()"
      [class]="buttonClasses()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-busy]="loading() || null"
      [matTooltip]="tooltip()"
      [matTooltipDisabled]="!tooltip()"
      (click)="onClick($event)">

      @if (loading()) {
        <mat-spinner [diameter]="spinnerSize()" class="crm-icon-btn__spinner" />
      } @else {
        <mat-icon>{{ icon() }}</mat-icon>
      }
    </button>
  `,
  styleUrl: './crm-icon-button.component.scss',
})
export class CrmIconButtonComponent {
  /** Material icon name */
  icon = input.required<string>();

  /** Accessible label (required — icon buttons have no visible text) */
  ariaLabel = input.required<string>();

  /** Visual variant */
  variant = input<IconButtonVariant>('default');

  /** Button size */
  size = input<IconButtonSize>('md');

  /** Tooltip text (shows on hover) */
  tooltip = input('');

  /** Show loading spinner */
  loading = input(false);

  /** Disable the button */
  disabled = input(false);

  /** HTML button type */
  type = input<'button' | 'submit' | 'reset'>('button');

  /** Emits on click (only when not disabled/loading) */
  clicked = output<MouseEvent>();

  protected isDisabled = computed(() => this.disabled() || this.loading());

  protected spinnerSize = computed(() => {
    switch (this.size()) {
      case 'sm': return 14;
      case 'lg': return 22;
      default:   return 18;
    }
  });

  protected buttonClasses = computed(() => {
    const classes = [
      'crm-icon-btn',
      `crm-icon-btn--${this.variant()}`,
      `crm-icon-btn--${this.size()}`,
    ];
    if (this.loading()) classes.push('crm-icon-btn--loading');
    return classes.join(' ');
  });

  protected onClick(event: MouseEvent): void {
    if (!this.isDisabled()) {
      this.clicked.emit(event);
    }
  }
}
