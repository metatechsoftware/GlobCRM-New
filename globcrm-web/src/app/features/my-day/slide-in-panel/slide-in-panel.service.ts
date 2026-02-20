import { Injectable, Injector, InjectionToken, inject, signal, effect } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Subject } from 'rxjs';
import { take } from 'rxjs/operators';

import { SlideInConfig, SlideInPanelRef, SlideInResult } from './slide-in-panel.models';
import { SlideInPanelComponent } from './slide-in-panel.component';
import { PreviewSidebarStore } from '../../../shared/stores/preview-sidebar.store';

/** Injection token used to pass config to the slide-in panel component. */
export const SLIDE_IN_CONFIG = new InjectionToken<SlideInConfig>('SLIDE_IN_CONFIG');

/**
 * Service to open/close slide-in panels via CDK Overlay.
 * Root-provided so it can be injected anywhere.
 */
@Injectable({ providedIn: 'root' })
export class SlideInPanelService {
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);
  private readonly previewSidebarStore = inject(PreviewSidebarStore);

  /** Current overlay reference. */
  private overlayRef: OverlayRef | null = null;

  /** Subject that emits when the panel closes. */
  private afterClosedSubject: Subject<SlideInResult | null> | null = null;

  /** Whether a slide-in panel is currently open. */
  readonly isOpen = signal(false);

  constructor() {
    // Mutual exclusion: when preview sidebar opens, close slide-in panel
    effect(() => {
      const previewOpen = this.previewSidebarStore.isOpen();
      if (previewOpen && this.isOpen()) {
        this.close(null);
      }
    });
  }

  /**
   * Open a slide-in panel with the given configuration.
   * First closes the preview sidebar and any existing panel.
   */
  open(config: SlideInConfig): SlideInPanelRef {
    // Close preview sidebar if open (mutual exclusion)
    if (this.previewSidebarStore.isOpen()) {
      this.previewSidebarStore.close();
    }

    // Close existing panel if one is already open
    if (this.overlayRef) {
      this.close(null);
    }

    // Create the afterClosed subject for this panel instance
    this.afterClosedSubject = new Subject<SlideInResult | null>();

    // Create overlay with right-side positioning
    this.overlayRef = this.overlay.create({
      positionStrategy: this.overlay.position()
        .global()
        .right('0')
        .top('0')
        .bottom('0'),
      width: '520px',
      hasBackdrop: true,
      backdropClass: 'slide-in-backdrop',
      panelClass: ['slide-in-panel', 'slide-in-panel--animate-in'],
      scrollStrategy: this.overlay.scrollStrategies.block(),
    });

    // Create injector with config token
    const portalInjector = Injector.create({
      providers: [{ provide: SLIDE_IN_CONFIG, useValue: config }],
      parent: this.injector,
    });

    // Create and attach the component portal
    const portal = new ComponentPortal(SlideInPanelComponent, null, portalInjector);
    this.overlayRef.attach(portal);

    // Subscribe to backdrop click → close
    this.overlayRef.backdropClick().subscribe(() => {
      this.close(null);
    });

    // Subscribe to escape key → close
    this.overlayRef.keydownEvents().subscribe((event) => {
      if (event.key === 'Escape') {
        this.close(null);
      }
    });

    this.isOpen.set(true);

    // Return the panel ref with afterClosed observable
    const afterClosed$ = this.afterClosedSubject.asObservable().pipe(take(1));
    return { afterClosed: afterClosed$ };
  }

  /** Close the panel, optionally emitting a result. */
  close(result: SlideInResult | null): void {
    if (this.overlayRef) {
      this.overlayRef.dispose();
      this.overlayRef = null;
    }

    if (this.afterClosedSubject) {
      this.afterClosedSubject.next(result);
      this.afterClosedSubject.complete();
      this.afterClosedSubject = null;
    }

    this.isOpen.set(false);
  }
}
