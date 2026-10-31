/**
 * A project tag's label: product names (`name`) as written, techniques (`id`) from the locale,
 * `works.tags.<id>`, since French names them differently
 */
export const tagName = (t, tag) => (tag.id ? t(`works.tags.${tag.id}`) : tag.name);
