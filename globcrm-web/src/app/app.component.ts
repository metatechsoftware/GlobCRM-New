import { Component, inject, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthStore } from './core/auth/auth.store';
import { SignalRService } from './core/signalr/signalr.service';
import { NotificationStore } from './features/notifications/notification.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent],
  template: `
    @if (showNavbar()) {
      <app-navbar />
    }
    <router-outlet />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        overflow: hidden;
      }

      router-outlet + * {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
    `,
  ],
})
export class AppComponent {
  private readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly signalRService = inject(SignalRService);
  private readonly notificationStore = inject(NotificationStore);

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

  readonly showNavbar = computed(() => {
    const isAuthenticated = this.authStore.isAuthenticated();
    const url = this.currentUrl();
    const isAuthPage = url.startsWith('/auth/');
    return isAuthenticated && !isAuthPage;
  });
}
