import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, takeUntil } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../../../core/auth/auth.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-create-org',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    TranslocoPipe,
  ],
  templateUrl: './create-org.component.html',
  styleUrl: './create-org.component.scss',
})
export class CreateOrgComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  createOrgForm!: FormGroup;
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  subdomainAvailable = signal<boolean | null>(null);
  checkingSubdomain = signal(false);
  passwordStrength = signal(0);

  private subdomainCheck$ = new Subject<string>();

  readonly industries = [
    'Technology',
    'Healthcare',
    'Finance & Banking',
    'Retail & E-Commerce',
    'Manufacturing',
    'Real Estate',
    'Education',
    'Professional Services',
    'Media & Entertainment',
    'Non-Profit',
    'Other',
  ];

  readonly companySizes = [
    { value: '1-10', label: '1-10 employees' },
    { value: '11-50', label: '11-50 employees' },
    { value: '51-200', label: '51-200 employees' },
    { value: '200+', label: '200+ employees' },
  ];

  ngOnInit(): void {
    this.createOrgForm = this.fb.group(
      {
        orgName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(255)]],
        subdomain: [
          '',
          [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(63),
            Validators.pattern(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
          ],
        ],
        industry: [''],
        companySize: [''],
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    // Watch subdomain changes for real-time availability check
    this.subdomainCheck$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((subdomain) => {
          if (!subdomain || subdomain.length < 3) {
            this.subdomainAvailable.set(null);
            this.checkingSubdomain.set(false);
            return of(null);
          }
          this.checkingSubdomain.set(true);
          return this.authService.checkSubdomainAvailability(subdomain);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          this.checkingSubdomain.set(false);
          if (result !== null) {
            this.subdomainAvailable.set(result.available);
          }
        },
        error: () => {
          this.checkingSubdomain.set(false);
          this.subdomainAvailable.set(null);
        },
      });

    // Watch password changes for strength indicator
    this.createOrgForm
      .get('password')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((password: string) => {
        this.passwordStrength.set(this.calculatePasswordStrength(password));
      });
  }

  onSubdomainInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    // Auto-lowercase and remove invalid characters
    const sanitized = input.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (sanitized !== input.value) {
      this.createOrgForm.get('subdomain')?.setValue(sanitized, { emitEvent: false });
    }
    this.subdomainCheck$.next(sanitized);
  }

  onSubmit(): void {
    if (this.createOrgForm.invalid) {
      this.createOrgForm.markAllAsTouched();
      return;
    }

    if (this.subdomainAvailable() === false) {
      this.errorMessage.set(this.transloco.translate('auth.messages.subdomainNotAvailable'));
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formValue = this.createOrgForm.value;
    this.authService
      .createOrganization({
        orgName: formValue.orgName,
        subdomain: formValue.subdomain,
        industry: formValue.industry || undefined,
        companySize: formValue.companySize || undefined,
        email: formValue.email,
        password: formValue.password,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/auth/verify-email'], {
            queryParams: { email: formValue.email },
          });
        },
        error: (error) => {
          this.isLoading.set(false);
          this.errorMessage.set(
            error.message || this.transloco.translate('auth.messages.createOrgFailed')
          );
        },
      });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.update((v) => !v);
  }

  getStrengthLabel(): string {
    const strength = this.passwordStrength();
    if (strength <= 25) return 'Weak';
    if (strength <= 50) return 'Fair';
    if (strength <= 75) return 'Good';
    return 'Strong';
  }

  getStrengthColor(): string {
    const strength = this.passwordStrength();
    if (strength <= 25) return 'warn';
    if (strength <= 50) return 'accent';
    return 'primary';
  }

  private calculatePasswordStrength(password: string): number {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 25;
    if (/[A-Z]/.test(password)) score += 25;
    if (/[0-9]/.test(password)) score += 25;
    if (/[^A-Za-z0-9]/.test(password)) score += 25;
    return score;
  }

  private passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    if (password && confirmPassword && password !== confirmPassword) {
      control.get('confirmPassword')?.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }
}
