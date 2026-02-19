import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthStore } from './core/auth/auth.store';
import { SignalRService } from './core/signalr/signalr.service';
import { NotificationStore } from './features/notifications/notification.store';
import { SidebarStateService } from './shared/services/sidebar-state.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    @if (showNavbar()) {
      <app-navbar />
    }
    <main class="app-content"
          [class.app-content--with-sidebar]="showNavbar() && !isMobile()"
          [class.app-content--sidebar-collapsed]="showNavbar() && !isMobile() && sidebarState.isCollapsed()"
          [class.app-content--with-topbar]="showNavbar() && isMobile()">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }

      .app-content {
        height: 100vh;
        overflow: auto;
      }

      /* Desktop: offset by sidebar width + content header height */
      .app-content--with-sidebar {
        margin-left: 240px;
        padding-top: 56px;
        transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .app-content--sidebar-collapsed {
        margin-left: 64px;
      }

      /* Mobile: offset by top bar height only */
      .app-content--with-topbar {
        margin-left: 0;
        padding-top: 56px;
      }
    `,
  ],
})
export class AppComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly signalRService = inject(SignalRService);
  private readonly notificationStore = inject(NotificationStore);
  readonly sidebarState = inject(SidebarStateService);
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly themeService = inject(ThemeService);

  /** Start/stop SignalR and load unread count based on auth state. */
  private readonly authEffect = effect(() => {
    const isAuthenticated = this.authStore.isAuthenticated();
    if (isAuthenticated) {
      this.signalRService.start();
      this.notificationStore.loadUnreadCount();
    } else {
      this.signalRService.stop();
    }
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  readonly isMobile = toSignal(
    this.breakpointObserver.observe(['(max-width: 768px)'])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  readonly showNavbar = computed(() => {
    const isAuthenticated = this.authStore.isAuthenticated();
    const url = this.currentUrl();
    const isAuthPage = url.startsWith('/auth/');
    return isAuthenticated && !isAuthPage;
  });
}
