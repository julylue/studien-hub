// GitHub-Workflow: vertont fehlende Sprechtexte des Lernkurses mit ElevenLabs und legt sie
// verschlüsselt unter kurs/vo/<hash>.bin ab (AES-256-GCM: 12 Byte IV + Chiffre + Tag).
// Liest die Aufträge aus kurs/vo/jobs.enc (verschlüsselt mit SHA-256 des API-Schlüssels).
// Hält eine Reserve an Credits für die Karten-App frei und hört rechtzeitig vor dem Zeitlimit auf.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const KEY = process.env.ELEVENLABS_API_KEY;
const RESERVE = +(process.env.RESERVE || 8000);         // Credits, die für die Karten-App übrig bleiben
const MAX_MIN = +(process.env.MAX_MIN || 40);           // Laufzeit in Minuten
const COST = 0.25;                                      // Credits pro Zeichen (Flash ca. 0,2, mit Puffer)
const DIR = 'kurs/vo';
if (!KEY) { console.log('Kein ELEVENLABS_API_KEY hinterlegt, nichts zu tun.'); process.exit(0); }

const t0 = Date.now();
const enc = JSON.parse(fs.readFileSync(path.join(DIR, 'jobs.enc'), 'utf8'));
let job;
try {
  const k = crypto.createHash('sha256').update(KEY).digest(), d = Buffer.from(enc.data, 'base64');
  const dc = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(enc.iv, 'base64')); dc.setAuthTag(d.subarray(d.length - 16));
  job = JSON.parse(Buffer.concat([dc.update(d.subarray(0, d.length - 16)), dc.final()]).toString('utf8'));
} catch (e) { console.error('jobs.enc passt nicht zum Schlüssel (Schlüssel gewechselt? build-voice.js neu laufen lassen).'); process.exit(1); }
const audioKey = Buffer.from(job.key, 'base64');

const have = new Set(fs.readdirSync(DIR).filter(f => f.endsWith('.bin')).map(f => f.slice(0, -4)));
const want = new Set(job.items.map(i => i.h));

async function credits() {
  const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': KEY } });
  if (!r.ok) throw new Error('subscription ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const j = await r.json(); return j.character_limit - j.character_count;
}
async function tts(text) {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + job.voiceId + '?output_format=' + job.fmt, {
      method: 'POST', headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: job.model, language_code: 'de' })
    });
    if (r.ok) return Buffer.from(await r.arrayBuffer());
    const msg = (await r.text()).slice(0, 300);
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 5000 * (a + 1))); continue; }
    throw new Error('tts ' + r.status + ' ' + msg);
  }
  throw new Error('tts: zu viele Fehlversuche');
}
function seal(buf) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', audioKey, iv);
  return Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]);
}

let left = await credits();
console.log('Credits frei:', left, '· Reserve:', RESERVE, '· Aufträge:', job.items.length, '· schon vorhanden:', [...have].filter(h => want.has(h)).length);
let made = 0, chars = 0, stop = '';
for (const it of job.items) {
  if (have.has(it.h)) continue;
  if (Date.now() - t0 > MAX_MIN * 60000) { stop = 'Zeitlimit'; break; }
  if (left - it.t.length * COST < RESERVE) { stop = 'Credit-Reserve erreicht'; break; }
  const mp3 = await tts(it.t);
  fs.writeFileSync(path.join(DIR, it.h + '.bin'), seal(mp3));
  have.add(it.h); made++; chars += it.t.length;
  if (made % 20 === 0) { left = await credits(); console.log(made, 'neu, Credits frei:', left); }
  else left -= it.t.length * 0.2;
}
let removed = 0;
for (const h of have) if (!want.has(h)) { fs.unlinkSync(path.join(DIR, h + '.bin')); have.delete(h); removed++; }
const files = [...have].filter(h => want.has(h)).sort();
fs.writeFileSync(path.join(DIR, 'manifest.json'), JSON.stringify({ files }) + '\n');
const open = job.items.filter(i => !have.has(i.h));
console.log(`Fertig: ${made} neu (${chars} Zeichen), ${removed} entfernt, ${files.length} von ${job.items.length} vertont, offen ${open.length} (${open.reduce((a, i) => a + i.t.length, 0)} Zeichen)` + (stop ? ' · Stopp: ' + stop : ''));
