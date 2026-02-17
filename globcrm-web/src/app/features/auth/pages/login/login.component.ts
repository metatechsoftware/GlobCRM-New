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

  loginForm!: FormGroup;
  twoFactorForm!: FormGroup;
  hidePassword = signal(true);
  showTwoFactor = signal(false);
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  private returnUrl = '/dashboard';

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    this.loginForm = this.fb.group({
      email: ['cevikcinar@gmail.com', [Validators.required, Validators.email]],
      password: ['Sienna@1998!', [Validators.required, Validators.minLength(8)]],
      rememberMe: [false],
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
        this.isLoading.set(false);
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.isLoading.set(false);
        if (error.status === 401 && error.message?.includes('2fa')) {
          this.showTwoFactor.set(true);
          this.authStore.setRequiresTwoFactor(true);
        } else if (error.status === 401) {
          this.errorMessage.set('Invalid email or password.');
        } else if (error.status === 403) {
          this.errorMessage.set('Your account has been locked. Please try again later.');
        } else if (error.message?.includes('email') && error.message?.includes('verified')) {
          this.errorMessage.set('Please verify your email address before logging in.');
        } else {
          this.errorMessage.set(error.message || 'An unexpected error occurred. Please try again.');
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
          this.errorMessage.set('Invalid verification code. Please try again.');
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
