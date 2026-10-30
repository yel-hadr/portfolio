/**
 * The cursor spotlight's layer inside a card (styles in index.css, position from useSpotlight).
 * The card needs data-spotlight (the timeline's cards are matched by their class instead) and a
 * position; the layer is decorative.
 */
const Spotlight = () => <span aria-hidden='true' className='spotlight' />;

export default Spotlight;
