const v = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        panel: v('panel'),
        slot: v('slot'),
        hi: v('hi'),
        lo: v('lo'),
        ink: v('ink'),
        mute: v('mute'),
        accent: v('accent'),
        'accent-hi': v('accent-hi'),
        'accent-lo': v('accent-lo'),
        'accent-ink': v('accent-ink'),
      },
      fontFamily: {
        display: ['"Reem Kufi"', '"IBM Plex Sans Arabic"', 'sans-serif'],
        body: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0',
        sm: '0',
        md: '0',
        lg: '0',
      },
    },
  },
  plugins: [],
};
