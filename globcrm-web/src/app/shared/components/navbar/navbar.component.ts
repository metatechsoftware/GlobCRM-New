import { Component, computed, inject, signal } from '@angular/core';
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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { LanguageService, SupportedLang } from '../../../core/i18n/language.service';
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
    TranslocoPipe,
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
  readonly languageService = inject(LanguageService);
  private readonly translocoService = inject(TranslocoService);
  readonly currentLang = this.languageService.currentLang;

  isMobile = toSignal(
    this.breakpointObserver.observe(['(max-width: 768px)'])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  mobileOpen = signal(false);

  readonly navGroups = computed(() => {
    // Reading currentLang() makes this reactive to language changes
    const lang = this.currentLang();
    const t = (key: string) => this.translocoService.translate(key);

    return [
      {
        label: '',
        items: [
          { route: '/my-day', icon: 'home', label: t('nav.myDay') },
          { route: '/analytics', icon: 'grid_view', label: t('nav.analytics') },
          { route: '/reports', icon: 'bar_chart', label: t('nav.reports') },
        ]
      },
      {
        label: t('nav.groups.crm'),
        items: [
          { route: '/companies', icon: 'business', label: t('nav.companies') },
          { route: '/contacts', icon: 'people', label: t('nav.contacts') },
          { route: '/leads', icon: 'person_search', label: t('nav.leads') },
          { route: '/products', icon: 'inventory_2', label: t('nav.products') },
          { route: '/deals', icon: 'handshake', label: t('nav.deals') },
        ]
      },
      {
        label: t('nav.groups.work'),
        items: [
          { route: '/activities', icon: 'task_alt', label: t('nav.activities') },
          { route: '/quotes', icon: 'request_quote', label: t('nav.quotes') },
          { route: '/requests', icon: 'support_agent', label: t('nav.requests') },
          { route: '/notes', icon: 'note', label: t('nav.notes') },
        ]
      },
      {
        label: t('nav.groups.connect'),
        items: [
          { route: '/emails', icon: 'email', label: t('nav.emails') },
          { route: '/email-templates', icon: 'drafts', label: t('nav.templates') },
          { route: '/sequences', icon: 'schedule_send', label: t('nav.sequences') },
          { route: '/workflows', icon: 'account_tree', label: t('nav.workflows') },
          { route: '/feed', icon: 'dynamic_feed', label: t('nav.feed') },
          { route: '/calendar', icon: 'calendar_month', label: t('nav.calendar') },
        ]
      },
      {
        label: t('nav.groups.admin'),
        items: [
          { route: '/duplicates', icon: 'compare_arrows', label: t('nav.duplicates') },
          { route: '/import', icon: 'upload_file', label: t('nav.import') },
          { route: '/team-directory', icon: 'groups', label: t('nav.team') },
          { route: '/settings', icon: 'settings', label: t('nav.settings') },
        ]
      },
    ];
  });

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

  switchLanguage(lang: SupportedLang): void {
    this.languageService.switchLanguage(lang);
  }
}
