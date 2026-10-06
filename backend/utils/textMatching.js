/**
 * utils/textMatching.js
 * Shared text normalisation and similarity heuristics.
 */

/** Canonical lookup key: lowercase, collapse whitespace */
export function toKey(name) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Conservative similarity heuristic.
 * Only merges when names are highly likely the same real-world entity.
 */
export function areSimilar(a, b) {
  const ka = toKey(a);
  const kb = toKey(b);
  if (ka === kb) return true;

  // Never fuzz-match short strings or purely numeric tokens
  if (ka.length < 8 || kb.length < 8) return false;
  if (/^\d[\d\-–\/]*$/.test(ka) || /^\d[\d\-–\/]*$/.test(kb)) return false;

  // Tokenise — keep only meaningful words (length ≥ 3, not stop words)
  const STOP = new Set(["the", "a", "an", "of", "in", "at", "by", "and", "or", "to", "for"]);
  const sig = (k) => k.split(/[\s\W]+/).filter((t) => t.length >= 3 && !STOP.has(t));
  const tA = sig(ka);
  const tB = sig(kb);

  if (tA.length === 0 || tB.length === 0) return false;

  // Must share at least 2 significant tokens
  const shared = tA.filter((t) => tB.includes(t));
  if (shared.length < 2) return false;

  // The two sets must differ by at most 1 token each direction
  const onlyInA = tA.filter((t) => !tB.includes(t));
  const onlyInB = tB.filter((t) => !tA.includes(t));
  return onlyInA.length <= 1 && onlyInB.length <= 1;
}

/**
 * Checks if a search term is contained within a target string (fuzzy).
 * Useful for querying (e.g. "web" matching "World Wide Web").
 */
export function isContainedIn(searchTerm, targetString) {
    const termKey = toKey(searchTerm);
    const targetKey = toKey(targetString);
    
    if (termKey === targetKey) return true;
    if (targetKey.includes(termKey)) return true;
    
    // Check if significant tokens of term are all in target
    const STOP = new Set(["the", "a", "an", "of", "in", "at", "by", "and", "or", "to", "for", "what", "who", "when", "where", "how", "why"]);
    const sig = (k) => k.split(/[\s\W]+/).filter((t) => t.length >= 3 && !STOP.has(t));
    
    const termTokens = sig(termKey);
    const targetTokens = sig(targetKey);
    
    if (termTokens.length > 0 && termTokens.every(t => targetTokens.includes(t))) {
        return true;
    }
    
    return false;
}
