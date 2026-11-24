/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		transitionDuration: {
  			'3000': '3000ms',
  		},
  		fontFamily: {
  			serif: ['"Zen Old Mincho"', '"Hiragino Mincho ProN"', '"Yu Mincho"', 'serif'],
  			sans: ['"Noto Sans JP"', '"Noto Sans KR"', '"Hiragino Kaku Gothic ProN"', '"Hiragino Sans"', '"Yu Gothic"', 'Meiryo', '"Apple SD Gothic Neo"', '"Malgun Gothic"', 'sans-serif'],
  		},
  		// 読みやすさのため Tailwind 既定より1段階（約1px）大きくしている
  		fontSize: {
  			xs: ['0.8125rem', { lineHeight: '1.25rem' }],
  			sm: ['0.9375rem', { lineHeight: '1.5rem' }],
  			base: ['1.0625rem', { lineHeight: '1.75rem' }],
  			lg: ['1.1875rem', { lineHeight: '1.875rem' }],
  			xl: ['1.3125rem', { lineHeight: '2rem' }],
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

