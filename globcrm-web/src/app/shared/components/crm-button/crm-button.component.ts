import { Component, input, output, computed } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'crm-button',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatIconModule],
  template: `
    <button
      [type]="type()"
      [disabled]="isDisabled()"
      [class]="buttonClasses()"
      [attr.aria-busy]="loading() || null"
      [attr.aria-disabled]="isDisabled() || null"
      (click)="onClick($event)">

      @if (loading()) {
        <mat-spinner [diameter]="spinnerSize()" class="crm-btn__spinner" />
      }

      <span class="crm-btn__content" [class.crm-btn__content--loading]="loading()">
        @if (iconLeft()) {
          <mat-icon class="crm-btn__icon crm-btn__icon--left">{{ iconLeft() }}</mat-icon>
        }
        <ng-content />
        @if (iconRight()) {
          <mat-icon class="crm-btn__icon crm-btn__icon--right">{{ iconRight() }}</mat-icon>
        }
      </span>
    </button>
  `,
  styleUrl: './crm-button.component.scss',
})
export class CrmButtonComponent {
  /** Visual style of the button */
  variant = input<ButtonVariant>('primary');

  /** Size of the button */
  size = input<ButtonSize>('md');

  /** Show loading spinner and disable interaction */
  loading = input(false);

  /** Disable the button */
  disabled = input(false);

  /** HTML button type */
  type = input<'button' | 'submit' | 'reset'>('button');

  /** Material icon name to show before text */
  iconLeft = input<string>('');

  /** Material icon name to show after text */
  iconRight = input<string>('');

  /** Stretch to full width of container */
  fullWidth = input(false);

  /** Emits on click (only when not disabled/loading) */
  clicked = output<MouseEvent>();

  protected isDisabled = computed(() => this.disabled() || this.loading());

  protected spinnerSize = computed(() => {
    switch (this.size()) {
      case 'sm': return 14;
      case 'lg': return 20;
      default:   return 16;
    }
  });

  protected buttonClasses = computed(() => {
    const classes = ['crm-btn', `crm-btn--${this.variant()}`, `crm-btn--${this.size()}`];
    if (this.loading()) classes.push('crm-btn--loading');
    if (this.fullWidth()) classes.push('crm-btn--full');
    return classes.join(' ');
  });

  protected onClick(event: MouseEvent): void {
    if (!this.isDisabled()) {
      this.clicked.emit(event);
    }
  }
}
