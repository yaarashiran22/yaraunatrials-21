import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'system': ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Helvetica Neue"', 'Roboto', '"Segoe UI"', 'Arial', 'sans-serif'],
				'app': ['system-ui', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'Roboto', 'sans-serif'],
				'display': ['"SF Pro Display"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
				'lxgw': ['LXGW WenKai TC', 'sans-serif'],
				'nunito': ['Nunito', 'sans-serif'],
				'playfair': ['Playfair Display', 'serif'],
			},
			fontSize: {
				// Mobile-first app-like font sizes
				'xs': ['0.75rem', { lineHeight: '1.2', fontWeight: '400' }],
				'sm': ['0.875rem', { lineHeight: '1.3', fontWeight: '400' }],
				'base': ['1rem', { lineHeight: '1.4', fontWeight: '400' }],
				'lg': ['1.125rem', { lineHeight: '1.4', fontWeight: '500' }],
				'xl': ['1.25rem', { lineHeight: '1.4', fontWeight: '600' }],
				'2xl': ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
				'3xl': ['1.75rem', { lineHeight: '1.2', fontWeight: '700' }],
				// App-specific sizes
				'app-caption': ['0.75rem', { lineHeight: '1.2', fontWeight: '400' }],
				'app-body': ['1rem', { lineHeight: '1.4', fontWeight: '400' }],
				'app-subheading': ['0.875rem', { lineHeight: '1.3', fontWeight: '600' }],
				'app-heading': ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
				'app-title': ['1.25rem', { lineHeight: '1.3', fontWeight: '700' }],
				'app-large-title': ['1.75rem', { lineHeight: '1.2', fontWeight: '700' }],
			},
			spacing: {
				'content-tight': 'var(--content-tight)',
				'content-normal': 'var(--content-normal)',
				'content-loose': 'var(--content-loose)',
				'content-spacious': 'var(--content-spacious)',
			},
			minHeight: {
				'touch': 'var(--touch-md)',
				'touch-sm': 'var(--touch-sm)',
				'touch-lg': 'var(--touch-lg)',
				'touch-xl': 'var(--touch-xl)',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				// Primary: Jacarandá Purple - Full Scale
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					900: 'hsl(var(--primary-900))',
					800: 'hsl(var(--primary-800))',
					700: 'hsl(var(--primary-700))',
					600: 'hsl(var(--primary-600))',
					500: 'hsl(var(--primary-500))',
					400: 'hsl(var(--primary-400))',
					300: 'hsl(var(--primary-300))',
					200: 'hsl(var(--primary-200))',
					100: 'hsl(var(--primary-100))',
				},
				// Secondary: Mint Green - Full Scale
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					900: 'hsl(var(--secondary-900))',
					800: 'hsl(var(--secondary-800))',
					700: 'hsl(var(--secondary-700))',
					600: 'hsl(var(--secondary-600))',
					500: 'hsl(var(--secondary-500))',
					400: 'hsl(var(--secondary-400))',
					300: 'hsl(var(--secondary-300))',
					200: 'hsl(var(--secondary-200))',
					100: 'hsl(var(--secondary-100))',
				},
				// Accent: Coupon Yellow - Full Scale
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					700: 'hsl(var(--accent-700))',
					600: 'hsl(var(--accent-600))',
					500: 'hsl(var(--accent-500))',
					400: 'hsl(var(--accent-400))',
					300: 'hsl(var(--accent-300))',
				},
				// System Colors
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				// Coral Orange
				coral: {
					DEFAULT: 'hsl(var(--coral))',
					foreground: 'hsl(var(--coral-foreground))',
					hover: 'hsl(var(--coral-hover))'
				},
				// Mustard Yellow
				mustard: {
					DEFAULT: 'hsl(var(--mustard))',
					foreground: 'hsl(var(--mustard-foreground))',
					hover: 'hsl(var(--mustard-hover))'
				},
				// Electric Pink Purple
				'electric-pink': {
					DEFAULT: 'hsl(var(--electric-pink))',
					foreground: 'hsl(var(--electric-pink-foreground))',
					hover: 'hsl(var(--electric-pink-hover))'
				},
				// Neutrals - Una Complete Scale
				neutral: {
					900: 'hsl(var(--neutral-900))',
					800: 'hsl(var(--neutral-800))',
					700: 'hsl(var(--neutral-700))',
					600: 'hsl(var(--neutral-600))',
					500: 'hsl(var(--neutral-500))',
					400: 'hsl(var(--neutral-400))',
					300: 'hsl(var(--neutral-300))',
					200: 'hsl(var(--neutral-200))',
					100: 'hsl(var(--neutral-100))',
				},
				// Semantic aliases
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
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
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'pulse-glow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.5' }
				},
				'slide-up': {
					'0%': { transform: 'translateY(100%)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'slide-down': {
					'0%': { transform: 'translateY(-100%)', opacity: '0' },
					'100%': { transform: 'translateY(0)', opacity: '1' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'bounce-subtle': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-5px)' }
				},
				'shimmer': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'float': 'float 6s ease-in-out infinite',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'slide-up': 'slide-up 0.3s ease-out',
				'slide-down': 'slide-down 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
				'shimmer': 'shimmer 2s linear infinite'
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
				'gradient-mesh': 'linear-gradient(135deg, var(--tw-gradient-stops))'
			},
			transformStyle: {
				'preserve-3d': 'preserve-3d'
			},
			perspective: {
				'1000': '1000px',
				'2000': '2000px'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
