import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PipelineService } from '../../deals/pipeline.service';
import { PipelineDto } from '../../deals/deal.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-pipeline-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  template: `
    <div class="pl-page">
      <!-- Header -->
      <div class="pl-header">
        <div class="pl-header__left">
          <a routerLink="/settings" class="pl-back">
            <mat-icon>arrow_back</mat-icon>
            <span>{{ 'settings.common.backToSettings' | transloco }}</span>
          </a>
          <div class="pl-title-row">
            <div class="pl-icon-wrap">
              <mat-icon>linear_scale</mat-icon>
            </div>
            <div>
              <h1 class="pl-title">{{ 'settings.pipelines.title' | transloco }}</h1>
              <p class="pl-subtitle">{{ 'settings.pipelines.subtitle' | transloco }}</p>
            </div>
          </div>
        </div>
        <button
          mat-flat-button
          color="primary"
          routerLink="/settings/pipelines/new"
          class="pl-create-btn"
        >
          <mat-icon>add</mat-icon>
          {{ 'settings.pipelines.newPipeline' | transloco }}
        </button>
      </div>

      @if (isLoading()) {
        <div class="pl-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>{{ 'settings.pipelines.loadingPipelines' | transloco }}</p>
        </div>
      } @else if (errorMessage()) {
        <div class="pl-error">
          <div class="pl-error__icon-wrap">
            <mat-icon>wifi_off</mat-icon>
          </div>
          <h3>{{ 'settings.common.somethingWentWrong' | transloco }}</h3>
          <p>{{ errorMessage() }}</p>
          <button mat-flat-button color="primary" (click)="loadPipelines()">
            <mat-icon>refresh</mat-icon>
            {{ 'settings.common.tryAgain' | transloco }}
          </button>
        </div>
      } @else if (pipelines().length === 0) {
        <div class="pl-empty">
          <div class="pl-empty__visual">
            <div class="pl-empty__circles">
              <div class="pl-circle pl-circle--1"></div>
              <div class="pl-circle pl-circle--2"></div>
              <div class="pl-circle pl-circle--3"></div>
            </div>
            <mat-icon class="pl-empty__icon">linear_scale</mat-icon>
          </div>
          <h3>{{ 'settings.pipelines.noPipelinesYet' | transloco }}</h3>
          <p>{{ 'settings.pipelines.noPipelinesDescription' | transloco }}</p>
          <button mat-flat-button color="primary" routerLink="/settings/pipelines/new">
            <mat-icon>add</mat-icon>
            {{ 'settings.pipelines.createFirstPipeline' | transloco }}
          </button>
        </div>
      } @else {
        <div class="pl-grid">
          @for (pipeline of pipelines(); track pipeline.id; let i = $index) {
            <div
              class="pl-card"
              [style.animation-delay]="(i * 60) + 'ms'"
              tabindex="0"
              (click)="onEdit(pipeline)"
              (keydown.enter)="onEdit(pipeline)"
            >
              <div class="pl-card__accent" [style.background]="pipeline.isDefault ? 'var(--color-primary)' : 'var(--color-accent)'"></div>

              <div class="pl-card__body">
                <div class="pl-card__top">
                  <div
                    class="pl-card__icon"
                    [style.background]="pipeline.isDefault ? 'var(--color-primary-soft)' : 'var(--color-accent-soft)'"
                    [style.color]="pipeline.isDefault ? 'var(--color-primary)' : 'var(--color-accent)'"
                  >
                    <mat-icon>linear_scale</mat-icon>
                  </div>
                  <div class="pl-card__actions" (click)="$event.stopPropagation()">
                    <button
                      mat-icon-button
                      (click)="onEdit(pipeline)"
                      [matTooltip]="'settings.pipelines.editPipeline' | transloco"
                      class="pl-action-btn"
                    >
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button
                      mat-icon-button
                      (click)="onDelete(pipeline)"
                      [disabled]="pipeline.dealCount > 0"
                      [matTooltip]="'settings.pipelines.deletePipeline' | transloco"
                      class="pl-action-btn pl-action-btn--danger"
                    >
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>

                <div class="pl-card__content">
                  <div class="pl-card__name-row">
                    <h3 class="pl-card__name">{{ pipeline.name }}</h3>
                    @if (pipeline.isDefault) {
                      <span class="pl-default-badge">{{ 'settings.pipelines.defaultBadge' | transloco }}</span>
                    }
                  </div>
                  <p class="pl-card__desc">{{ pipeline.description || ('settings.common.noDescription' | transloco) }}</p>
                </div>

                <!-- Stage Preview -->
                @if (pipeline.stageCount > 0) {
                  <div class="pl-stage-bar">
                    @for (stage of getStagePreview(pipeline); track $index) {
                      <div class="pl-stage-chip" [style.background]="stage.color" [style.color]="getContrastColor(stage.color)">
                        {{ stage.name }}
                      </div>
                    }
                    @if (pipeline.stageCount > 4) {
                      <span class="pl-stage-more">+{{ pipeline.stageCount - 4 }} more</span>
                    }
                  </div>
                }

                <div class="pl-card__footer">
                  <div class="pl-metric">
                    <mat-icon class="pl-metric__icon">layers</mat-icon>
                    <span class="pl-metric__value">{{ pipeline.stageCount }}</span>
                    <span class="pl-metric__label">{{ pipeline.stageCount === 1 ? ('settings.pipelines.stage' | transloco) : ('settings.pipelines.stages' | transloco) }}</span>
                  </div>
                  <div class="pl-metric">
                    <mat-icon class="pl-metric__icon">handshake</mat-icon>
                    <span class="pl-metric__value">{{ pipeline.dealCount }}</span>
                    <span class="pl-metric__label">{{ pipeline.dealCount === 1 ? ('settings.pipelines.deal' | transloco) : ('settings.pipelines.deals' | transloco) }}</span>
                  </div>
                  @if (pipeline.teamName) {
                    <div class="pl-team-badge">
                      {{ pipeline.teamName }}
                    </div>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .pl-page {
      padding: var(--space-6) var(--space-8);
      max-width: 1200px;
      margin: 0 auto;
    }

    // ─── Header ──────────────────────────────────
    .pl-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-8);
      gap: var(--space-4);
      animation: plFadeSlideUp var(--duration-slower) var(--ease-out) both;
    }

    .pl-back {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-secondary);
      text-decoration: none;
      font-size: var(--text-sm);
      font-weight: var(--font-medium);
      margin-bottom: var(--space-3);
      transition: color var(--duration-normal) var(--ease-default);

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &:hover {
        color: var(--color-primary);
      }
    }

    .pl-title-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .pl-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-lg);
      background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(20, 184, 166, 0.3);
      flex-shrink: 0;

      mat-icon {
        color: var(--color-accent-fg);
        font-size: 24px;
        width: 24px;
        height: 24px;
      }
    }

    .pl-title {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: var(--font-bold);
      letter-spacing: -0.5px;
      color: var(--color-text);
    }

    .pl-subtitle {
      margin: var(--space-1) 0 0;
      font-size: var(--text-base);
      color: var(--color-text-secondary);
    }

    .pl-create-btn {
      flex-shrink: 0;
      margin-top: var(--space-6);

      mat-icon {
        margin-right: var(--space-1);
      }
    }

    // ─── Card Grid ───────────────────────────────
    .pl-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: var(--space-5);
    }

    .pl-card {
      position: relative;
      background: var(--color-surface);
      border: 1.5px solid var(--color-border);
      border-radius: 14px;
      overflow: hidden;
      cursor: pointer;
      outline: none;
      transition:
        box-shadow var(--duration-normal) var(--ease-default),
        transform var(--duration-normal) var(--ease-default),
        border-color var(--duration-normal) var(--ease-default);
      animation: plCardEntrance var(--duration-slower) var(--ease-out) both;

      &:hover,
      &:focus-visible {
        box-shadow: var(--shadow-lg);
        transform: translateY(-2px);
        border-color: var(--color-border-strong);

        .pl-card__actions {
          opacity: 1;
          transform: translateX(0);
        }

        .pl-card__accent {
          height: 4px;
        }
      }

      &:focus-visible {
        box-shadow: var(--shadow-focus);
      }

      &:active {
        transform: translateY(0);
        box-shadow: var(--shadow-md);
      }
    }

    .pl-card__accent {
      height: 3px;
      transition: height var(--duration-normal) var(--ease-default);
    }

    .pl-card__body {
      padding: var(--space-5);
    }

    .pl-card__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .pl-card__icon {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .pl-card__actions {
      display: flex;
      gap: var(--space-0-5);
      opacity: 0;
      transform: translateX(8px);
      transition:
        opacity var(--duration-normal) var(--ease-default),
        transform var(--duration-normal) var(--ease-default);
    }

    .pl-action-btn {
      width: 32px !important;
      height: 32px !important;
      line-height: 32px !important;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      &--danger:hover {
        color: var(--color-danger);
      }
    }

    .pl-card__content {
      margin-bottom: var(--space-4);
    }

    .pl-card__name-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin-bottom: var(--space-1);
    }

    .pl-card__name {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: var(--font-semibold);
      color: var(--color-text);
      letter-spacing: -0.3px;
    }

    .pl-card__desc {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-secondary);
      line-height: var(--leading-relaxed);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .pl-default-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      background: var(--color-primary-soft);
      color: var(--color-primary-text);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
    }

    // ─── Stage Preview ───────────────────────────
    .pl-stage-bar {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1-5);
      margin-bottom: var(--space-4);
      padding: var(--space-3);
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
    }

    .pl-stage-chip {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
    }

    .pl-stage-more {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      color: var(--color-text-muted);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
    }

    // ─── Footer ──────────────────────────────────
    .pl-card__footer {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-border-subtle);
    }

    .pl-metric {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-text-secondary);
      font-size: var(--text-sm);
    }

    .pl-metric__icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .pl-metric__value {
      font-weight: var(--font-semibold);
      color: var(--color-text);
    }

    .pl-metric__label {
      color: var(--color-text-muted);
    }

    .pl-team-badge {
      display: inline-flex;
      align-items: center;
      padding: var(--space-0-5) var(--space-2);
      background: var(--color-secondary-soft);
      color: var(--color-secondary-text);
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      margin-left: auto;
    }

    // ─── States ──────────────────────────────────
    .pl-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-20) 0;
      gap: var(--space-4);

      p {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
    }

    .pl-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-16) 0;
      text-align: center;

      h3 {
        margin: var(--space-4) 0 var(--space-2);
        font-size: var(--text-lg);
      }

      p {
        margin: 0 0 var(--space-5);
        color: var(--color-text-secondary);
        max-width: 360px;
      }
    }

    .pl-error__icon-wrap {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-full);
      background: var(--color-danger-soft);
      display: flex;
      align-items: center;
      justify-content: center;

      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: var(--color-danger);
      }
    }

    .pl-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-16) 0;
      text-align: center;

      h3 {
        margin: var(--space-5) 0 var(--space-2);
        font-size: var(--text-xl);
        font-weight: var(--font-semibold);
      }

      p {
        margin: 0 0 var(--space-6);
        color: var(--color-text-secondary);
        max-width: 400px;
        line-height: var(--leading-relaxed);
      }
    }

    .pl-empty__visual {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pl-empty__circles {
      position: absolute;
      inset: 0;
    }

    .pl-circle {
      position: absolute;
      border-radius: var(--radius-full);
      opacity: 0;
      animation: plCircleFloat 3s var(--ease-default) infinite;

      &--1 {
        width: 40px;
        height: 40px;
        background: var(--color-accent-soft);
        border: 2px solid var(--color-accent);
        top: 0;
        left: 10px;
        animation-delay: 0s;
      }

      &--2 {
        width: 32px;
        height: 32px;
        background: var(--color-primary-soft);
        border: 2px solid var(--color-primary);
        top: 8px;
        right: 5px;
        animation-delay: 0.5s;
      }

      &--3 {
        width: 28px;
        height: 28px;
        background: var(--color-secondary-soft);
        border: 2px solid var(--color-secondary);
        bottom: 10px;
        left: 22px;
        animation-delay: 1s;
      }
    }

    .pl-empty__icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--color-text-muted);
      z-index: 1;
    }

    // ─── Animations ──────────────────────────────
    @keyframes plFadeSlideUp {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes plCardEntrance {
      from {
        opacity: 0;
        transform: translateY(12px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes plCircleFloat {
      0%,
      100% {
        opacity: 0.4;
        transform: translateY(0);
      }
      50% {
        opacity: 0.8;
        transform: translateY(-8px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .pl-card,
      .pl-header,
      .pl-circle {
        animation: none !important;
      }

      .pl-card {
        opacity: 1;
      }
    }

    // ─── Responsive ──────────────────────────────
    @media (max-width: 768px) {
      .pl-page {
        padding: var(--space-4);
      }

      .pl-header {
        flex-direction: column;
        gap: var(--space-3);
        margin-bottom: var(--space-6);
      }

      .pl-title {
        font-size: var(--text-2xl);
      }

      .pl-create-btn {
        margin-top: 0;
      }

      .pl-grid {
        grid-template-columns: 1fr;
        gap: var(--space-4);
      }

      .pl-card__actions {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `],
})
export class PipelineListComponent implements OnInit {
  private readonly pipelineService = inject(PipelineService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  pipelines = signal<PipelineDto[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadPipelines();
  }

  loadPipelines(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.pipelineService.getAll().subscribe({
      next: (pipelines) => {
        this.pipelines.set(pipelines);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load pipelines.');
        this.isLoading.set(false);
      },
    });
  }

  onEdit(pipeline: PipelineDto): void {
    this.router.navigate(['/settings/pipelines', pipeline.id]);
  }

  onDelete(pipeline: PipelineDto): void {
    if (pipeline.dealCount > 0) {
      this.snackBar.open(
        'Cannot delete a pipeline that has deals. Move or delete deals first.',
        'Close',
        { duration: 5000 }
      );
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: pipeline.name, type: 'pipeline' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.pipelineService.delete(pipeline.id).subscribe({
        next: () => {
          this.snackBar.open(
            this.transloco.translate('settings.pipelines.deleteSuccess', { name: pipeline.name }),
            'Close',
            { duration: 3000 }
          );
          this.loadPipelines();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || this.transloco.translate('settings.pipelines.deleteFailed'),
            'Close',
            { duration: 5000 }
          );
        },
      });
    });
  }

  getStagePreview(pipeline: PipelineDto): { name: string; color: string }[] {
    // Pipeline list DTO may include stage names — fallback to placeholder chips
    if ((pipeline as any).stages?.length) {
      return (pipeline as any).stages.slice(0, 4).map((s: any) => ({
        name: s.name,
        color: s.color || '#9e9e9e',
      }));
    }
    return [];
  }

  getContrastColor(hex: string): string {
    if (!hex || hex.length !== 7) return '#ffffff';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }
}
