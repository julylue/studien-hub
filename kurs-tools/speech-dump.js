// Gibt die Sprechtexte des Kurses als JSON aus (für build-thorsten.py): node kurs-tools/speech-dump.js <Passwort>
// Ausgabe auf stdout: {key: <Audio-Schlüssel base64>, items: [{lesson, step, t}]}, Reihenfolge nach Lektionsnummer.
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const html = fs.readFileSync(path.join(__dirname, '..', 'kurs', 'index.html'), 'utf8');
const P = JSON.parse(html.match(/window\.PAYLOAD = (\{.*?\});?\n/s)[1].replace(/;$/, ''));
const k = crypto.pbkdf2Sync(process.argv[2], Buffer.from(P.salt, 'base64'), P.iter, 32, 'sha256'), d = Buffer.from(P.data, 'base64');
const dc = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(P.iv, 'base64')); dc.setAuthTag(d.slice(-16));
const o = JSON.parse(Buffer.concat([dc.update(d.slice(0, -16)), dc.final()]).toString('utf8'));
const items = [];
o.lessons.slice().sort((a, b) => a.nr - b.nr).forEach(l => l.steps.forEach(s => { const t = o.speech && o.speech[l.id] && o.speech[l.id][s.key]; if (t) items.push({ lesson: l.id, step: s.key, t }); }));
process.stdout.write(JSON.stringify({ key: o.voice.key, items }));
