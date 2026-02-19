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
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { SidebarStateService } from '../../services/sidebar-state.service';
import { NotificationCenterComponent } from '../../../features/notifications/notification-center/notification-center.component';
import { GlobalSearchComponent } from '../global-search/global-search.component';

interface NavItem {
  route: string;
  icon: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

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
    MatTooltipModule,
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
  readonly sidebarState = inject(SidebarStateService);
  readonly themeService = inject(ThemeService);

  isMobile = toSignal(
    this.breakpointObserver.observe(['(max-width: 768px)'])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  mobileOpen = signal(false);

  readonly navGroups: NavGroup[] = [
    {
      label: '',
      items: [
        { route: '/dashboard', icon: 'grid_view', label: 'Dashboard' },
        { route: '/reports', icon: 'bar_chart', label: 'Reports' },
      ]
    },
    {
      label: 'CRM',
      items: [
        { route: '/companies', icon: 'business', label: 'Companies' },
        { route: '/contacts', icon: 'people', label: 'Contacts' },
        { route: '/leads', icon: 'person_search', label: 'Leads' },
        { route: '/products', icon: 'inventory_2', label: 'Products' },
        { route: '/deals', icon: 'handshake', label: 'Deals' },
      ]
    },
    {
      label: 'Work',
      items: [
        { route: '/activities', icon: 'task_alt', label: 'Activities' },
        { route: '/quotes', icon: 'request_quote', label: 'Quotes' },
        { route: '/requests', icon: 'support_agent', label: 'Requests' },
        { route: '/notes', icon: 'note', label: 'Notes' },
      ]
    },
    {
      label: 'Connect',
      items: [
        { route: '/emails', icon: 'email', label: 'Emails' },
        { route: '/email-templates', icon: 'drafts', label: 'Templates' },
        { route: '/sequences', icon: 'schedule_send', label: 'Sequences' },
        { route: '/workflows', icon: 'account_tree', label: 'Workflows' },
        { route: '/feed', icon: 'dynamic_feed', label: 'Feed' },
        { route: '/calendar', icon: 'calendar_month', label: 'Calendar' },
      ]
    },
    {
      label: 'Admin',
      items: [
        { route: '/duplicates', icon: 'compare_arrows', label: 'Duplicates' },
        { route: '/import', icon: 'upload_file', label: 'Import' },
        { route: '/team-directory', icon: 'groups', label: 'Team' },
        { route: '/settings', icon: 'settings', label: 'Settings' },
      ]
    },
  ];

  get userInitials(): string {
    const user = this.authStore.user();
    if (!user) return '';
    const first = user.firstName?.charAt(0) ?? '';
    const last = user.lastName?.charAt(0) ?? '';
    return (first + last).toUpperCase();
  }

  toggleCollapse(): void {
    this.sidebarState.toggle();
  }

  toggleMobile(): void {
    this.mobileOpen.update(v => !v);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  navigateToSecurity(): void {
    this.router.navigate(['/auth/2fa']);
  }
}
