/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      /* --- Colors: reference CSS tokens --- */
      colors: {
        primary: {
          DEFAULT:  'var(--color-primary)',
          hover:    'var(--color-primary-hover)',
          active:   'var(--color-primary-active)',
          fg:       'var(--color-primary-fg)',
          soft:     'var(--color-primary-soft)',
          text:     'var(--color-primary-text)',
        },
        secondary: {
          DEFAULT:  'var(--color-secondary)',
          hover:    'var(--color-secondary-hover)',
          fg:       'var(--color-secondary-fg)',
          soft:     'var(--color-secondary-soft)',
          text:     'var(--color-secondary-text)',
        },
        accent: {
          DEFAULT:  'var(--color-accent)',
          hover:    'var(--color-accent-hover)',
          fg:       'var(--color-accent-fg)',
          soft:     'var(--color-accent-soft)',
          text:     'var(--color-accent-text)',
        },
        success: {
          DEFAULT:  'var(--color-success)',
          soft:     'var(--color-success-soft)',
          text:     'var(--color-success-text)',
        },
        warning: {
          DEFAULT:  'var(--color-warning)',
          soft:     'var(--color-warning-soft)',
          text:     'var(--color-warning-text)',
        },
        danger: {
          DEFAULT:  'var(--color-danger)',
          soft:     'var(--color-danger-soft)',
          text:     'var(--color-danger-text)',
        },
        info: {
          DEFAULT:  'var(--color-info)',
          soft:     'var(--color-info-soft)',
          text:     'var(--color-info-text)',
        },
        surface: {
          DEFAULT:  'var(--color-surface)',
          hover:    'var(--color-surface-hover)',
          active:   'var(--color-surface-active)',
          raised:   'var(--color-surface-raised)',
        },
        sidebar: {
          DEFAULT:        'var(--color-sidebar-bg)',
          'active-bg':    'var(--color-sidebar-active-bg)',
          'active-text':  'var(--color-sidebar-active-text)',
          'hover-bg':     'var(--color-sidebar-hover-bg)',
          'active-border':'var(--color-sidebar-active-border)',
          'group-label':  'var(--color-sidebar-group-label)',
        },
        bg: {
          DEFAULT:    'var(--color-bg)',
          secondary:  'var(--color-bg-secondary)',
        },
        text: {
          DEFAULT:    'var(--color-text)',
          secondary:  'var(--color-text-secondary)',
          muted:      'var(--color-text-muted)',
          link:       'var(--color-text-link)',
        },
        border: {
          DEFAULT:  'var(--color-border)',
          strong:   'var(--color-border-strong)',
          subtle:   'var(--color-border-subtle)',
          focus:    'var(--color-border-focus)',
        },
      },

      /* --- Font --- */
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      fontSize: {
        'xs':   ['0.75rem',    { lineHeight: '1rem' }],
        'sm':   ['0.8125rem',  { lineHeight: '1.125rem' }],
        'base': ['0.875rem',   { lineHeight: '1.25rem' }],
        'md':   ['1rem',       { lineHeight: '1.5rem' }],
        'lg':   ['1.125rem',   { lineHeight: '1.75rem' }],
        'xl':   ['1.25rem',    { lineHeight: '1.75rem' }],
        '2xl':  ['1.5rem',     { lineHeight: '2rem' }],
        '3xl':  ['1.875rem',   { lineHeight: '2.25rem' }],
      },

      /* --- Spacing: 4px base scale --- */
      spacing: {
        '0.5': '2px',
        '1':   '4px',
        '1.5': '6px',
        '2':   '8px',
        '3':   '12px',
        '4':   '16px',
        '5':   '20px',
        '6':   '24px',
        '8':   '32px',
        '10':  '40px',
        '12':  '48px',
        '16':  '64px',
        '20':  '80px',
      },

      /* --- Border Radius --- */
      borderRadius: {
        'none': '0',
        'sm':   '4px',
        'md':   '8px',
        'lg':   '12px',
        'xl':   '16px',
        'full': '9999px',
      },

      /* --- Shadows --- */
      boxShadow: {
        'xs':    'var(--shadow-xs)',
        'sm':    'var(--shadow-sm)',
        'md':    'var(--shadow-md)',
        'lg':    'var(--shadow-lg)',
        'xl':    'var(--shadow-xl)',
        'focus': 'var(--shadow-focus)',
      },

      /* --- Motion --- */
      transitionDuration: {
        'fast':   '100ms',
        'normal': '200ms',
        'slow':   '300ms',
        'slower': '500ms',
      },
      transitionTimingFunction: {
        'default': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'in':      'cubic-bezier(0.4, 0, 1, 1)',
        'out':     'cubic-bezier(0, 0, 0.2, 1)',
        'spring':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      /* --- Z-Index --- */
      zIndex: {
        'dropdown': '1000',
        'sticky':   '1020',
        'fixed':    '1030',
        'overlay':  '1040',
        'modal':    '1050',
        'popover':  '1060',
        'tooltip':  '1070',
        'toast':    '1080',
      },

      /* --- Container --- */
      maxWidth: {
        'container': '1280px',
      },
    },
  },
  plugins: [],
};
