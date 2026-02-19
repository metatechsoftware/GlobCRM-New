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
  templateUrl: './profile-view.component.html',
  styleUrl: './profile-view.component.scss',
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
