import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-greeting-banner',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="greeting-banner">
      <!-- Decorative elements -->
      <div class="greeting-banner__decor-circle greeting-banner__decor-circle--lg"></div>
      <div class="greeting-banner__decor-circle greeting-banner__decor-circle--sm"></div>
      <div class="greeting-banner__decor-dots"></div>

      <div class="greeting-banner__content">
        <div class="greeting-banner__top">
          <div class="greeting-banner__greeting">
            <div class="greeting-banner__icon-wrapper">
              <mat-icon>{{ timeIcon() }}</mat-icon>
            </div>
            <div class="greeting-banner__text">
              <h2 class="greeting-banner__title">{{ greetingKey() | transloco }}, {{ firstName() }}</h2>
              <span class="greeting-banner__date">{{ dateStr() }}</span>
            </div>
          </div>
        </div>

        <div class="greeting-banner__stats">
          @if (isLoading()) {
            <div class="greeting-banner__stat-chip greeting-banner__shimmer"></div>
            <div class="greeting-banner__stat-chip greeting-banner__shimmer"></div>
            <div class="greeting-banner__stat-chip greeting-banner__shimmer"></div>
          } @else {
            <div class="greeting-banner__stat-chip">
              <mat-icon class="greeting-banner__stat-icon">task_alt</mat-icon>
              <span>{{ 'myDay.stats.tasksToday' | transloco: { count: stats().tasksToday } }}</span>
            </div>
            <div class="greeting-banner__stat-chip" [class.greeting-banner__stat-chip--danger]="stats().overdue > 0">
              <mat-icon class="greeting-banner__stat-icon">warning</mat-icon>
              <span>{{ 'myDay.stats.overdue' | transloco: { count: stats().overdue } }}</span>
            </div>
            <div class="greeting-banner__stat-chip">
              <mat-icon class="greeting-banner__stat-icon">videocam</mat-icon>
              <span>{{ 'myDay.stats.meetings' | transloco: { count: stats().meetings } }}</span>
            </div>
          }
        </div>

        <div class="greeting-banner__actions">
          <button class="greeting-banner__action-btn" (click)="quickAction.emit('Contact')">
            <mat-icon>person_add</mat-icon> <span>{{ 'myDay.quickActions.newContact' | transloco }}</span>
          </button>
          <button class="greeting-banner__action-btn" (click)="quickAction.emit('Deal')">
            <mat-icon>handshake</mat-icon> <span>{{ 'myDay.quickActions.newDeal' | transloco }}</span>
          </button>
          <button class="greeting-banner__action-btn" (click)="quickAction.emit('Activity')">
            <mat-icon>task_alt</mat-icon> <span>{{ 'myDay.quickActions.logActivity' | transloco }}</span>
          </button>
          <button class="greeting-banner__action-btn" (click)="quickAction.emit('Note')">
            <mat-icon>note_add</mat-icon> <span>{{ 'myDay.quickActions.newNote' | transloco }}</span>
          </button>
          <button class="greeting-banner__action-btn" (click)="quickAction.emit('Email')">
            <mat-icon>email</mat-icon> <span>{{ 'myDay.quickActions.sendEmail' | transloco }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }

    @keyframes subtlePulse {
      0%, 100% { transform: scale(1); }
      50%      { transform: scale(1.04); }
    }

    @keyframes bannerShimmer {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes contentSlideUp {
      0%   { opacity: 0; transform: translateY(10px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    @keyframes iconEntrance {
      0%   { opacity: 0; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    @keyframes chipSlideIn {
      0%   { opacity: 0; transform: translateX(-8px); }
      100% { opacity: 1; transform: translateX(0); }
    }

    @keyframes iconFloat {
      0%, 100% { transform: translateY(0); }
      50%      { transform: translateY(-2px); }
    }

    @keyframes dotDrift {
      0%, 100% { background-position: 0 0; }
      50%      { background-position: 10px 5px; }
    }

    .greeting-banner {
      position: relative;
      border-radius: var(--radius-xl, 16px);
      padding: var(--space-8, 32px);
      overflow: hidden;
      color: #fff;

      /* Deep orange gradient matching auth side panel */
      background:
        radial-gradient(ellipse at 20% 80%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(0, 0, 0, 0.06) 0%, transparent 70%),
        linear-gradient(135deg, #F97316 0%, #EA580C 40%, #C2410C 100%);
      background-size: 200% 200%, 200% 200%, 100% 100%, 100% 100%;
      animation: bannerShimmer 20s ease infinite;

      /* Elevated shadow */
      box-shadow:
        0 4px 12px rgba(249, 115, 22, 0.15),
        0 12px 40px rgba(249, 115, 22, 0.1);
    }

    .greeting-banner__content {
      position: relative;
      z-index: 2;
    }

    /* ── Decorative Elements ─────────────────────── */
    .greeting-banner__decor-circle {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
    }

    .greeting-banner__decor-circle--lg {
      top: -60px;
      right: -60px;
      width: 220px;
      height: 220px;
      background: rgba(255, 255, 255, 0.06);
      animation: subtlePulse 8s ease-in-out infinite;
    }

    .greeting-banner__decor-circle--sm {
      bottom: -20px;
      left: 30%;
      width: 100px;
      height: 100px;
      background: rgba(255, 255, 255, 0.04);
      animation: subtlePulse 8s ease-in-out infinite 2s;
    }

    .greeting-banner__decor-dots {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background-image: radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
      background-size: 20px 20px;
      animation: dotDrift 25s ease-in-out infinite;
    }

    /* ── Top Row ─────────────────────────────────── */
    .greeting-banner__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-5, 20px);
    }

    .greeting-banner__greeting {
      display: flex;
      align-items: center;
      gap: var(--space-4, 16px);
    }

    .greeting-banner__icon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 52px;
      height: 52px;
      min-width: 52px;
      border-radius: var(--radius-lg, 12px);
      background: rgba(255, 255, 255, 0.18);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
      animation: iconEntrance 400ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms backwards;
      transition: transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1);

      &:hover {
        transform: scale(1.08) rotate(-6deg);
      }

      mat-icon {
        font-size: 26px;
        width: 26px;
        height: 26px;
        animation: iconFloat 6s ease-in-out 1.2s infinite;
      }
    }

    .greeting-banner__text {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .greeting-banner__title {
      margin: 0;
      font-family: 'Instrument Serif', Georgia, serif;
      font-style: italic;
      font-size: clamp(1.5rem, 2.5vw, 2rem);
      font-weight: 400;
      letter-spacing: -0.02em;
      line-height: 1.15;
      animation: contentSlideUp 400ms cubic-bezier(0.4, 0, 0.2, 1) 280ms backwards;
    }

    .greeting-banner__date {
      font-size: var(--text-sm, 0.875rem);
      opacity: 0.8;
      font-weight: var(--font-medium, 500);
      letter-spacing: 0.02em;
      animation: contentSlideUp 350ms cubic-bezier(0.4, 0, 0.2, 1) 360ms backwards;
    }

    /* ── Stat Chips (Frosted Glass) ──────────────── */
    .greeting-banner__stats {
      display: flex;
      align-items: center;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-5, 20px);
      flex-wrap: wrap;
    }

    .greeting-banner__stat-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-radius: var(--radius-full, 9999px);
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-medium, 500);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.15);
      transition: background 200ms ease, transform 200ms ease, box-shadow 200ms ease;

      &:hover {
        background: rgba(255, 255, 255, 0.22);
        transform: translateY(-2px) scale(1.03);
        box-shadow: 0 4px 16px rgba(255, 255, 255, 0.08);
      }
    }

    .greeting-banner__stat-chip:not(.greeting-banner__shimmer) {
      animation: chipSlideIn 350ms cubic-bezier(0.4, 0, 0.2, 1) backwards;
    }

    .greeting-banner__stat-chip:not(.greeting-banner__shimmer):nth-child(1) {
      animation-delay: 420ms;
    }

    .greeting-banner__stat-chip:not(.greeting-banner__shimmer):nth-child(2) {
      animation-delay: 480ms;
    }

    .greeting-banner__stat-chip:not(.greeting-banner__shimmer):nth-child(3) {
      animation-delay: 540ms;
    }

    .greeting-banner__stat-chip--danger {
      background: rgba(255, 80, 80, 0.25);
      border-color: rgba(255, 120, 120, 0.3);
    }

    .greeting-banner__stat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      opacity: 0.9;
    }

    .greeting-banner__shimmer {
      width: 130px;
      height: 34px;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0.08) 25%,
        rgba(255, 255, 255, 0.18) 37%,
        rgba(255, 255, 255, 0.08) 63%
      );
      background-size: 200% 100%;
      animation: shimmer 1.8s ease-in-out infinite;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: none;
    }

    /* ── Quick Action Buttons (Frosted) ──────────── */
    .greeting-banner__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2, 8px);
      flex-wrap: wrap;
    }

    .greeting-banner__action-btn {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 0 14px;
      height: 34px;
      border: 1px solid rgba(255, 255, 255, 0.25);
      border-radius: var(--radius-full, 9999px);
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      color: #fff;
      font-family: inherit;
      font-size: var(--text-sm, 0.875rem);
      font-weight: var(--font-medium, 500);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      animation: chipSlideIn 300ms cubic-bezier(0.4, 0, 0.2, 1) backwards;
      transition:
        background 200ms ease,
        transform 200ms ease,
        box-shadow 200ms ease;

      mat-icon {
        font-size: 17px;
        width: 17px;
        height: 17px;
      }

      &::after {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.15) 50%,
          transparent 100%
        );
        transition: left 400ms ease;
        pointer-events: none;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.22);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

        &::after {
          left: 100%;
        }
      }

      &:active {
        transform: translateY(0) scale(0.97);
        box-shadow: none;
      }
    }

    .greeting-banner__action-btn:nth-child(1) { animation-delay: 560ms; }
    .greeting-banner__action-btn:nth-child(2) { animation-delay: 600ms; }
    .greeting-banner__action-btn:nth-child(3) { animation-delay: 640ms; }
    .greeting-banner__action-btn:nth-child(4) { animation-delay: 680ms; }
    .greeting-banner__action-btn:nth-child(5) { animation-delay: 720ms; }

    /* ── Responsive ──────────────────────────────── */
    @media (max-width: 768px) {
      .greeting-banner {
        padding: var(--space-5, 20px);
      }

      .greeting-banner__title {
        font-size: 1.35rem;
      }

      .greeting-banner__icon-wrapper {
        width: 42px;
        height: 42px;
        min-width: 42px;

        mat-icon {
          font-size: 22px;
          width: 22px;
          height: 22px;
        }
      }

      .greeting-banner__actions {
        gap: 6px;
      }

      .greeting-banner__action-btn {
        font-size: var(--text-xs, 0.75rem);
        padding: 0 10px;
        height: 30px;

        mat-icon {
          font-size: 15px;
          width: 15px;
          height: 15px;
        }
      }

      .greeting-banner__action-btn span {
        display: none;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .greeting-banner {
        animation: none;
        background-size: 100% 100%;
      }

      .greeting-banner__decor-circle--lg,
      .greeting-banner__decor-circle--sm {
        animation: none;
      }

      .greeting-banner__decor-dots {
        animation: none;
      }

      .greeting-banner__icon-wrapper {
        animation: none;
        transition: none;
      }

      .greeting-banner__icon-wrapper mat-icon {
        animation: none;
      }

      .greeting-banner__title,
      .greeting-banner__date {
        animation: none;
      }

      .greeting-banner__stat-chip,
      .greeting-banner__stat-chip:not(.greeting-banner__shimmer) {
        animation: none;
        transition: none;
      }

      .greeting-banner__action-btn {
        animation: none;
        transition: none;

        &::after {
          display: none;
        }
      }
    }
  `],
})
export class GreetingBannerComponent {
  readonly firstName = input.required<string>();
  readonly stats = input.required<{ tasksToday: number; overdue: number; meetings: number }>();
  readonly isLoading = input<boolean>(false);
  readonly quickAction = output<string>();

  readonly greetingKey = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'myDay.greeting.morning';
    if (hour < 17) return 'myDay.greeting.afternoon';
    return 'myDay.greeting.evening';
  });

  readonly timeIcon = computed(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'wb_sunny';
    if (hour >= 12 && hour < 17) return 'wb_cloudy';
    if (hour >= 17 && hour < 21) return 'wb_twilight';
    return 'dark_mode';
  });

  readonly dateStr = computed(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
  });
}
