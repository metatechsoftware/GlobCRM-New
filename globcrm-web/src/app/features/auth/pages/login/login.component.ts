import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../../core/auth/auth.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatIconModule,
    TranslocoPipe,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  private static readonly REMEMBERED_EMAIL_KEY = 'globcrm_remembered_email';

  loginForm!: FormGroup;
  twoFactorForm!: FormGroup;
  hidePassword = signal(true);
  showTwoFactor = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  isLoading = signal(false);
  private returnUrl = '/my-day';

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParams;
    this.returnUrl = queryParams['returnUrl'] || '/my-day';

    const emailFromQuery = queryParams['email'] || '';
    const messageFromQuery = queryParams['message'] || '';
    const rememberedEmail = localStorage.getItem(LoginComponent.REMEMBERED_EMAIL_KEY) || '';

    const initialEmail = emailFromQuery || rememberedEmail;

    if (messageFromQuery) {
      this.successMessage.set(messageFromQuery);
    }

    this.loginForm = this.fb.group({
      email: [initialEmail, [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      rememberMe: [!!rememberedEmail],
    });

    this.twoFactorForm = this.fb.group({
      twoFactorCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { email, password, rememberMe } = this.loginForm.value;

    this.authService.login({ email, password, rememberMe }).subscribe({
      next: () => {
        if (rememberMe) {
          localStorage.setItem(LoginComponent.REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(LoginComponent.REMEMBERED_EMAIL_KEY);
        }
        this.isLoading.set(false);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.isLoading.set(false);
        if (error.status === 401 && error.message?.includes('2fa')) {
          this.showTwoFactor.set(true);
          this.authStore.setRequiresTwoFactor(true);
        } else if (error.status === 401) {
          this.errorMessage.set(this.transloco.translate('auth.messages.invalidCredentials'));
        } else if (error.status === 403) {
          this.errorMessage.set(this.transloco.translate('auth.messages.accountLocked'));
        } else if (error.message?.includes('email') && error.message?.includes('verified')) {
          this.errorMessage.set(this.transloco.translate('auth.messages.verifyEmail'));
        } else {
          this.errorMessage.set(error.message || this.transloco.translate('auth.messages.unexpectedError'));
        }
      },
    });
  }

  onSubmitTwoFactor(): void {
    if (this.twoFactorForm.invalid) {
      this.twoFactorForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { twoFactorCode } = this.twoFactorForm.value;
    const { email, password, rememberMe } = this.loginForm.value;

    // Re-login with 2FA code
    this.authService
      .login({ email, password, rememberMe })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigateByUrl(this.returnUrl);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(this.transloco.translate('auth.messages.invalidVerificationCode'));
        },
      });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  backToLogin(): void {
    this.showTwoFactor.set(false);
    this.authStore.setRequiresTwoFactor(false);
    this.errorMessage.set(null);
  }
}
