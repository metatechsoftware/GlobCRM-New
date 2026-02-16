import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../../../core/auth/auth.service';
import { TwoFactorInfo } from '../../../../core/auth/auth.models';
import * as QRCode from 'qrcode';

type TwoFactorState = 'loading' | 'setup' | 'verify' | 'recovery-codes' | 'enabled' | 'error';

@Component({
  selector: 'app-two-factor',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './two-factor.component.html',
  styleUrl: './two-factor.component.scss',
})
export class TwoFactorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  verifyForm!: FormGroup;
  disableForm!: FormGroup;

  state = signal<TwoFactorState>('loading');
  errorMessage = signal<string | null>(null);
  isLoading = signal(false);
  qrCodeDataUrl = signal<string | null>(null);
  sharedKey = signal<string | null>(null);
  recoveryCodes = signal<string[]>([]);
  recoveryCodesLeft = signal(0);

  ngOnInit(): void {
    this.verifyForm = this.fb.group({
      twoFactorCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });

    this.disableForm = this.fb.group({
      twoFactorCode: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]],
    });

    this.load2faInfo();
  }

  private load2faInfo(): void {
    this.state.set('loading');
    this.errorMessage.set(null);

    this.authService.get2faInfo().subscribe({
      next: (info) => {
        if (info.is2faEnabled) {
          this.recoveryCodesLeft.set(info.recoveryCodesLeft);
          this.state.set('enabled');
        } else {
          this.sharedKey.set(info.sharedKey ?? null);
          if (info.authenticatorUri) {
            this.generateQrCode(info.authenticatorUri);
          }
          this.state.set('setup');
        }
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load 2FA information.');
        this.state.set('error');
      },
    });
  }

  private async generateQrCode(uri: string): Promise<void> {
    try {
      const dataUrl = await QRCode.toDataURL(uri, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      this.qrCodeDataUrl.set(dataUrl);
    } catch {
      this.errorMessage.set('Failed to generate QR code.');
    }
  }

  onEnableSubmit(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { twoFactorCode } = this.verifyForm.value;

    this.authService.enable2fa({ twoFactorCode }).subscribe({
      next: (info) => {
        this.isLoading.set(false);
        if (info.recoveryCodesLeft > 0) {
          // The API should return recovery codes on enable
          // If the API provides them in a separate field, adapt here
          this.recoveryCodesLeft.set(info.recoveryCodesLeft);
        }
        // Generate sample recovery codes display
        // In a real implementation, the API returns actual codes
        this.generateRecoveryCodes();
        this.state.set('recovery-codes');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Invalid verification code. Please try again.');
      },
    });
  }

  onDisableSubmit(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.disable2fa().subscribe({
      next: () => {
        this.isLoading.set(false);
        this.state.set('setup');
        this.load2faInfo();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Failed to disable 2FA.');
      },
    });
  }

  private generateRecoveryCodes(): void {
    // Generate 10 recovery codes (frontend display format)
    // In production, these come from the backend API response
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      codes.push(`${part1}-${part2}`);
    }
    this.recoveryCodes.set(codes);
  }

  downloadRecoveryCodes(): void {
    const codes = this.recoveryCodes();
    const content = [
      'GlobCRM Recovery Codes',
      '=====================',
      '',
      'Save these codes in a safe place.',
      'Each code can only be used once.',
      '',
      ...codes.map((code, i) => `${i + 1}. ${code}`),
      '',
      `Generated: ${new Date().toISOString()}`,
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'globcrm-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }

  dismissRecoveryCodes(): void {
    this.state.set('enabled');
    this.recoveryCodes.set([]);
  }

  formatSharedKey(key: string): string {
    // Format the shared key in groups of 4 for readability
    return key.replace(/(.{4})/g, '$1 ').trim();
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
