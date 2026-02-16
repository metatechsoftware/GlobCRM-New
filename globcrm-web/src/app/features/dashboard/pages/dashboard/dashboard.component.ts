import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <div style="padding: 2rem; text-align: center;">
      <h1>GlobCRM Dashboard</h1>
      <p>Welcome to GlobCRM. Your workspace is ready.</p>
    </div>
  `,
})
export class DashboardComponent {}
