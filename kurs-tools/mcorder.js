// Feste, gemischte Reihenfolge der Antworten einer Auswahlfrage (aus dem Schritt-Schlüssel).
// Dieselbe Funktion steht im Kurs (kurs/index.html, mcOrder), damit Bildschirm und Aufnahme übereinstimmen.
'use strict';
function seedOf(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function order(s) {
  const n = (s.options || []).length, o = [...Array(n).keys()], r = rng(seedOf(String(s.key || s.title || '')));
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
module.exports = { order, seedOf, rng };
