// ============================================================
// FILE: src/services/fuzzyMatch.js
// PURPOSE: ReDoS-safe fuzzy matching using Levenshtein + Soundex
// OWASP: A03 — No regex constructed from user input
// ============================================================

// ── Soundex Algorithm ──────────────────────────────────────
function soundex(str) {
  if (!str || typeof str !== "string") return "";
  const s = str.toUpperCase().replace(/[^A-Z]/g, "");
  if (!s.length) return "";
  const map = { B:1,F:1,P:1,V:1, C:2,G:2,J:2,K:2,Q:2,S:2,X:2,Z:2, D:3,T:3, L:4, M:5,N:5, R:6 };
  let code = s[0];
  let prev = map[s[0]] || 0;
  for (let i = 1; i < s.length && code.length < 4; i++) {
    const curr = map[s[i]] || 0;
    if (curr && curr !== prev) { code += curr; }
    prev = curr;
  }
  return code.padEnd(4, "0");
}

// ── Levenshtein Distance ───────────────────────────────────
function levenshtein(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

// ── Safe Fuzzy Match ───────────────────────────────────────
// Returns array of matching _id strings
// Max edit distance: 3 for names > 5 chars, 2 for shorter
function safeFuzzyMatch(query, medicines) {
  if (!query || typeof query !== "string") return [];
  if (!Array.isArray(medicines) || medicines.length === 0) return [];

  const q = query.toLowerCase().trim().substring(0, 100);
  const qSoundex = soundex(q);
  const maxDist = q.length > 5 ? 3 : 2;
  const matches = [];

  for (const med of medicines) {
    const name = (med.name || "").toLowerCase();
    const generic = (med.genericName || "").toLowerCase();

    // Check Levenshtein distance
    const distName    = levenshtein(q, name);
    const distGeneric = levenshtein(q, generic);

    // Check Soundex match
    const soundexMatch = soundex(name) === qSoundex || soundex(generic) === qSoundex;

    // Check if query is substring of name
    const substringMatch = name.includes(q) || generic.includes(q);

    if (distName <= maxDist || distGeneric <= maxDist || soundexMatch || substringMatch) {
      matches.push({
        id: med._id,
        score: Math.min(distName, distGeneric),
        soundex: soundexMatch,
      });
    }
  }

  // Sort by score (lower = better match), soundex matches first
  matches.sort((a, b) => {
    if (a.soundex && !b.soundex) return -1;
    if (!a.soundex && b.soundex) return 1;
    return a.score - b.score;
  });

  return matches.map(m => m.id);
}

module.exports = { safeFuzzyMatch, levenshtein, soundex };