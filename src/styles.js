// Shared layout and type presets. Headings take the fluid sizes (text-display, text-h2, text-h3)
// and the rest Tailwind's default scale; colors come from the tokens in the @theme of
// src/index.css. Avoid arbitrary px values in components.
const styles = {
  // The content column; the navbar's column (navColumn) is the same less the pill's inner edge:
  // change them together
  container: 'max-w-7xl 2xl:max-w-[90rem] mx-auto px-6 sm:px-10 lg:px-16',
  navColumn:
    'max-w-7xl 2xl:max-w-[90rem] mx-auto px-[calc(--spacing(6)-9px)] sm:px-[calc(--spacing(10)-9px)] lg:px-[calc(--spacing(16)-9px)]',
  section: 'py-16 sm:py-20',

  heroHeadText: 'font-black text-foreground text-display',
  heroSubText:
    'text-primary-400 font-semibold text-lg sm:text-xl lg:text-2xl leading-snug sm:leading-7 lg:leading-8 max-w-2xl',

  // The small uppercase label over a section heading
  eyebrow: 'text-eyebrow font-semibold uppercase text-metal',
  sectionHeadText: 'font-black text-foreground text-h2',
  sectionLead:
    'mt-4 text-foreground-muted text-base sm:text-lg leading-relaxed sm:leading-7 max-w-prose',

  cardTitle: 'text-foreground text-h3 font-bold',
  card: 'card-glass p-6 sm:p-8',

  // Primary: dark text on the dark theme's orange (6.9:1), white on the light theme's (5.2:1), with
  // a lit top edge on dark
  // (--shadow-button). Ghost: glass with a strong border (>= 3:1, a control boundary, so it
  // stays opaque grey rather than a faint white hairline). Both ease their colors over 200 ms
  buttonPrimary:
    'inline-flex items-center justify-center rounded-xl border-2 border-transparent bg-primary px-7 py-[0.625rem] font-bold text-on-primary shadow-(--shadow-button) transition-[color,background-color,border-color,box-shadow] duration-200 hover:bg-primary-hover',
  buttonGhost:
    'inline-flex items-center justify-center rounded-xl border border-line-strong bg-glass px-7 py-3 font-semibold text-foreground backdrop-blur-md transition-colors duration-200 hover:border-foreground-muted',
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

// A tag's color: one brand accent, the first tag (the project's or post's lead technology) in
// orange and the rest in slate, so tags never borrow the status colors (red read as an error)
export const tagColor = (index) => (index === 0 ? 'text-primary-400' : 'text-foreground-muted');
