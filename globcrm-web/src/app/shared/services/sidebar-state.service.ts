import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  readonly isCollapsed = signal(
    typeof localStorage !== 'undefined' && localStorage.getItem('sidebar-collapsed') === 'true'
  );

  toggle(): void {
    this.isCollapsed.update(v => !v);
    localStorage.setItem('sidebar-collapsed', String(this.isCollapsed()));
  }
}
