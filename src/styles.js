// Shared layout and type presets. Sizes come from Tailwind's default scale, colors from the
// tokens in the @theme of src/index.css; avoid arbitrary px values in components.
const styles = {
  container: 'max-w-7xl mx-auto px-6 sm:px-10 lg:px-16',
  section: 'py-20 sm:py-28',

  heroHeadText:
    'font-black text-foreground text-5xl sm:text-6xl xl:text-7xl leading-[1.05] sm:leading-none xl:leading-none tracking-tight',
  heroSubText:
    'text-primary-400 font-semibold text-lg sm:text-xl lg:text-2xl leading-snug sm:leading-7 lg:leading-8 max-w-2xl',

  sectionHeadText:
    'font-black text-foreground text-4xl sm:text-5xl lg:text-6xl leading-tight sm:leading-none lg:leading-none tracking-tight',
  sectionLead:
    'mt-4 text-foreground-muted text-base sm:text-lg leading-relaxed sm:leading-7 max-w-prose',

  cardTitle: 'text-foreground text-xl font-bold',
  card: 'card-glass p-6 sm:p-8',

  // Primary: dark text on orange (dark 6.8:1, light 5.0:1). Ghost: glass with a strong border (>= 3:1).
  buttonPrimary:
    'inline-flex items-center rounded-xl border-2 border-transparent bg-primary px-7 py-[0.625rem] font-bold text-on-primary transition-colors hover:bg-primary-hover',
  buttonGhost:
    'inline-flex items-center rounded-xl border border-line-strong bg-glass px-7 py-3 font-semibold text-foreground backdrop-blur-md transition-colors hover:border-foreground-muted',
  body: 'text-foreground-muted text-base leading-relaxed',
  // Focus ring of a 3D view (its wrapper has `group`): a layer above the canvas, since an inset
  // ring on the wrapper is painted under an opaque canvas. The ring sits on a band of the page
  // background, so it keeps its contrast over any scene (the cub3D floor and ceiling, FdF's night)
  viewFocusRing:
    'pointer-events-none absolute inset-0 z-50 group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-focus group-focus-visible:shadow-[inset_0_0_0_5px_rgb(var(--c-background))]',
  // HUD controls over a 3D scene: a two-tone ring that stays visible on any scene color
  hudFocus: 'focus-visible:outline-foreground focus-visible:ring-4 focus-visible:ring-background',
};

export { styles };
