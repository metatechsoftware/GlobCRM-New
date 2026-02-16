import { Injectable } from '@angular/core';

const DEV_TENANT_KEY = 'globcrm_dev_tenant';

/**
 * Extracts tenant context from the subdomain.
 *
 * Production: "acme.globcrm.com" -> subdomain = "acme"
 * Development: Falls back to localStorage 'globcrm_dev_tenant' override
 * when running on localhost.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly hostname = typeof window !== 'undefined' ? window.location.hostname : '';

  /**
   * Get the current subdomain, if any.
   * Returns null on the main domain (e.g., globcrm.com or localhost).
   */
  getSubdomain(): string | null {
    // Development: use localStorage override
    if (this.isDevelopment()) {
      const devTenant = localStorage.getItem(DEV_TENANT_KEY);
      return devTenant || null;
    }

    // Production: extract from hostname
    const parts = this.hostname.split('.');

    // Expected format: subdomain.globcrm.com (3+ parts)
    // No subdomain: globcrm.com (2 parts) or www.globcrm.com
    if (parts.length >= 3) {
      const subdomain = parts[0];
      // "www" is not a tenant subdomain
      if (subdomain === 'www') {
        return null;
      }
      return subdomain;
    }

    return null;
  }

  /**
   * Whether the current hostname is the main domain (no tenant subdomain).
   * Used to show the main marketing/signup page.
   */
  isMainDomain(): boolean {
    return this.getSubdomain() === null;
  }

  /**
   * Set a development tenant override (for localhost testing).
   */
  setDevTenant(subdomain: string): void {
    localStorage.setItem(DEV_TENANT_KEY, subdomain);
  }

  /**
   * Clear the development tenant override.
   */
  clearDevTenant(): void {
    localStorage.removeItem(DEV_TENANT_KEY);
  }

  private isDevelopment(): boolean {
    return (
      this.hostname === 'localhost' ||
      this.hostname === '127.0.0.1' ||
      this.hostname.startsWith('192.168.')
    );
  }
}
