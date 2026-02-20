import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'renderMentions',
  standalone: true,
})
export class RenderMentionsPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(content: string): SafeHtml {
    if (!content) return content;

    // Escape HTML first to prevent XSS
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Replace @[Name](Type:id) with styled spans
    const rendered = escaped.replace(
      /@\[([^\]]+)\]\((\w+):([a-f0-9\-]+)\)/g,
      (_, name, type, id) => {
        const cssClass = type === 'User' ? 'mention-chip mention-user' : 'mention-chip mention-entity';
        return `<span class="${cssClass}" data-entity-type="${type}" data-entity-id="${id}">@${name}</span>`;
      }
    );

    return this.sanitizer.bypassSecurityTrustHtml(rendered);
  }
}
