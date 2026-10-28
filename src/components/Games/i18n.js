// The games strings ship with the lazy games chunk, not the page: GameMenu and PacketSnake import
// this module, which registers them before any of their components render.
import { registerNamespace } from '../../i18n/dictionaries';
import en from '../../locales/en/games.json';
import fr from '../../locales/fr/games.json';

registerNamespace('games', { en, fr });
