import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  OnInit,
  OnDestroy,
  inject,
} from '@angular/core';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { ImportStore } from '../stores/import.store';
import { SignalRService } from '../../../core/signalr/signalr.service';
import { StepUploadComponent } from './step-upload.component';
import { StepMappingComponent } from './step-mapping.component';
import { StepPreviewComponent } from './step-preview.component';
import { StepProgressComponent } from './step-progress.component';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

/**
 * Multi-step import wizard orchestrating Upload -> Map -> Preview -> Progress steps.
 * Component-provided ImportStore so each wizard instance has isolated state.
 * Subscribes to SignalR ImportProgress events and delegates to store.
 */
@Component({
  selector: 'app-import-wizard',
  standalone: true,
  imports: [
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    RouterLink,
    StepUploadComponent,
    StepMappingComponent,
    StepPreviewComponent,
    StepProgressComponent,
    TranslocoPipe,
  ],
  providers: [ImportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './import-wizard.component.scss',
  template: `
    <div class="wizard-shell">
      <!-- Hero Header -->
      <div class="wizard-hero">
        <div class="wizard-hero__mesh"></div>
        <div class="wizard-hero__content">
          <a class="wizard-back" routerLink="/settings">
            <mat-icon>arrow_back</mat-icon>
            <span>{{ 'import.wizard.backToSettings' | transloco }}</span>
          </a>
          <div class="wizard-hero__heading">
            <div class="wizard-hero__icon-wrap">
              <mat-icon>upload_file</mat-icon>
            </div>
            <div>
              <h1>{{ 'import.wizard.title' | transloco }}</h1>
              <p class="header-subtitle">{{ 'import.wizard.subtitle' | transloco }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Step Pipeline -->
      <div class="step-pipeline">
        @for (s of steps; track s.index) {
          <div class="pipeline-node"
               [class.active]="store.step() === s.index"
               [class.completed]="store.step() > s.index"
               [style.animation-delay]="(s.index * 80 + 100) + 'ms'">
            <div class="node-circle">
              @if (store.step() > s.index) {
                <mat-icon>check</mat-icon>
              } @else {
                <span>{{ s.index + 1 }}</span>
              }
            </div>
            <span class="node-label">{{ s.labelKey | transloco }}</span>
          </div>
          @if (!$last) {
            <div class="pipeline-connector"
                 [class.filled]="store.step() > s.index">
            </div>
          }
        }
      </div>

      <!-- Stepper (header hidden via CSS, content still used) -->
      <mat-stepper #stepper linear [selectedIndex]="store.step()">
        <mat-step label="Upload File" [completed]="store.hasUpload()">
          <app-step-upload (stepComplete)="goToStep(1)" />
        </mat-step>

        <mat-step label="Map Fields" [completed]="store.step() > 1">
          <app-step-mapping (stepComplete)="goToStep(2)" (stepBack)="goToStep(0)" />
        </mat-step>

        <mat-step label="Preview" [completed]="store.step() > 2">
          <app-step-preview (stepComplete)="goToStep(3)" (stepBack)="goToStep(1)" />
        </mat-step>

        <mat-step label="Import" [completed]="store.isComplete()">
          <app-step-progress (importAnother)="resetWizard()" />
        </mat-step>
      </mat-stepper>
    </div>
  `,
})
export class ImportWizardComponent implements OnInit, OnDestroy {
  readonly store = inject(ImportStore);
  private readonly signalR = inject(SignalRService);

  @ViewChild('stepper') stepper!: MatStepper;

  readonly steps = [
    { index: 0, labelKey: 'import.wizard.steps.upload' },
    { index: 1, labelKey: 'import.wizard.steps.mapFields' },
    { index: 2, labelKey: 'import.wizard.steps.preview' },
    { index: 3, labelKey: 'import.wizard.steps.import' },
  ];

  private signalRSub?: Subscription;

  ngOnInit(): void {
    // Subscribe to SignalR ImportProgress events and forward to store
    this.signalRSub = this.signalR.importProgress$
      .pipe(
        filter((p) => {
          const jobId = this.store.uploadResponse()?.importJobId;
          return !!jobId && p.importJobId === jobId;
        }),
      )
      .subscribe((progress) => {
        this.store.updateProgress(progress);
      });
  }

  ngOnDestroy(): void {
    this.signalRSub?.unsubscribe();
  }

  goToStep(step: number): void {
    this.store.setStep(step);
    // Use setTimeout to allow Angular to process the step change before moving stepper
    setTimeout(() => {
      if (this.stepper) {
        this.stepper.selectedIndex = step;
      }
    });
  }

  resetWizard(): void {
    this.store.reset();
    setTimeout(() => {
      if (this.stepper) {
        this.stepper.selectedIndex = 0;
      }
    });
  }
}
