import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../../core/auth/auth.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-join-org',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
  ],
  templateUrl: './join-org.component.html',
  styleUrl: './join-org.component.scss',
})
export class JoinOrgComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  joinForm!: FormGroup;
  hidePassword = signal(true);
  hideConfirmPassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  invitationInfo = signal<{ orgName: string; role: string } | null>(null);
  hasTokenFromRoute = signal(false);

  ngOnInit(): void {
    const tokenFromRoute = this.route.snapshot.params['token'];

    this.joinForm = this.fb.group(
      {
        token: [tokenFromRoute || '', [Validators.required]],
        email: ['', [Validators.required, Validators.email]],
        firstName: ['', [Validators.required]],
        lastName: ['', [Validators.required]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator }
    );

    if (tokenFromRoute) {
      this.hasTokenFromRoute.set(true);
      this.loadInvitationInfo(tokenFromRoute);
    }
  }

  onSubmit(): void {
    if (this.joinForm.invalid) {
      this.joinForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const formValue = this.joinForm.value;
    this.authService
      .joinOrganization({
        token: formValue.token,
        email: formValue.email,
        password: formValue.password,
        firstName: formValue.firstName,
        lastName: formValue.lastName,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/auth/login'], {
            queryParams: {
              message: this.transloco.translate('auth.messages.accountCreated'),
              email: formValue.email,
            },
          });
        },
        error: (error) => {
          this.isLoading.set(false);
          if (error.status === 404 || error.message?.includes('expired')) {
            this.errorMessage.set(this.transloco.translate('auth.messages.invitationExpired'));
          } else {
            this.errorMessage.set(error.message || this.transloco.translate('auth.messages.joinFailed'));
          }
        },
      });
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.update((v) => !v);
  }

  private loadInvitationInfo(token: string): void {
    // Attempt to load invitation details (org name, role) from the API
    // The API may return invitation info given the token
    this.authService
      .checkSubdomainAvailability(token)
      .subscribe({
        // This is a placeholder -- the actual invitation info endpoint
        // would be used here. For now, the UI gracefully handles
        // the absence of invitation info.
        error: () => {
          // Not critical -- we just won't show the invitation info banner
        },
      });
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
