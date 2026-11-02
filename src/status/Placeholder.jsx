// Cards that hold a section's place while the status data loads, the size of the cards that
// replace them, so the page does not jump when it arrives (it shifted by 0.34 without them).
// Decorative: the sections' headings and the page's busy state say that it is loading
export const CardPlaceholders = ({ count, className, height }) => (
  <ul aria-hidden='true' className={className}>
    {Array.from({ length: count }, (_, i) => (
      <li key={i} className={`card-glass ${height} motion-safe:animate-pulse`} />
    ))}
  </ul>
);
