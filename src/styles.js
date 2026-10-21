// Shared layout and type presets. Sizes come from Tailwind's default scale, colors from the
// tokens in tailwind.config.js; avoid arbitrary px values in components.
const styles = {
  container: 'max-w-7xl mx-auto px-6 sm:px-10 lg:px-16',
  section: 'py-20 sm:py-28',

  heroHeadText:
    'font-black text-foreground text-5xl xs:text-6xl sm:text-7xl lg:text-8xl leading-none tracking-tight',
  heroSubText: 'text-foreground-muted text-lg sm:text-xl lg:text-2xl leading-relaxed max-w-2xl',

  sectionHeadText:
    'font-black text-foreground text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight',
  sectionLead: 'mt-4 text-foreground-muted text-base sm:text-lg leading-relaxed max-w-prose',

  cardTitle: 'text-foreground text-xl font-bold',
  body: 'text-foreground-muted text-base leading-relaxed',
};

export { styles };
