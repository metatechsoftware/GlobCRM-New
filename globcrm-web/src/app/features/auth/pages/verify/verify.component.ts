import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../core/auth/auth.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.scss',
})
export class VerifyComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  /** 'pending' = after signup, 'confirming' = processing link, 'confirmed' = success, 'error' = failure */
  state = signal<'pending' | 'confirming' | 'confirmed' | 'error'>('pending');
  email = signal<string>('');
  errorMessage = signal<string>('');
  resendCooldown = signal(0);
  resendLoading = signal(false);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParams;
    const userId = queryParams['userId'];
    const code = queryParams['code'];
    const emailParam = queryParams['email'];

    if (emailParam) {
      this.email.set(emailParam);
    }

    // If we have userId and code, this is a confirmation from an email link
    if (userId && code) {
      this.state.set('confirming');
      this.confirmEmail(userId, code);
    }
    // Otherwise, show the "pending verification" state
  }

  ngOnDestroy(): void {
    this.clearCooldownTimer();
  }

  resendVerification(): void {
    const emailValue = this.email();
    if (!emailValue) return;

    this.resendLoading.set(true);

    this.authService.resendConfirmationEmail(emailValue).subscribe({
      next: () => {
        this.resendLoading.set(false);
        this.startCooldown();
      },
      error: () => {
        this.resendLoading.set(false);
        // Still start cooldown to prevent spam
        this.startCooldown();
      },
    });
  }

  private confirmEmail(userId: string, code: string): void {
    this.authService.confirmEmail(userId, code).subscribe({
      next: () => {
        this.state.set('confirmed');
      },
      error: () => {
        this.state.set('error');
        this.errorMessage.set(
          this.transloco.translate('auth.messages.verificationLinkExpired')
        );
      },
    });
  }

  private startCooldown(): void {
    this.resendCooldown.set(60);
    this.clearCooldownTimer();

    this.cooldownTimer = setInterval(() => {
      const current = this.resendCooldown();
      if (current <= 1) {
        this.resendCooldown.set(0);
        this.clearCooldownTimer();
      } else {
        this.resendCooldown.set(current - 1);
      }
    }, 1000);
  }

  private clearCooldownTimer(): void {
    if (this.cooldownTimer !== null) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }
}
