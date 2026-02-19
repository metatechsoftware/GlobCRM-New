import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { AvatarUploadComponent } from '../../../shared/components/avatar/avatar-upload.component';
import {
  ProfileService,
  ProfileDto,
  PreferencesDto,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  WorkSchedule,
} from '../profile.service';

const WORK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Istanbul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'tr', label: 'Turkish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

const DATE_FORMATS = [
  { value: 'MM/dd/yyyy', label: 'MM/DD/YYYY' },
  { value: 'dd/MM/yyyy', label: 'DD/MM/YYYY' },
  { value: 'yyyy-MM-dd', label: 'YYYY-MM-DD' },
  { value: 'dd.MM.yyyy', label: 'DD.MM.YYYY' },
];

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatCardModule,
    MatDividerModule,
    MatSnackBarModule,
    MatAutocompleteModule,
    AvatarUploadComponent,
  ],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss',
})
export class ProfileEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);
  private readonly snackBar = inject(MatSnackBar);

  readonly workDays = WORK_DAYS;
  readonly timezones = COMMON_TIMEZONES;
  readonly languages = LANGUAGES;
  readonly dateFormats = DATE_FORMATS;

  readonly loading = signal<boolean>(true);
  readonly saving = signal<boolean>(false);
  readonly profile = signal<ProfileDto | null>(null);
  readonly preferences = signal<PreferencesDto | null>(null);
  readonly newSkill = signal<string>('');
  readonly skills = signal<string[]>([]);

  profileForm!: FormGroup;
  preferencesForm!: FormGroup;

  ngOnInit(): void {
    this.buildForms();
    this.loadProfile();
    this.loadPreferences();
  }

  private buildForms(): void {
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: [{ value: '', disabled: true }],
      phone: [''],
      bio: [''],
      jobTitle: [''],
      department: [''],
      reportingManagerId: [''],
      linkedIn: [''],
      twitter: [''],
      gitHub: [''],
      workStartTime: [''],
      workEndTime: [''],
    });

    this.preferencesForm = this.fb.group({
      theme: ['light'],
      language: ['en'],
      timezone: ['UTC'],
      dateFormat: ['MM/dd/yyyy'],
      taskAssigned: [true],
      dealUpdated: [true],
      mention: [true],
      weeklyReport: [true],
    });
  }

  private loadProfile(): void {
    this.profileService.getProfile().subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.skills.set(profile.skills ?? []);
        this.profileForm.patchValue({
          firstName: profile.firstName,
          lastName: profile.lastName,
          email: profile.email,
          phone: profile.phone ?? '',
          bio: profile.bio ?? '',
          jobTitle: profile.jobTitle ?? '',
          department: profile.department ?? '',
          reportingManagerId: profile.reportingManagerId ?? '',
          linkedIn: profile.socialLinks?.['linkedin'] ?? '',
          twitter: profile.socialLinks?.['twitter'] ?? '',
          gitHub: profile.socialLinks?.['github'] ?? '',
          workStartTime: profile.workSchedule?.startTime ?? '',
          workEndTime: profile.workSchedule?.endTime ?? '',
        });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private loadPreferences(): void {
    this.profileService.getPreferences().subscribe({
      next: (prefs) => {
        this.preferences.set(prefs);
        this.preferencesForm.patchValue({
          theme: prefs.theme,
          language: prefs.language,
          timezone: prefs.timezone,
          dateFormat: prefs.dateFormat,
          taskAssigned: prefs.emailNotifications?.['taskAssigned'] ?? true,
          dealUpdated: prefs.emailNotifications?.['dealUpdated'] ?? true,
          mention: prefs.emailNotifications?.['mention'] ?? true,
          weeklyReport: prefs.emailNotifications?.['weeklyReport'] ?? true,
        });
      },
      error: () => {
        // Keep defaults
      },
    });
  }

  isWorkDaySelected(day: string): boolean {
    const profile = this.profile();
    return profile?.workSchedule?.workDays?.includes(day) ?? false;
  }

  toggleWorkDay(day: string): void {
    const current = this.profile();
    if (!current) return;
    const schedule = current.workSchedule ?? { workDays: [], startTime: '09:00', endTime: '17:00' };
    const days = [...(schedule.workDays ?? [])];
    const index = days.indexOf(day);
    if (index >= 0) {
      days.splice(index, 1);
    } else {
      days.push(day);
    }
    this.profile.set({
      ...current,
      workSchedule: { ...schedule, workDays: days },
    });
  }

  addSkill(): void {
    const skill = this.newSkill().trim();
    if (skill && !this.skills().includes(skill)) {
      this.skills.update((s) => [...s, skill]);
      this.newSkill.set('');
    }
  }

  removeSkill(skill: string): void {
    this.skills.update((s) => s.filter((sk) => sk !== skill));
  }

  onAvatarUploaded(event: { avatarUrl: string }): void {
    const blob = this.dataURLToBlob(event.avatarUrl);
    if (blob) {
      this.profileService.uploadAvatar(blob).subscribe({
        next: (result) => {
          const current = this.profile();
          if (current) {
            this.profile.set({ ...current, avatarUrl: result.avatarUrl });
          }
          this.snackBar.open('Avatar updated', 'Close', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Failed to upload avatar', 'Close', { duration: 3000 });
        },
      });
    }
  }

  onAvatarRemoved(): void {
    this.profileService.deleteAvatar().subscribe({
      next: () => {
        const current = this.profile();
        if (current) {
          this.profile.set({ ...current, avatarUrl: null });
        }
        this.snackBar.open('Avatar removed', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to remove avatar', 'Close', { duration: 3000 });
      },
    });
  }

  save(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const profileValue = this.profileForm.getRawValue();
    const profile = this.profile();

    // Build socialLinks from individual form fields
    const socialLinks: Record<string, string> = {};
    if (profileValue.linkedIn) socialLinks['linkedin'] = profileValue.linkedIn;
    if (profileValue.twitter) socialLinks['twitter'] = profileValue.twitter;
    if (profileValue.gitHub) socialLinks['github'] = profileValue.gitHub;

    // Build workSchedule from form fields
    const workSchedule: WorkSchedule | null =
      profileValue.workStartTime || profileValue.workEndTime || (profile?.workSchedule?.workDays?.length ?? 0) > 0
        ? {
            workDays: profile?.workSchedule?.workDays ?? [],
            startTime: profileValue.workStartTime || '09:00',
            endTime: profileValue.workEndTime || '17:00',
          }
        : null;

    const profileRequest: UpdateProfileRequest = {
      firstName: profileValue.firstName,
      lastName: profileValue.lastName,
      phone: profileValue.phone || null,
      bio: profileValue.bio || null,
      jobTitle: profileValue.jobTitle || null,
      department: profileValue.department || null,
      reportingManagerId: profileValue.reportingManagerId || null,
      skills: this.skills(),
      socialLinks: Object.keys(socialLinks).length > 0 ? socialLinks : null,
      workSchedule: workSchedule,
    };

    const prefsValue = this.preferencesForm.getRawValue();
    const prefsRequest: UpdatePreferencesRequest = {
      theme: prefsValue.theme,
      language: prefsValue.language,
      timezone: prefsValue.timezone,
      dateFormat: prefsValue.dateFormat,
      emailNotifications: {
        taskAssigned: prefsValue.taskAssigned,
        dealUpdated: prefsValue.dealUpdated,
        mention: prefsValue.mention,
        weeklyReport: prefsValue.weeklyReport,
      },
    };

    // Save both profile and preferences
    let profileDone = false;
    let prefsDone = false;

    const checkComplete = (): void => {
      if (profileDone && prefsDone) {
        this.saving.set(false);
        this.snackBar.open('Profile saved successfully', 'Close', { duration: 3000 });
      }
    };

    this.profileService.updateProfile(profileRequest).subscribe({
      next: (updated) => {
        this.profile.set(updated);
        profileDone = true;
        checkComplete();
      },
      error: () => {
        profileDone = true;
        this.saving.set(false);
        this.snackBar.open('Failed to save profile', 'Close', { duration: 3000 });
      },
    });

    this.profileService.updatePreferences(prefsRequest).subscribe({
      next: (updated) => {
        this.preferences.set(updated);
        prefsDone = true;
        checkComplete();
      },
      error: () => {
        prefsDone = true;
        this.saving.set(false);
        this.snackBar.open('Failed to save preferences', 'Close', { duration: 3000 });
      },
    });
  }

  private dataURLToBlob(dataURL: string): Blob | null {
    // If it's a blob URL, we can't convert it back to a blob easily
    // The avatar upload component will handle the actual upload
    // This is a fallback for data URLs
    if (dataURL.startsWith('blob:')) {
      return null;
    }
    try {
      const parts = dataURL.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] ?? 'image/webp';
      const bstr = atob(parts[1]);
      const u8arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      return new Blob([u8arr], { type: mime });
    } catch {
      return null;
    }
  }
}
