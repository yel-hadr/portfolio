/**
 * Custom Umami event. The tracker script is only on the page when the build set
 * VITE_UMAMI_WEBSITE_ID (see build/seo.js), and blockers or a slow network can keep it from
 * loading, so this is a no-op whenever `window.umami` is missing. Analytics must never break
 * the page, so errors are swallowed too.
 */
export const track = (event, data) => {
  try {
    if (data === undefined) window.umami?.track?.(event);
    else window.umami?.track?.(event, data);
  } catch {
    // Ignored on purpose (see above)
  }
};
