import { Injectable, Injector, InjectionToken, ElementRef, inject, signal } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { UserPreviewPopoverComponent } from '../components/user-preview/user-preview-popover.component';

export interface UserPreviewConfig {
  userId: string;
  userName: string;
}

export const USER_PREVIEW_CONFIG = new InjectionToken<UserPreviewConfig>('USER_PREVIEW_CONFIG');

/**
 * Service to open/close user preview popovers via CDK Overlay.
 * Root-provided so it can be injected anywhere (feed, mentions, team directory, etc.).
 *
 * Uses FlexibleConnectedPositionStrategy to anchor the popover to the click target element.
 */
@Injectable({ providedIn: 'root' })
export class UserPreviewService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  private overlayRef: OverlayRef | null = null;
  readonly isOpen = signal(false);

  open(config: UserPreviewConfig, origin: ElementRef | HTMLElement): void {
    this.close();

    const elementRef = origin instanceof ElementRef ? origin : new ElementRef(origin);

    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position()
        .flexibleConnectedTo(elementRef)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
          { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 },
        ]),
      width: '320px',
      hasBackdrop: true,
      backdropClass: 'cdk-overlay-transparent-backdrop',
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'user-preview-popover-panel',
    });

    const portalInjector = Injector.create({
      providers: [{ provide: USER_PREVIEW_CONFIG, useValue: config }],
      parent: this.injector,
    });

    const portal = new ComponentPortal(UserPreviewPopoverComponent, null, portalInjector);
    this.overlayRef.attach(portal);

    this.overlayRef.backdropClick().subscribe(() => this.close());
    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') this.close();
    });

    this.isOpen.set(true);
  }

  close(): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }
    this.isOpen.set(false);
  }
}
