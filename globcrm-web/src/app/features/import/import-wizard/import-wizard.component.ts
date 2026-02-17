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
  ],
  providers: [ImportStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }

    .wizard-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
    }

    .wizard-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }

    .wizard-header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 500;
    }

    .mat-stepper-horizontal {
      background: transparent;
    }
  `,
  template: `
    <div class="wizard-container">
      <div class="wizard-header">
        <a mat-icon-button routerLink="/settings" aria-label="Back to settings">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <h1>Import Data</h1>
      </div>

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
