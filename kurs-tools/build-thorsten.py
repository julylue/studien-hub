#!/usr/bin/env python3
# Vertont die Sprechtexte des Lernkurses mit der freien Stimme Thorsten (Piper, CC0, Modell de_DE-thorsten-medium)
# und legt sie verschlüsselt unter kurs/vt/<hash>.bin ab (AES-256-GCM: 12 Byte IV + Chiffre + Tag, gleicher
# Audio-Schlüssel wie bei Max). Kostet nichts, läuft in einer Claude-Sitzung (nicht im GitHub-Workflow).
# Aufruf (im Repo): python3 kurs-tools/build-thorsten.py "<Kurs-Passwort>" <Modellordner>
#   Modell: https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-de_DE-thorsten-medium.tar.bz2
#   Pakete: pip install "sherpa-onnx==1.12.40" numpy cryptography (2.x braucht eine andere Konfiguration), ffmpeg
# Vorher build-voice.js laufen lassen (erneuert die Sprechtexte), danach guest-payload.js nicht nötig (nur Tonspuren).
# Hash = SHA-256("thorsten-medium|" + Sprechtext)[:20], genau wie im Kurs (Voice-Modul, THORSTEN_ID).
import sys, os, json, re, glob, hashlib, subprocess, base64, time, numpy as np
import sherpa_onnx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PW, MODEL = sys.argv[1], sys.argv[2].rstrip('/') + '/'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'kurs', 'vt')
VID = 'thorsten-medium'
os.makedirs(OUT, exist_ok=True)

dump = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'kurs-tools', 'speech-dump.js'), PW]))
aes = AESGCM(base64.b64decode(dump['key']))

def norm(t):
    t = t.replace('̂', ' Dach')
    t = re.sub(r'[„“"]\+[„“"]', 'Plus', t)
    rep = [('$', ' Dollar '), ('π', 'pi'), ('∧', ' und '), ('&', ' und '), ('⇔', ', genau dann, wenn '), ('¬', 'nicht '), ('/', ' Schrägstrich '), ('+', ' plus '), ('„', ''), ('“', ''), ('"', '')]
    for a, b in rep: t = t.replace(a, b)
    return re.sub(r'\s+', ' ', t).strip()

cfg = sherpa_onnx.OfflineTtsConfig(
    model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(
        model=glob.glob(MODEL + '*.onnx')[0], tokens=MODEL + 'tokens.txt', data_dir=MODEL + 'espeak-ng-data'), num_threads=os.cpu_count() or 2),
    max_num_sentences=1)
tts = sherpa_onnx.OfflineTts(cfg)

want, todo, seen = set(), [], set()
for it in dump['items']:
    h = hashlib.sha256((VID + '|' + it['t']).encode('utf-8')).hexdigest()[:20]
    want.add(h)
    if h in seen: continue
    seen.add(h)
    if not os.path.exists(os.path.join(OUT, h + '.bin')): todo.append((h, it['t']))
print('Aufträge', len(want), 'neu', len(todo), 'Zeichen', sum(len(t) for _, t in todo), flush=True)
t0 = time.time()
for n, (h, t) in enumerate(todo, 1):
    a = tts.generate(norm(t), sid=0, speed=1.0)
    pcm = (np.clip(np.array(a.samples), -1, 1) * 32767).astype('<i2').tobytes()
    mp3 = subprocess.run(['ffmpeg', '-loglevel', 'error', '-f', 's16le', '-ar', str(a.sample_rate), '-ac', '1', '-i', '-',
                          '-codec:a', 'libmp3lame', '-b:a', '40k', '-f', 'mp3', '-'], input=pcm, capture_output=True, check=True).stdout
    iv = os.urandom(12)
    open(os.path.join(OUT, h + '.bin'), 'wb').write(iv + aes.encrypt(iv, mp3, None))
    if n % 25 == 0: print(n, 'von', len(todo), round(time.time() - t0), 's', flush=True)
removed = 0
for f in os.listdir(OUT):
    if f.endswith('.bin') and f[:-4] not in want: os.remove(os.path.join(OUT, f)); removed += 1
files = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.bin'))
open(os.path.join(OUT, 'manifest.json'), 'w').write(json.dumps({'files': files}) + '\n')
print('Fertig:', len(todo), 'neu,', removed, 'entfernt,', len(files), 'vorhanden', flush=True)
