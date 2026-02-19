import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PermissionService } from '../../../core/permissions/permission.service';
import { TeamDto } from '../../../core/permissions/permission.models';
import { ConfirmDeleteDialogComponent } from '../../../shared/components/confirm-delete-dialog/confirm-delete-dialog.component';
import { HasPermissionDirective } from '../../../core/permissions/has-permission.directive';

@Component({
  selector: 'app-team-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    HasPermissionDirective,
  ],
  templateUrl: './team-list.component.html',
  styleUrl: './team-list.component.scss',
})
export class TeamListComponent implements OnInit {
  private readonly permissionService = inject(PermissionService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  teams = signal<TeamDto[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  private readonly teamColors: [string, string][] = [
    ['var(--color-primary)', 'var(--color-primary-soft)'],
    ['var(--color-secondary)', 'var(--color-secondary-soft)'],
    ['var(--color-accent)', 'var(--color-accent-soft)'],
    ['var(--color-info)', 'var(--color-info-soft)'],
    ['var(--color-success)', 'var(--color-success-soft)'],
    ['var(--color-warning)', 'var(--color-warning-soft)'],
  ];

  ngOnInit(): void {
    this.loadTeams();
  }

  loadTeams(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.permissionService.getTeams().subscribe({
      next: (teams) => {
        this.teams.set(teams);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Failed to load teams.');
        this.isLoading.set(false);
      },
    });
  }

  onEdit(team: TeamDto): void {
    this.router.navigate(['/settings/teams', team.id]);
  }

  onDelete(team: TeamDto): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { name: team.name, type: 'team' },
    });

    dialogRef.afterClosed().subscribe((confirmed: boolean) => {
      if (!confirmed) return;

      this.permissionService.deleteTeam(team.id).subscribe({
        next: () => {
          this.snackBar.open(
            `Team "${team.name}" deleted.`,
            'Close',
            { duration: 3000 }
          );
          this.loadTeams();
        },
        error: (err) => {
          this.snackBar.open(
            err.message || 'Failed to delete team.',
            'Close',
            { duration: 5000 }
          );
        },
      });
    });
  }

  getTeamColor(team: TeamDto): string {
    const hash = team.name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.teamColors[hash % this.teamColors.length][0];
  }

  getTeamColorSoft(team: TeamDto): string {
    const hash = team.name
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return this.teamColors[hash % this.teamColors.length][1];
  }
}
