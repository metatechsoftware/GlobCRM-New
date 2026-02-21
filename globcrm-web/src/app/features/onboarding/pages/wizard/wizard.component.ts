import { Component, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { InviteTeamStepComponent } from './invite-team-step/invite-team-step.component';
import { ConfigureBasicsStepComponent } from './configure-basics-step/configure-basics-step.component';
import { ExploreDataStepComponent } from './explore-data-step/explore-data-step.component';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-wizard',
  standalone: true,
  imports: [
    CommonModule,
    MatStepperModule,
    MatButtonModule,
    MatIconModule,
    InviteTeamStepComponent,
    ConfigureBasicsStepComponent,
    ExploreDataStepComponent,
    TranslocoPipe,
  ],
  templateUrl: './wizard.component.html',
  styleUrl: './wizard.component.scss',
})
export class WizardComponent {
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  @ViewChild('stepper') stepper!: MatStepper;

  isCompleting = signal(false);

  get organizationName(): string {
    return this.authStore.organizationName() || 'your organization';
  }

  onStepComplete(): void {
    if (this.stepper) {
      this.stepper.next();
    }
  }

  skipAll(): void {
    this.completeSetup();
  }

  completeSetup(): void {
    this.isCompleting.set(true);
    this.authService.completeSetup().subscribe({
      next: () => {
        this.isCompleting.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        // Even if the API call fails, navigate to dashboard
        // The setup_completed flag can be retried later
        this.isCompleting.set(false);
        this.router.navigate(['/dashboard']);
      },
    });
  }
}
