// Shared layout and type presets. Sizes come from Tailwind's default scale, colors from the
// tokens in tailwind.config.js; avoid arbitrary px values in components.
const styles = {
  container: 'max-w-7xl mx-auto px-6 sm:px-10 lg:px-16',
  section: 'py-20 sm:py-28',

  heroHeadText:
    'font-black text-foreground text-5xl sm:text-6xl xl:text-7xl leading-[1.05] tracking-tight',
  heroSubText:
    'text-primary-400 font-semibold text-lg sm:text-xl lg:text-2xl leading-snug max-w-2xl',

  sectionHeadText:
    'font-black text-foreground text-4xl sm:text-5xl lg:text-6xl leading-tight tracking-tight',
  sectionLead: 'mt-4 text-foreground-muted text-base sm:text-lg leading-relaxed max-w-prose',

  cardTitle: 'text-foreground text-xl font-bold',
  card: 'card-glass p-6 sm:p-8',

  // Primary: dark text on orange (6.8:1). Ghost: glass with a strong border (>= 3:1).
  buttonPrimary:
    'inline-flex items-center rounded-xl bg-primary px-7 py-3 font-bold text-background transition-colors hover:bg-primary-400',
  buttonGhost:
    'inline-flex items-center rounded-xl border border-line-strong bg-glass px-7 py-3 font-semibold text-foreground backdrop-blur-md transition-colors hover:border-foreground-muted',
  body: 'text-foreground-muted text-base leading-relaxed',
};

export { styles };
