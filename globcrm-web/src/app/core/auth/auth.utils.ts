import { UserInfo } from './auth.models';

/**
 * Decode the JWT payload to extract UserInfo including role.
 * Shared between AuthService (login) and AuthGuard (silent refresh).
 */
export function decodeUserInfoFromJwt(token: string): UserInfo | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // ClaimTypes.Role uses the full URI as the key
    const role =
      payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
      payload['role'] ??
      '';
    return {
      id: payload['sub'] ?? '',
      firstName: payload['firstName'] ?? '',
      lastName: payload['lastName'] ?? '',
      email: payload['email'] ?? '',
      organizationId: payload['organizationId'] ?? '',
      organizationName: payload['organizationName'] ?? '',
      role: Array.isArray(role) ? role[0] : role,
    };
  } catch {
    return null;
  }
}
