import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../api/api.service';
import {
  EffectivePermission,
  FieldPermission,
  RoleDto,
  RoleDetailDto,
  CreateRoleRequest,
  UpdateRoleRequest,
  TeamDto,
  TeamDetailDto,
  CreateTeamRequest,
  UpdateTeamRequest,
} from './permission.models';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly api = inject(ApiService);

  // --- Current user permissions ---

  getMyPermissions(): Observable<EffectivePermission[]> {
    return this.api.get<EffectivePermission[]>('/api/roles/my-permissions');
  }

  getMyFieldPermissions(): Observable<FieldPermission[]> {
    return this.api.get<FieldPermission[]>('/api/roles/my-field-permissions');
  }

  // --- Role management ---

  getRoles(): Observable<RoleDto[]> {
    return this.api.get<RoleDto[]>('/api/roles');
  }

  getRole(id: string): Observable<RoleDetailDto> {
    return this.api.get<RoleDetailDto>(`/api/roles/${id}`);
  }

  createRole(role: CreateRoleRequest): Observable<RoleDetailDto> {
    return this.api.post<RoleDetailDto>('/api/roles', role);
  }

  updateRole(id: string, role: UpdateRoleRequest): Observable<RoleDetailDto> {
    return this.api.put<RoleDetailDto>(`/api/roles/${id}`, role);
  }

  deleteRole(id: string): Observable<void> {
    return this.api.delete<void>(`/api/roles/${id}`);
  }

  cloneRole(id: string, name: string): Observable<RoleDetailDto> {
    return this.api.post<RoleDetailDto>(`/api/roles/${id}/clone`, { name });
  }

  assignRole(roleId: string, userId: string): Observable<void> {
    return this.api.post<void>(`/api/roles/${roleId}/assign`, { userId });
  }

  unassignRole(roleId: string, userId: string): Observable<void> {
    return this.api.delete<void>(`/api/roles/${roleId}/assign/${userId}`);
  }

  // --- Team management ---

  getTeams(): Observable<TeamDto[]> {
    return this.api.get<TeamDto[]>('/api/teams');
  }

  getTeam(id: string): Observable<TeamDetailDto> {
    return this.api.get<TeamDetailDto>(`/api/teams/${id}`);
  }

  createTeam(team: CreateTeamRequest): Observable<TeamDetailDto> {
    return this.api.post<TeamDetailDto>('/api/teams', team);
  }

  updateTeam(id: string, team: UpdateTeamRequest): Observable<TeamDetailDto> {
    return this.api.put<TeamDetailDto>(`/api/teams/${id}`, team);
  }

  deleteTeam(id: string): Observable<void> {
    return this.api.delete<void>(`/api/teams/${id}`);
  }

  addTeamMember(teamId: string, userId: string): Observable<void> {
    return this.api.post<void>(`/api/teams/${teamId}/members`, { userId });
  }

  removeTeamMember(teamId: string, userId: string): Observable<void> {
    return this.api.delete<void>(`/api/teams/${teamId}/members/${userId}`);
  }
}
