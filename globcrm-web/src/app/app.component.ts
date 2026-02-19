import { Component, inject, computed, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { AuthStore } from './core/auth/auth.store';
import { SignalRService } from './core/signalr/signalr.service';
import { NotificationStore } from './features/notifications/notification.store';
import { SidebarStateService } from './shared/services/sidebar-state.service';
import { ThemeService } from './core/theme/theme.service';
import { PreviewSidebarStore } from './shared/stores/preview-sidebar.store';
import { EntityPreviewSidebarComponent } from './shared/components/entity-preview-sidebar/entity-preview-sidebar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, MatSidenavModule, EntityPreviewSidebarComponent],
  template: `
    @if (showNavbar()) {
      <app-navbar />
    }
    <mat-sidenav-container class="app-sidenav-container"
                           [class.has-nav-sidebar]="showNavbar() && !isMobile()"
                           [class.nav-sidebar-collapsed]="showNavbar() && !isMobile() && sidebarState.isCollapsed()">
      <mat-sidenav-content class="app-content"
                           [class.app-content--with-topbar]="showNavbar() && isMobile()"
                           (click)="onContentClick()">
        <router-outlet />
      </mat-sidenav-content>

      @if (showNavbar()) {
        <mat-sidenav #previewDrawer
                     position="end"
                     mode="side"
                     [opened]="previewStore.isOpen()"
                     disableClose
                     class="preview-drawer">
          <app-entity-preview-sidebar />
        </mat-sidenav>
      }
    </mat-sidenav-container>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100vh;
      }

      .app-sidenav-container {
        height: 100vh;
      }

      .app-sidenav-container.has-nav-sidebar {
        margin-left: 240px;
        padding-top: 56px;
        transition: margin-left 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .app-sidenav-container.nav-sidebar-collapsed {
        margin-left: 64px;
      }

      .app-content {
        height: 100%;
        overflow: auto;
      }

      .app-content--with-topbar {
        padding-top: 56px;
      }

      .preview-drawer {
        width: 480px;
        border-left: 1px solid var(--color-border);
      }

      ::ng-deep .preview-drawer .mat-drawer-inner-container {
        overflow-y: auto;
      }

      ::ng-deep .mat-drawer.preview-drawer {
        transition: transform 350ms ease !important;
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
  readonly previewStore = inject(PreviewSidebarStore);

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

  onContentClick(): void {
    if (this.previewStore.isOpen()) {
      this.previewStore.close();
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.previewStore.isOpen()) {
      this.previewStore.close();
    }
  }
}
