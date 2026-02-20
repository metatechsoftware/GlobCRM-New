import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ContactFormComponent } from '../../contacts/contact-form/contact-form.component';
import { CompanyFormComponent } from '../../companies/company-form/company-form.component';
import { DealFormComponent } from '../../deals/deal-form/deal-form.component';
import { ActivityFormComponent } from '../../activities/activity-form/activity-form.component';
import { NoteFormComponent } from '../../notes/note-form/note-form.component';

import { SlideInConfig, SlideInStep } from './slide-in-panel.models';
import { SlideInPanelService, SLIDE_IN_CONFIG } from './slide-in-panel.service';

@Component({
  selector: 'app-slide-in-panel',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    ContactFormComponent,
    CompanyFormComponent,
    DealFormComponent,
    ActivityFormComponent,
    NoteFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .slide-in-panel__container {
      height: 100%;
      display: flex;
      flex-direction: column;
      background: var(--color-surface, #fff);
      box-shadow: var(--shadow-xl, 0 20px 25px rgba(0, 0, 0, 0.07));
    }

    .slide-in-panel__header {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid var(--color-border, #e8e8e6);

      h3 {
        margin: 0;
        font-size: var(--text-lg, 1.125rem);
        font-weight: var(--font-semibold, 600);
        color: var(--color-text, #1a1a1a);
      }
    }

    .slide-in-panel__body {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
    }

    .slide-in-panel__footer {
      display: flex;
      flex-direction: row;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid var(--color-border, #e8e8e6);
    }

    .slide-in-panel__follow-up {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding-top: 24px;
    }

    .slide-in-panel__success {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;

      p {
        margin: 8px 0 0;
        font-size: var(--text-md, 1rem);
        font-weight: var(--font-medium, 500);
        color: var(--color-text, #1a1a1a);
      }
    }

    .slide-in-panel__success-icon {
      color: var(--color-success, #22C55E);
      font-size: 48px !important;
      width: 48px !important;
      height: 48px !important;
    }

    .slide-in-panel__follow-up-prompt {
      font-size: var(--text-sm, 0.875rem);
      color: var(--color-text-secondary, #6b7280);
      margin: 0;
    }

    .slide-in-panel__follow-up-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    }

    .slide-in-panel__follow-up-btn {
      justify-content: flex-start !important;
      gap: 8px;
    }

    .slide-in-panel__placeholder {
      color: var(--color-text-muted, #9ca3af);
      font-style: italic;
      text-align: center;
      padding: 24px 0;
    }
  `,
  template: `
    <div class="slide-in-panel__container">
      <div class="slide-in-panel__header">
        <h3>{{ currentStep() === 'form' ? (config.title || 'New ' + config.entityType) : "What's next?" }}</h3>
        <button mat-icon-button (click)="onClose()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      <div class="slide-in-panel__body">
        @if (currentStep() === 'form') {
          @switch (config.entityType) {
            @case ('Contact') {
              <app-contact-form
                [dialogMode]="true"
                (entityCreated)="onEntityCreated($event)"
                (entityCreateError)="onCreateError()" />
            }
            @case ('Company') {
              <app-company-form
                [dialogMode]="true"
                (entityCreated)="onEntityCreated($event)"
                (entityCreateError)="onCreateError()" />
            }
            @case ('Deal') {
              <app-deal-form
                [dialogMode]="true"
                (entityCreated)="onEntityCreated($event)"
                (entityCreateError)="onCreateError()" />
            }
            @case ('Activity') {
              <app-activity-form
                [dialogMode]="true"
                (entityCreated)="onEntityCreated($event)"
                (entityCreateError)="onCreateError()" />
            }
            @case ('Note') {
              <app-note-form
                [dialogMode]="true"
                (entityCreated)="onEntityCreated($event)"
                (entityCreateError)="onCreateError()" />
            }
            @case ('Email') {
              <p class="slide-in-panel__placeholder">Email compose coming soon</p>
            }
          }
        } @else {
          <!-- Follow-up step: show success message and follow-up options -->
          <div class="slide-in-panel__follow-up">
            <div class="slide-in-panel__success">
              <mat-icon class="slide-in-panel__success-icon">check_circle</mat-icon>
              <p>{{ config.entityType }} created successfully!</p>
            </div>
            <p class="slide-in-panel__follow-up-prompt">Would you like to do anything else?</p>
            <div class="slide-in-panel__follow-up-actions">
              @for (step of config.followUpSteps; track step.action) {
                <button mat-stroked-button class="slide-in-panel__follow-up-btn" (click)="onFollowUpAction(step.action)">
                  <mat-icon>{{ step.icon }}</mat-icon>
                  {{ step.label }}
                </button>
              }
            </div>
          </div>
        }
      </div>
      <div class="slide-in-panel__footer">
        @if (currentStep() === 'form') {
          <button mat-button (click)="onClose()">Cancel</button>
          <button mat-flat-button color="primary" [disabled]="isSaving()" (click)="onSubmit()">
            @if (isSaving()) { <mat-spinner diameter="18"></mat-spinner> }
            Create
          </button>
        } @else {
          <button mat-flat-button (click)="onSkipFollowUp()">Skip</button>
        }
      </div>
    </div>
  `,
})
export class SlideInPanelComponent {
  readonly config = inject<SlideInConfig>(SLIDE_IN_CONFIG);
  private readonly slideInPanelService = inject(SlideInPanelService);
  private readonly snackBar = inject(MatSnackBar);

  /** ViewChild references for each entity form (to trigger submit). */
  private readonly contactForm = viewChild(ContactFormComponent);
  private readonly companyForm = viewChild(CompanyFormComponent);
  private readonly dealForm = viewChild(DealFormComponent);
  private readonly activityForm = viewChild(ActivityFormComponent);
  private readonly noteForm = viewChild(NoteFormComponent);

  /** Two-step state machine. */
  readonly currentStep = signal<SlideInStep>('form');
  readonly createdEntity = signal<any>(null);
  readonly isSaving = signal(false);

  /** Close the panel (at any step). */
  onClose(): void {
    this.slideInPanelService.close(null);
  }

  /** Called when entity creation succeeds. */
  onEntityCreated(entity: any): void {
    this.isSaving.set(false);
    this.createdEntity.set(entity);

    // If follow-up steps are configured, transition to follow-up step
    if (this.config.followUpSteps && this.config.followUpSteps.length > 0) {
      this.currentStep.set('follow-up');
    } else {
      // No follow-up steps — close immediately with result
      this.slideInPanelService.close({
        entity,
        entityType: this.config.entityType,
      });
    }
  }

  /** Called when a follow-up action is chosen. */
  onFollowUpAction(action: string): void {
    this.slideInPanelService.close({
      entity: this.createdEntity(),
      entityType: this.config.entityType,
      followUpAction: action,
    });
  }

  /** Skip follow-up — close with result but no follow-up action. */
  onSkipFollowUp(): void {
    this.slideInPanelService.close({
      entity: this.createdEntity(),
      entityType: this.config.entityType,
    });
  }

  /** Called when entity creation fails. */
  onCreateError(): void {
    this.isSaving.set(false);
    this.snackBar.open(`Failed to create ${this.config.entityType.toLowerCase()}`, 'Close', {
      duration: 5000,
    });
  }

  /** Trigger the active form's submit. */
  onSubmit(): void {
    this.isSaving.set(true);
    const form = this.getActiveForm();
    if (form) {
      form.triggerSubmit();
    }
  }

  /** Get the active form component based on entity type. */
  private getActiveForm(): { triggerSubmit: () => void } | undefined {
    switch (this.config.entityType) {
      case 'Contact': return this.contactForm();
      case 'Company': return this.companyForm();
      case 'Deal': return this.dealForm();
      case 'Activity': return this.activityForm();
      case 'Note': return this.noteForm();
      default: return undefined;
    }
  }
}
