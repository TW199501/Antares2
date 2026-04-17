import type { Config } from 'tailwindcss';

export default {
   darkMode: ['class', '.theme-dark'],
   content: [
      './index.html',
      './src/renderer/**/*.{vue,ts,tsx,js,jsx}'
   ],
   corePlugins: {
      preflight: false
   },
   theme: {
      container: {
         center: true,
         padding: '2rem',
         screens: { '2xl': '1400px' }
      },
      extend: {
         colors: {
            border: 'hsl(var(--border))',
            input: 'hsl(var(--input))',
            ring: 'hsl(var(--ring))',
            background: 'hsl(var(--background))',
            foreground: 'hsl(var(--foreground))',
            primary: {
               DEFAULT: 'hsl(var(--primary))',
               foreground: 'hsl(var(--primary-foreground))',
               tint: 'hsl(var(--primary-tint))'
            },
            secondary: {
               DEFAULT: 'hsl(var(--secondary))',
               foreground: 'hsl(var(--secondary-foreground))'
            },
            destructive: {
               DEFAULT: 'hsl(var(--destructive))',
               foreground: 'hsl(var(--destructive-foreground))'
            },
            muted: {
               DEFAULT: 'hsl(var(--muted))',
               foreground: 'hsl(var(--muted-foreground))'
            },
            accent: {
               DEFAULT: 'hsl(var(--accent))',
               foreground: 'hsl(var(--accent-foreground))'
            },
            popover: {
               DEFAULT: 'hsl(var(--popover))',
               foreground: 'hsl(var(--popover-foreground))'
            },
            card: {
               DEFAULT: 'hsl(var(--card))',
               foreground: 'hsl(var(--card-foreground))'
            },
            info: {
               DEFAULT: 'hsl(var(--info-bg))',
               foreground: 'hsl(var(--info-fg))'
            },
            success: {
               DEFAULT: 'hsl(var(--success-bg))',
               foreground: 'hsl(var(--success-fg))'
            },
            warning: {
               DEFAULT: 'hsl(var(--warning-bg))',
               foreground: 'hsl(var(--warning-fg))'
            }
         },
         borderRadius: {
            sm: 'var(--radius-sm)',
            md: 'var(--radius-md)',
            lg: 'var(--radius-lg)',
            pill: 'var(--radius-pill)'
         },
         fontFamily: {
            mono: ['var(--font-primary)'],
            sans: ['var(--font-secondary)']
         },
         keyframes: {
            'accordion-down': {
               from: { height: '0' },
               to: { height: 'var(--reka-accordion-content-height)' }
            },
            'accordion-up': {
               from: { height: 'var(--reka-accordion-content-height)' },
               to: { height: '0' }
            }
         },
         animation: {
            'accordion-down': 'accordion-down 0.2s ease-out',
            'accordion-up': 'accordion-up 0.2s ease-out'
         }
      }
   },
   plugins: [require('tailwindcss-animate')]
} satisfies Config;
