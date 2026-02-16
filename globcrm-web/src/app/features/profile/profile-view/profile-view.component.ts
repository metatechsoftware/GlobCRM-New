import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ProfileService, ProfileDto } from '../profile.service';

/**
 * Read-only profile view for viewing another user's public profile.
 * Accessed from team directory via /profile/:userId.
 */
@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    AvatarComponent,
  ],
  template: `
    @if (loading()) {
      <div class="loading-state">
        <p>Loading profile...</p>
      </div>
    } @else if (profile(); as p) {
      <div class="profile-view">
        <button mat-icon-button (click)="goBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>

        <mat-card class="profile-card">
          <div class="profile-header">
            <app-avatar
              [avatarUrl]="p.avatarUrl"
              [firstName]="p.firstName"
              [lastName]="p.lastName"
              [avatarColor]="p.avatarColor"
              size="lg" />
            <div class="profile-name">
              <h1>{{ p.firstName }} {{ p.lastName }}</h1>
              @if (p.jobTitle) {
                <p class="job-title">{{ p.jobTitle }}</p>
              }
              @if (p.department) {
                <p class="department">{{ p.department }}</p>
              }
            </div>
          </div>

          <mat-divider></mat-divider>

          <mat-card-content>
            <!-- Contact Info -->
            <div class="info-section">
              <h3>Contact</h3>
              <div class="info-row">
                <mat-icon>email</mat-icon>
                <span>{{ p.email }}</span>
              </div>
              @if (p.phone) {
                <div class="info-row">
                  <mat-icon>phone</mat-icon>
                  <span>{{ p.phone }}</span>
                </div>
              }
            </div>

            <!-- Bio -->
            @if (p.bio) {
              <div class="info-section">
                <h3>About</h3>
                <p class="bio">{{ p.bio }}</p>
              </div>
            }

            <!-- Skills -->
            @if (p.skills && p.skills.length > 0) {
              <div class="info-section">
                <h3>Skills</h3>
                <mat-chip-set>
                  @for (skill of p.skills; track skill) {
                    <mat-chip>{{ skill }}</mat-chip>
                  }
                </mat-chip-set>
              </div>
            }

            <!-- Social Links -->
            @if (p.socialLinks && hasSocialLinks(p.socialLinks)) {
              <div class="info-section">
                <h3>Social</h3>
                @if (p.socialLinks['linkedin']) {
                  <div class="info-row">
                    <mat-icon>link</mat-icon>
                    <a [href]="p.socialLinks['linkedin']" target="_blank">LinkedIn</a>
                  </div>
                }
                @if (p.socialLinks['twitter']) {
                  <div class="info-row">
                    <mat-icon>link</mat-icon>
                    <a [href]="p.socialLinks['twitter']" target="_blank">Twitter / X</a>
                  </div>
                }
                @if (p.socialLinks['github']) {
                  <div class="info-row">
                    <mat-icon>link</mat-icon>
                    <a [href]="p.socialLinks['github']" target="_blank">GitHub</a>
                  </div>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      </div>
    } @else {
      <div class="empty-state">
        <h3>Profile not found</h3>
        <button mat-stroked-button (click)="goBack()">Go Back</button>
      </div>
    }
  `,
  styles: [`
    .profile-view {
      max-width: 720px;
      margin: 0 auto;
      padding: 24px;
    }

    .back-button {
      margin-bottom: 16px;
    }

    .profile-card {
      overflow: hidden;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 24px;
    }

    .profile-name h1 {
      margin: 0;
      font-size: 24px;
    }

    .job-title {
      color: rgba(0, 0, 0, 0.6);
      margin: 4px 0 0;
    }

    .department {
      color: rgba(0, 0, 0, 0.4);
      margin: 2px 0 0;
      font-size: 14px;
    }

    .info-section {
      margin: 24px 0;
    }

    .info-section h3 {
      margin: 0 0 12px;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(0, 0, 0, 0.5);
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 8px 0;
    }

    .info-row mat-icon {
      color: rgba(0, 0, 0, 0.4);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .bio {
      line-height: 1.6;
      white-space: pre-line;
    }

    .loading-state,
    .empty-state {
      text-align: center;
      padding: 48px 24px;
    }
  `],
})
export class ProfileViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profileService = inject(ProfileService);

  readonly loading = signal<boolean>(true);
  readonly profile = signal<ProfileDto | null>(null);

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (userId) {
      this.profileService.getPublicProfile(userId).subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
      });
    } else {
      this.loading.set(false);
    }
  }

  hasSocialLinks(links: Record<string, string> | null): boolean {
    return links !== null && Object.keys(links).length > 0;
  }

  goBack(): void {
    this.router.navigate(['/team-directory']);
  }
}
