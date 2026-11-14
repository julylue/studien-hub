// Gast-Paket neu bauen: node kurs-tools/guest-payload.js kurs/index.html "<eigenes Passwort>" "<Gast-Passwort>" ["<Fehler-formResponse-URL>|entry.<id>" ["<Aufruf-formResponse-URL>|entry.<id>"]]
// 4. Argument (Feld guestMail): Google-Formular für Fehlermeldungen von Gästen; 5. (guestStats): Formular für anonyme Aufrufe. Leer/weglassen = bisheriges behalten.
// Entschlüsselt window.PAYLOAD, setzt guest:true (+ guestMail) und schreibt window.PAYLOAD_GUEST mit neuem Salz/IV.
// Nach JEDER Änderung an PAYLOAD (neue Lektionen, build-voice.js) ausführen, sonst sehen Gäste den alten Stand.
const fs = require('fs'), crypto = require('crypto');
const [f, pw, gpw, mail, stats] = process.argv.slice(2);
let h = fs.readFileSync(f, 'utf8');
const P = JSON.parse(h.match(/window\.PAYLOAD = (\{.*?\});\n/)[1]);
const buf = Buffer.from(P.data, 'base64');
const d = crypto.createDecipheriv('aes-256-gcm', crypto.pbkdf2Sync(pw, Buffer.from(P.salt, 'base64'), P.iter, 32, 'sha256'), Buffer.from(P.iv, 'base64'));
d.setAuthTag(buf.slice(-16));
const o = JSON.parse(Buffer.concat([d.update(buf.slice(0, -16)), d.final()]).toString());
const old = (h.match(/window\.PAYLOAD_GUEST = (\{.*?\});\n/) || [])[1];
let keepMail = '', keepStats = '';
if (old) { try { const G = JSON.parse(old), gb = Buffer.from(G.data, 'base64'); const gd = crypto.createDecipheriv('aes-256-gcm', crypto.pbkdf2Sync(gpw, Buffer.from(G.salt, 'base64'), G.iter, 32, 'sha256'), Buffer.from(G.iv, 'base64')); gd.setAuthTag(gb.slice(-16)); const go = JSON.parse(Buffer.concat([gd.update(gb.slice(0, -16)), gd.final()]).toString()); keepMail = go.guestMail || ''; keepStats = go.guestStats || ''; } catch (e) {} }
o.guest = true; o.guestMail = mail ? mail : keepMail; o.guestStats = stats ? stats : keepStats;
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), iter = 250000;
const c = crypto.createCipheriv('aes-256-gcm', crypto.pbkdf2Sync(gpw, salt, iter, 32, 'sha256'), iv);
const ct = Buffer.concat([c.update(JSON.stringify(o)), c.final(), c.getAuthTag()]);
const line = 'window.PAYLOAD_GUEST = ' + JSON.stringify({ salt: salt.toString('base64'), iv: iv.toString('base64'), iter, data: ct.toString('base64') }) + ';\n';
h = /window\.PAYLOAD_GUEST = \{.*?\};\n/.test(h) ? h.replace(/window\.PAYLOAD_GUEST = \{.*?\};\n/, () => line) : h.replace(/(window\.PAYLOAD = \{.*?\};\n)/, m => m + line);
fs.writeFileSync(f, h); console.log('Gast-Paket neu,', o.lessons.length, 'Lektionen, Fehlerformular:', o.guestMail || '(keins)', 'Aufrufformular:', o.guestStats || '(keins)');
