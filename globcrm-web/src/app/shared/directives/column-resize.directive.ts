import {
  Directive,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  output,
  input,
} from '@angular/core';

export interface ColumnResizeEvent {
  fieldId: string;
  newWidth: number;
}

/**
 * Directive that enables column resizing by dragging the right edge of header cells.
 * Emits a columnResized event with the fieldId and new width when dragging ends.
 *
 * Usage: <th appColumnResize [fieldId]="column.fieldId">
 */
@Directive({
  selector: '[appColumnResize]',
  standalone: true,
  host: {
    'class': 'column-resizable',
  },
})
export class ColumnResizeDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  fieldId = input.required<string>();
  columnResized = output<ColumnResizeEvent>();

  private resizeHandle!: HTMLDivElement;
  private startX = 0;
  private startWidth = 0;
  private isResizing = false;

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (!this.isResizing) return;
    const delta = e.clientX - this.startX;
    const newWidth = Math.max(50, this.startWidth + delta);
    this.el.nativeElement.style.width = `${newWidth}px`;
    this.el.nativeElement.style.minWidth = `${newWidth}px`;
  };

  private readonly onMouseUp = (): void => {
    if (!this.isResizing) return;
    this.isResizing = false;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    const newWidth = this.el.nativeElement.offsetWidth;
    this.columnResized.emit({ fieldId: this.fieldId(), newWidth });
  };

  ngOnInit(): void {
    this.resizeHandle = document.createElement('div');
    this.resizeHandle.classList.add('column-resize-handle');
    this.el.nativeElement.style.position = 'relative';
    this.el.nativeElement.appendChild(this.resizeHandle);

    this.resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.isResizing = true;
      this.startX = e.clientX;
      this.startWidth = this.el.nativeElement.offsetWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
    });
  }

  ngOnDestroy(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }
}
