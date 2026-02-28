function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * Returns true if the hint shares a forbidden prefix with the target word.
 * A hint is invalid when:
 *   - The first min(3, hint.length, target.length) characters match, OR
 *   - One word is a prefix of the other
 */
export function sharesPrefix(hint: string, target: string): boolean {
  const h = normalize(hint);
  const t = normalize(target);
  const len = Math.min(h.length, t.length, 3);
  if (len === 0) return false;
  return h.slice(0, len) === t.slice(0, len);
}
