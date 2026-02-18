import {
  Component,
  ChangeDetectionStrategy,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  FormControl,
} from '@angular/forms';
import { QuillModule, QuillModules } from 'ngx-quill';

/**
 * Reusable rich text editor component wrapping ngx-quill's quill-editor.
 * Implements ControlValueAccessor so it can be used with formControlName or [formControl].
 *
 * Provides a standard toolbar: bold, italic, underline, strike | lists | headers | link | clean.
 * Configurable placeholder and height via inputs.
 */
@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [ReactiveFormsModule, QuillModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  styles: `
    :host {
      display: block;
    }

    .editor-container {
      border: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      overflow: hidden;
    }

    .editor-container:focus-within {
      border-color: var(--mat-sys-primary, #1976d2);
      border-width: 2px;
    }

    :host ::ng-deep .ql-toolbar {
      border: none !important;
      border-bottom: 1px solid var(--mat-sys-outline-variant, rgba(0, 0, 0, 0.12)) !important;
    }

    :host ::ng-deep .ql-container {
      border: none !important;
      font-family: inherit;
      font-size: 14px;
    }
  `,
  template: `
    <div class="editor-container">
      <quill-editor
        [formControl]="control"
        [styles]="{ height: height() }"
        [modules]="quillModules"
        [placeholder]="placeholder()"
        theme="snow"
      ></quill-editor>
    </div>
  `,
})
export class RichTextEditorComponent implements ControlValueAccessor {
  /** Placeholder text for the editor. */
  placeholder = input<string>('Write something...');

  /** Height of the editor area. */
  height = input<string>('200px');

  /** Internal FormControl used by the quill-editor. */
  control = new FormControl('');

  /** Quill toolbar configuration. */
  quillModules: QuillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      [{ header: [1, 2, 3, false] }],
      ['link'],
      ['clean'],
    ],
  };

  // ─── ControlValueAccessor ───────────────────────────────────────────

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Propagate changes from internal control to form
    this.control.valueChanges.subscribe((value) => {
      this.onChange(value ?? '');
    });
  }

  writeValue(value: string): void {
    this.control.setValue(value ?? '', { emitEvent: false });
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.control.disable({ emitEvent: false });
    } else {
      this.control.enable({ emitEvent: false });
    }
  }
}
