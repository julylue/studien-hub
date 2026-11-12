// Wandelt einen Kursschritt (HTML) in einen gut vorlesbaren Sprechtext um.
// Enthält keine Kursinhalte, nur Regeln. Genutzt von build-voice.js.
'use strict';

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&shy;': '' };
const dec = s => s.replace(/&[a-z#0-9]+;/gi, m => (m in ENT ? ENT[m] : ' '));
const DIG = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun'];

// R-Code (Inline) in Sprache
function codeSay(c) {
  c = dec(c).trim();
  if (!c) return '';
  if (c.length > 70) return '';
  c = c.replace(/#.*$/, '');
  c = c.replace(/\(\s*\)/g, '');                       // median() -> median
  c = c.replace(/<-/g, ' Zuweisungspfeil ');
  c = c.replace(/%in%/g, ' in ').replace(/%%/g, ' modulo ');
  c = c.replace(/==/g, ' ist gleich ').replace(/!=/g, ' ungleich ').replace(/>=/g, ' größer gleich ').replace(/<=/g, ' kleiner gleich ');
  c = c.replace(/\$/g, ' Dollar ');
  c = c.replace(/(\d+):(\d+)/g, '$1 bis $2');
  c = c.replace(/(\d)\.(\d)/g, '$1 Punkt $2');
  c = c.replace(/([A-Za-z])\.([A-Za-z])/g, '$1 Punkt $2').replace(/([A-Za-z])\.([A-Za-z])/g, '$1 Punkt $2');
  c = c.replace(/_/g, ' Unterstrich ');
  c = c.replace(/~/g, ' Tilde ');
  c = c.replace(/\bNA\b/g, 'N A').replace(/\bNULL\b/g, 'Null');
  c = c.replace(/=/g, ' gleich ').replace(/</g, ' kleiner als ').replace(/>/g, ' größer als ');
  c = c.replace(/\^/g, ' hoch ').replace(/\*/g, ' mal ');
  c = c.replace(/\[/g, ' eckige Klammer ').replace(/\]/g, ' ');
  c = c.replace(/[(){}]/g, ' ').replace(/"/g, '').replace(/'/g, '');
  return ' ' + c.replace(/\s+/g, ' ').trim() + ' ';
}

// Mathematik und Abkürzungen im Fließtext
function mathSay(t) {
  t = t.replace(/(\d)\.(\d)/g, '$1,$2');
  t = t.replace(/\*innen/g, 'innen').replace(/\*in\b/g, 'in');
  t = t.replace(/([A-Za-zμσ])̄/g, '$1 quer ').replace(/ȳ/g, 'y quer ').replace(/x̄/g, 'x quer ');
  t = t.replace(/ŷ/g, 'y Dach ').replace(/ẑ/g, 'z Dach ');
  t = t.replace(/²/g, ' Quadrat ').replace(/³/g, ' hoch drei ');
  t = t.replace(/₂/g, ' 2').replace(/₅/g, ' 5');
  t = t.replace(/Σ\s*\(Sigma\)/g, 'Sigma').replace(/Σ/g, ' Summe ').replace(/√/g, ' Wurzel aus ');
  t = t.replace(/\s*[·×]\s*(?=[\d(]|[a-zA-Z](?![a-zA-ZäöüÄÖÜß])(?!\s*\d))/g, ' mal ').replace(/\s*·\s*/g, '. ').replace(/×/g, ' mal ').replace(/−/g, ' minus ').replace(/±/g, ' plus minus ');
  t = t.replace(/≈/g, ' ungefähr ').replace(/≠/g, ' ungleich ').replace(/≤/g, ' kleiner gleich ').replace(/≥/g, ' größer gleich ');
  t = t.replace(/→/g, ', dann ').replace(/↔/g, ' entspricht ').replace(/≻/g, ' wird vorgezogen vor ');
  t = t.replace(/…/g, ' und so weiter ').replace(/–/g, ' bis ');
  t = t.replace(/β/g, ' beta ').replace(/ρ/g, ' rho ').replace(/τ/g, ' tau ').replace(/φ/g, ' phi ').replace(/δ/g, ' delta ').replace(/σ/g, ' sigma ').replace(/χ/g, ' chi ').replace(/μ/g, ' mü ').replace(/α/g, ' alpha ');
  t = t.replace(/°/g, ' Grad ').replace(/ℹ/g, '');
  // Bruchstrich zwischen Rechengrößen, sonst "oder"
  t = t.replace(/(\S+)\s*\/\s*(\S+)/g, (m, a, b) => {
    const L = /^([\d.,]+|.*\)|[a-zA-Z]{1,2}|\d+[a-zA-Z])$/.test(a.replace(/^[(\[]+/, '')), R = /^([\d(]|[a-zA-Z]{1,2}(\b|$)|\d+[a-zA-Z])/.test(b);
    return a + (L && R ? ' geteilt durch ' : ' oder ') + b;
  });
  t = t.replace(/\s\/\s/g, ' oder ');
  t = t.replace(/\s-\s(?=\d)/g, ' minus ');
  t = t.replace(/(^|\s)\+(?=\d)/g, '$1plus ').replace(/(\d|\b[a-zA-Z]|\))\s*\+\s*/g, '$1 plus ').replace(/\s\+\s/g, ' plus ');
  t = t.replace(/\s=\s|(?<=\w)=(?=\w)/g, ' gleich ').replace(/=/g, ' gleich ');
  t = t.replace(/\s<\s/g, ' kleiner als ').replace(/\s>\s/g, ' größer als ').replace(/</g, ' kleiner als ').replace(/>/g, ' größer als ');
  t = t.replace(/\^/g, ' hoch ').replace(/\s\*\s/g, ' mal ').replace(/\|/g, ', ').replace(/~/g, ' ungefähr ');
  t = t.replace(/(\d)\s*%/g, '$1 Prozent').replace(/%/g, ' Prozent');
  t = t.replace(/\bz\.\s?B\./g, 'zum Beispiel').replace(/\bd\.\s?h\./g, 'das heißt').replace(/\bu\.\s?a\./g, 'unter anderem')
    .replace(/\bbzw\./g, 'beziehungsweise').replace(/\bca\./g, 'circa').replace(/\bvs\./g, 'versus').replace(/\bggf\./g, 'gegebenenfalls')
    .replace(/\busw\./g, 'und so weiter').replace(/\bAbb\./g, 'Abbildung').replace(/\bKap\./g, 'Kapitel').replace(/\bS\.\s(?=\d)/g, 'Seite ')
    .replace(/\bNr\./g, 'Nummer').replace(/\bMin\./g, 'Minuten').replace(/\bStd\./g, 'Stunden').replace(/\bsog\./g, 'sogenannte')
    .replace(/\bi\.\s?d\.\s?R\./g, 'in der Regel').replace(/\bo\.\s?Ä\./g, 'oder Ähnliches');
  t = t.replace(/[\[\]{}#\\_]/g, ' ').replace(/\*/g, ' ');
  return t;
}

function tableSay(html) {
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(r => [...r[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(c => inline(c[1]).trim()));
  const cells = rows.reduce((a, r) => a + r.length, 0);
  if (!rows.length) return '';
  if (cells > 40) return ' Die Tabelle dazu steht auf dem Bildschirm. ';
  return ' ' + rows.map(r => {
    const f = r.filter(Boolean); if (!f.length) return '';
    return f.length === 2 ? f[0] + ': ' + f[1] + '.' : f[0] + ': ' + f.slice(1).join(', ') + '.';
  }).join(' ') + ' ';
}

// Inline-HTML (ohne Blöcke) zu Text
function inline(h) {
  h = h.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (m, c) => codeSay(c.replace(/<[^>]+>/g, '')));
  h = h.replace(/<sub>([\s\S]*?)<\/sub>/g, (m, c) => { c = c.replace(/<[^>]+>/g, '').trim(); return ' ' + (/^[0-9a-z]{2,3}$/.test(c) ? [...c].join(' ') : c) + ' '; });
  h = h.replace(/<sup>([\s\S]*?)<\/sup>/g, (m, c) => { c = c.replace(/<[^>]+>/g, '').trim(); return c === '2' ? ' Quadrat ' : ' hoch ' + c + ' '; });
  h = h.replace(/<br\s*\/?>/g, ' ');
  h = h.replace(/<span>([\s\S]*?)<\/span>/g, (m, c) => /[()$]/.test(c) ? codeSay(c) : c);
  h = h.replace(/<[^>]+>/g, '');
  return mathSay(dec(h));
}

function blockSay(h) {
  if (!h) return '';
  h = String(h);
  h = h.replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<pre[\s\S]*?<\/pre>/g, ' ');
  h = h.replace(/<div class="ex"[^>]*>\s*<\/div>/g, ' ').replace(/<div class="ex"[\s\S]*?<\/div>/g, ' ');
  h = h.replace(/<div class="charts"[\s\S]*?<\/div>/g, ' ');
  h = h.replace(/<div class="data"[^>]*>([\s\S]*?)<\/div>/g, (m, c) => { const s = codeSay(c.replace(/<[^>]+>/g, '')); return s ? ' ' + s + '. ' : ' '; });
  h = h.replace(/<table[\s\S]*?<\/table>/g, m => tableSay(m));
  h = h.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/g, (m, c) => ' ' + end(inline(c)) + ' ');
  h = h.replace(/<li[^>]*>([\s\S]*?)<\/li>/g, (m, c) => ' ' + end(inline(c)) + ' ');
  h = h.replace(/<(p|div)[^>]*>([\s\S]*?)<\/\1>/g, (m, tag, c) => ' ' + end(inline(c)) + ' ');
  return clean(inline(h));
}
function end(s) { s = clean(s); if (!s) return ''; return /[.!?:]$/.test(s) ? s : s + '.'; }
function clean(s) {
  return String(s).replace(/\s+([.,:;!?])/g, '$1').replace(/([.,:;!?])(?=[^\s.,:;!?)"“”0-9])/g, '$1 ').replace(/(\D)([.,:;!?])(?=\d)/g, '$1$2 ').replace(/(\d)\s+(?=\d)/g, '$1, ').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
    .replace(/\(\s*\)/g, '').replace(/\.{2,}/g, '.').replace(/,\s*\./g, '.').replace(/:\s*\./g, '.').replace(/\s+/g, ' ').trim();
}

// Sprechtext für einen ganzen Schritt; '' wenn nichts vorzulesen ist
function stepSay(s) {
  if (!s || s.type === 'video') return '';
  const parts = [];
  parts.push(end(inline(s.title || '')));
  parts.push(blockSay(s.body));
  if (s.task) parts.push('Deine Aufgabe: ' + blockSay(s.task));
  if (s.type === 'calc' && s.fields) parts.push('Gesucht: ' + s.fields.map(f => clean(inline(f.label))).join(', ') + '.');
  if (s.type === 'mc' && s.options) parts.push(s.options.map((o, k) => 'Antwort ' + (k + 1) + ': ' + end(inline(o.t))).join(' '));
  if (s.type === 'rf' && s.statements) parts.push(s.statements.map((a, k) => 'Aussage ' + 'ABCDE'[k] + ': ' + end(inline(a.t))).join(' '));
  return clean(parts.filter(Boolean).join(' '));
}

module.exports = { stepSay, codeSay, mathSay };
