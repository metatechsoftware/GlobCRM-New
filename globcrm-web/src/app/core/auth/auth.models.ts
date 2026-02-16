export interface LoginRequest {
  email: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginResponse {
  tokenType: string;
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface CreateOrgRequest {
  orgName: string;
  subdomain: string;
  industry?: string;
  companySize?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface JoinOrgRequest {
  token: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface UserInfo {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organizationName: string;
  role: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  resetCode: string;
  newPassword: string;
}

export interface TwoFactorRequest {
  twoFactorCode: string;
}

export interface TwoFactorInfo {
  hasAuthenticator: boolean;
  recoveryCodesLeft: number;
  is2faEnabled: boolean;
  isMachineRemembered: boolean;
  sharedKey?: string;
  authenticatorUri?: string;
}

export interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresTwoFactor: boolean;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  subdomain: string;
}
