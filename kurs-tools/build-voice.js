// Baut die Sprechtexte in den verschlüsselten Kurs ein und legt die Vertonungsaufträge an.
// Aufruf: KURS_PW=... ELEVEN_KEY=sk_... node kurs-tools/build-voice.js [lesson-id ...]
//  - liest kurs/index.html, entschlüsselt window.PAYLOAD mit KURS_PW
//  - ergänzt payload.speech = {lessonId: {stepKey: text}} und payload.voice = {key, voice, model, fmt}
//  - verschlüsselt neu (neues Salz, neuer IV) und schreibt kurs/index.html zurück
//  - schreibt kurs/vo/jobs.enc: Aufträge {key, voice, model, fmt, items:[{h, t}]} in Prioritätsreihenfolge,
//    AES-GCM mit SHA-256(ELEVEN_KEY) – nur der GitHub-Workflow (Secret ELEVENLABS_API_KEY) kann sie lesen
// Argumente: Lektions-IDs in der gewünschten Reihenfolge (die übrigen folgen nach Nummer).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { stepSay } = require('./speech.js');
const { order: mcOrder } = require('./mcorder.js');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'kurs', 'index.html');
const VO = path.join(ROOT, 'kurs', 'vo');
const PW = process.env.KURS_PW, EK = process.env.ELEVEN_KEY;
if (!PW || !EK) { console.error('KURS_PW und ELEVEN_KEY setzen'); process.exit(1); }

const VOICE = { voice: 'Max', voiceId: process.env.VOICE_ID || '', model: 'eleven_flash_v2_5', fmt: 'mp3_44100_32' };

function decryptPayload(P, pw) {
  const key = crypto.pbkdf2Sync(pw, Buffer.from(P.salt, 'base64'), P.iter, 32, 'sha256');
  const d = Buffer.from(P.data, 'base64');
  const dc = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(P.iv, 'base64')); dc.setAuthTag(d.slice(-16));
  return JSON.parse(Buffer.concat([dc.update(d.slice(0, -16)), dc.final()]).toString('utf8'));
}
function encryptPayload(obj, pw, iter) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pw, salt, iter, 32, 'sha256');
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(obj), 'utf8')), c.final(), c.getAuthTag()]);
  return { salt: salt.toString('base64'), iv: iv.toString('base64'), iter, data: ct.toString('base64') };
}
const hashOf = (v, t) => crypto.createHash('sha256').update(v.voiceId + '|' + v.model + '|' + v.fmt + '|' + t).digest('hex').slice(0, 20);

let html = fs.readFileSync(HTML, 'utf8');
const m = html.match(/window\.PAYLOAD = (\{.*?\});?\n/s);
const P = JSON.parse(m[1].replace(/;$/, ''));
const obj = decryptPayload(P, PW);

const prev = obj.voice || {};
if (!VOICE.voiceId) VOICE.voiceId = prev.voiceId;
if (!VOICE.voiceId) { console.error('VOICE_ID fehlt'); process.exit(1); }
const audioKey = prev.key || crypto.randomBytes(32).toString('base64');
obj.voice = { key: audioKey, voiceId: VOICE.voiceId, voice: VOICE.voice, model: VOICE.model, fmt: VOICE.fmt };

obj.speech = {};
const items = {};
obj.lessons.forEach(l => {
  const sp = obj.speech[l.id] = {};
  l.steps.forEach(s => {
    const t = stepSay(s.type === 'mc' ? Object.assign({}, s, { options: mcOrder(s).map(k => s.options[k]) }) : s);
    if (!t) return;
    sp[s.key] = t;
    items[l.id + '|' + s.key] = t;
  });
});

// Priorität: Argumente zuerst, dann übrige Lektionen nach Nummer
const first = process.argv.slice(2);
const lessons = obj.lessons.slice().sort((a, b) => {
  const ia = first.indexOf(a.id), ib = first.indexOf(b.id);
  return (ia < 0 ? 99 + a.nr : ia) - (ib < 0 ? 99 + b.nr : ib);
});
const jobs = [], seen = new Set();
lessons.forEach(l => l.steps.forEach(s => {
  const t = obj.speech[l.id][s.key]; if (!t) return;
  const h = hashOf(VOICE, t); if (seen.has(h)) return; seen.add(h);
  jobs.push({ h, t });
}));

const newP = encryptPayload(obj, PW, P.iter);
html = html.replace(m[0], 'window.PAYLOAD = ' + JSON.stringify(newP) + ';\n');
fs.writeFileSync(HTML, html);

fs.mkdirSync(VO, { recursive: true });
const jk = crypto.createHash('sha256').update(EK).digest();
const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', jk, iv);
const plain = JSON.stringify({ key: audioKey, voiceId: VOICE.voiceId, model: VOICE.model, fmt: VOICE.fmt, items: jobs });
const ct = Buffer.concat([c.update(Buffer.from(plain, 'utf8')), c.final(), c.getAuthTag()]);
fs.writeFileSync(path.join(VO, 'jobs.enc'), JSON.stringify({ iv: iv.toString('base64'), data: ct.toString('base64') }) + '\n');

const chars = jobs.reduce((a, j) => a + j.t.length, 0);
console.log('Schritte mit Sprechtext:', Object.keys(items).length, '· Aufträge:', jobs.length, '· Zeichen:', chars);
