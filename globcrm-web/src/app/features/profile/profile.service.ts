import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { environment } from '../../../environments/environment.development';

export interface ProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  bio: string | null;
  jobTitle: string | null;
  department: string | null;
  reportingManagerId: string | null;
  reportingManagerName: string | null;
  skills: string[];
  linkedIn: string | null;
  twitter: string | null;
  gitHub: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
  workDays: string[];
  workStartTime: string | null;
  workEndTime: string | null;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  phone?: string | null;
  bio?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  reportingManagerId?: string | null;
  skills?: string[];
  linkedIn?: string | null;
  twitter?: string | null;
  gitHub?: string | null;
  workDays?: string[];
  workStartTime?: string | null;
  workEndTime?: string | null;
}

export interface PreferencesDto {
  theme: 'Light' | 'Dark';
  language: string;
  timezone: string;
  dateFormat: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  taskAssigned: boolean;
  dealUpdated: boolean;
  mention: boolean;
  weeklyReport: boolean;
}

export interface UpdatePreferencesRequest {
  theme?: 'Light' | 'Dark';
  language?: string;
  timezone?: string;
  dateFormat?: string;
  notifications?: Partial<NotificationPreferences>;
}

export interface TeamMemberDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  avatarUrl: string | null;
  avatarColor: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Service for managing user profiles, preferences, avatar, and team directory.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Get current user's profile */
  getProfile(): Observable<ProfileDto> {
    return this.api.get<ProfileDto>('/api/profile');
  }

  /** Get another user's public profile */
  getPublicProfile(userId: string): Observable<ProfileDto> {
    return this.api.get<ProfileDto>(`/api/profile/${userId}`);
  }

  /** Update current user's profile */
  updateProfile(data: UpdateProfileRequest): Observable<ProfileDto> {
    return this.api.put<ProfileDto>('/api/profile', data);
  }

  /** Upload avatar image (multipart form data) */
  uploadAvatar(file: Blob): Observable<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append('file', file, 'avatar.webp');
    return this.http.post<{ avatarUrl: string }>(
      `${this.baseUrl}/api/profile/avatar`,
      formData,
    );
  }

  /** Delete current avatar */
  deleteAvatar(): Observable<void> {
    return this.api.delete<void>('/api/profile/avatar');
  }

  /** Get current user's preferences */
  getPreferences(): Observable<PreferencesDto> {
    return this.api.get<PreferencesDto>('/api/profile/preferences');
  }

  /** Update current user's preferences */
  updatePreferences(data: UpdatePreferencesRequest): Observable<PreferencesDto> {
    return this.api.put<PreferencesDto>('/api/profile/preferences', data);
  }

  /** Get team directory with search, department filter, and pagination */
  getTeamDirectory(params: {
    search?: string;
    department?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PaginatedResult<TeamMemberDto>> {
    let httpParams = new HttpParams();
    if (params.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params.department) {
      httpParams = httpParams.set('department', params.department);
    }
    if (params.page != null) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params.pageSize != null) {
      httpParams = httpParams.set('pageSize', params.pageSize.toString());
    }
    return this.api.get<PaginatedResult<TeamMemberDto>>(
      '/api/team-directory',
      httpParams,
    );
  }
}
