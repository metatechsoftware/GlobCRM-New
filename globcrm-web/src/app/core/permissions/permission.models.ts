export interface EffectivePermission {
  entityType: string;
  operation: string;
  scope: 'none' | 'own' | 'team' | 'all';
}

export interface FieldPermission {
  entityType: string;
  fieldName: string;
  accessLevel: 'hidden' | 'readonly' | 'editable';
}

// For the roles management UI (Plan 10)
export interface RoleDto {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isTemplate: boolean;
  permissionCount: number;
  assignedUserCount: number;
}

export interface RoleDetailDto extends RoleDto {
  permissions: RolePermissionDto[];
  fieldPermissions: RoleFieldPermissionDto[];
}

export interface RolePermissionDto {
  entityType: string;
  operation: string;
  scope: 'none' | 'own' | 'team' | 'all';
}

export interface RoleFieldPermissionDto {
  entityType: string;
  fieldName: string;
  accessLevel: 'hidden' | 'readonly' | 'editable';
}

export interface CreateRoleRequest {
  name: string;
  description?: string | null;
  permissions: RolePermissionDto[];
  fieldPermissions?: RoleFieldPermissionDto[];
}

export interface UpdateRoleRequest {
  name: string;
  description?: string | null;
  permissions: RolePermissionDto[];
  fieldPermissions?: RoleFieldPermissionDto[];
}

export interface TeamDto {
  id: string;
  name: string;
  description: string | null;
  defaultRoleName: string | null;
  memberCount: number;
}

export interface TeamDetailDto extends TeamDto {
  defaultRoleId: string | null;
  members: TeamMemberDto[];
}

export interface TeamMemberDto {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  avatarColor: string | null;
}

export interface CreateTeamRequest {
  name: string;
  description?: string | null;
  defaultRoleId?: string | null;
}

export interface UpdateTeamRequest {
  name: string;
  description?: string | null;
  defaultRoleId?: string | null;
}
