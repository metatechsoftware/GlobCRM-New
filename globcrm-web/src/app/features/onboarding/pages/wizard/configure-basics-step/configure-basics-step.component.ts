import { Component, inject, signal, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../../../core/auth/auth.service';

interface TimezoneOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-configure-basics-step',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './configure-basics-step.component.html',
  styleUrl: './configure-basics-step.component.scss',
})
export class ConfigureBasicsStepComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  stepComplete = output<void>();
  skipStep = output<void>();

  settingsForm!: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  timezones: TimezoneOption[] = [
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
    { value: 'America/Anchorage', label: 'Alaska' },
    { value: 'Pacific/Honolulu', label: 'Hawaii' },
    { value: 'Europe/London', label: 'London (GMT)' },
    { value: 'Europe/Paris', label: 'Paris (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Europe/Moscow', label: 'Moscow' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'Asia/Shanghai', label: 'China (CST)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'Pacific/Auckland', label: 'Auckland (NZST)' },
  ];

  currencies = [
    { value: 'USD', label: 'USD ($) - US Dollar' },
    { value: 'EUR', label: 'EUR (E) - Euro' },
    { value: 'GBP', label: 'GBP (P) - British Pound' },
    { value: 'CAD', label: 'CAD ($) - Canadian Dollar' },
    { value: 'AUD', label: 'AUD ($) - Australian Dollar' },
    { value: 'JPY', label: 'JPY (Y) - Japanese Yen' },
    { value: 'CHF', label: 'CHF (Fr) - Swiss Franc' },
    { value: 'INR', label: 'INR (R) - Indian Rupee' },
    { value: 'BRL', label: 'BRL (R$) - Brazilian Real' },
    { value: 'MXN', label: 'MXN ($) - Mexican Peso' },
  ];

  dateFormats = [
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
  ];

  ngOnInit(): void {
    const detectedTimezone = this.detectBrowserTimezone();

    this.settingsForm = this.fb.group({
      timezone: [detectedTimezone],
      currency: ['USD'],
      dateFormat: ['MM/DD/YYYY'],
    });
  }

  private detectBrowserTimezone(): string {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Check if the detected timezone is in our list
      const found = this.timezones.find((t) => t.value === tz);
      return found ? tz : 'America/New_York';
    } catch {
      return 'America/New_York';
    }
  }

  onSaveSettings(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { timezone, currency, dateFormat } = this.settingsForm.value;

    this.authService.updateOrganizationSettings({ timezone, currency, dateFormat }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Settings saved successfully.');
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Failed to save settings.');
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
