import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { AuthService } from '../../../../../core/auth/auth.service';

@Component({
  selector: 'app-invite-team-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatCardModule,
  ],
  templateUrl: './invite-team-step.component.html',
  styleUrl: './invite-team-step.component.scss',
})
export class InviteTeamStepComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  stepComplete = output<void>();
  skipStep = output<void>();

  inviteForm!: FormGroup;
  emails = signal<string[]>([]);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  resultMessage = signal<string | null>(null);

  constructor() {
    this.inviteForm = this.fb.group({
      emailInput: [''],
      role: ['Member'],
    });
  }

  parseEmails(): void {
    const input = this.inviteForm.get('emailInput')?.value?.trim();
    if (!input) return;

    // Parse emails from comma-separated, semicolon-separated, or newline-separated input
    const parsed = input
      .split(/[,;\n]+/)
      .map((e: string) => e.trim().toLowerCase())
      .filter((e: string) => this.isValidEmail(e));

    // Deduplicate against existing emails
    const currentEmails = this.emails();
    const newEmails = parsed.filter((e: string) => !currentEmails.includes(e));

    if (newEmails.length > 0) {
      this.emails.set([...currentEmails, ...newEmails]);
    }

    // Clear input
    this.inviteForm.get('emailInput')?.setValue('');
  }

  removeEmail(email: string): void {
    this.emails.update((current) => current.filter((e) => e !== email));
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  onSendInvitations(): void {
    const emailList = this.emails();
    if (emailList.length === 0) {
      this.errorMessage.set('Please add at least one email address.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.resultMessage.set(null);

    const role = this.inviteForm.get('role')?.value || 'Member';

    this.authService.sendInvitations({ emails: emailList, role }).subscribe({
      next: (result) => {
        this.isLoading.set(false);
        const messages: string[] = [];
        if (result.sent > 0) {
          messages.push(`${result.sent} invitation${result.sent > 1 ? 's' : ''} sent`);
        }
        if (result.skipped > 0) {
          messages.push(`${result.skipped} skipped`);
        }
        this.resultMessage.set(messages.join(', '));
        this.emails.set([]);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Failed to send invitations.');
      },
    });
  }

  onSkip(): void {
    this.skipStep.emit();
  }

  onContinue(): void {
    this.stepComplete.emit();
  }
}
