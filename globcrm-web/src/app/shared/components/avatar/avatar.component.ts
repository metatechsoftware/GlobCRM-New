import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Avatar component displaying either an uploaded image or a colored circle with initials.
 *
 * Usage:
 * ```html
 * <app-avatar [firstName]="'John'" [lastName]="'Doe'" size="md" />
 * <app-avatar [avatarUrl]="user.avatarUrl" [firstName]="user.firstName" [lastName]="user.lastName" />
 * ```
 */
@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (avatarUrl) {
      <img
        [src]="avatarUrl"
        [alt]="initials"
        [class]="'avatar avatar-' + size"
        (error)="onImageError()" />
    } @else {
      <div
        [class]="'avatar avatar-initials avatar-' + size"
        [style.background-color]="backgroundColor">
        <span class="initials-text">{{ initials }}</span>
      </div>
    }
  `,
  styles: [`
    .avatar {
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .avatar-sm {
      width: 32px;
      height: 32px;
      font-size: 12px;
    }

    .avatar-md {
      width: 48px;
      height: 48px;
      font-size: 16px;
    }

    .avatar-lg {
      width: 96px;
      height: 96px;
      font-size: 32px;
    }

    .avatar img,
    img.avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-initials {
      color: #fff;
      font-weight: 500;
      user-select: none;
    }

    .initials-text {
      line-height: 1;
    }
  `],
})
export class AvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() firstName = '';
  @Input() lastName = '';
  @Input() avatarColor: string | null = null;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  private imageError = false;

  get initials(): string {
    const first = this.firstName?.charAt(0) ?? '';
    const last = this.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  get backgroundColor(): string {
    if (this.avatarColor) {
      return this.avatarColor;
    }
    return this.generateColorFromName(this.firstName + this.lastName);
  }

  onImageError(): void {
    this.imageError = true;
    this.avatarUrl = null;
  }

  /**
   * Generate a deterministic color from a name string.
   * Uses a simple hash to produce consistent colors for the same name.
   */
  private generateColorFromName(name: string): string {
    const colors = [
      '#1976d2', '#388e3c', '#d32f2f', '#7b1fa2',
      '#f57c00', '#0097a7', '#5d4037', '#455a64',
      '#c2185b', '#00796b', '#303f9f', '#689f38',
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
