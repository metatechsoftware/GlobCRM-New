import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { NotificationCenterComponent } from '../../../features/notifications/notification-center/notification-center.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    NotificationCenterComponent,
    GlobalSearchComponent,
  ],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent {
  readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly breakpointObserver = inject(BreakpointObserver);

  /** Reactive signal: true when viewport is 768px or narrower */
  isMobile = toSignal(
    this.breakpointObserver.observe(['(max-width: 768px)'])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  /** Controls the mobile navigation drawer open/close state */
  sidenavOpen = signal(false);

  get userInitials(): string {
    const user = this.authStore.user();
    if (!user) return '';
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  toggleSidenav(): void {
    this.sidenavOpen.update(v => !v);
  }

  closeSidenav(): void {
    this.sidenavOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  navigateToSecurity(): void {
    this.router.navigate(['/auth/2fa']);
  }
}
