#!/usr/bin/env python3
# Wortzeiten fürs Mitlesen (Julys Wunsch 17.11.2026): erkennt in jeder Aufnahme (Thorsten kurs/vt, Max kurs/vo) per
# Spracherkennung, wann welches Wort beginnt, gleicht das mit dem Sprechtext ab und schreibt kurs/<ordner>/<hash>.tm.json
# ({"n": Wortzahl des Sprechtexts, "t": Startzeit je Wort in Hundertstelsekunden}; Wörter = Sprechtext.split() wie im Kurs).
# Enthält keinen Text, nur Zahlen. Nur fehlende Dateien werden erzeugt, veraltete entfernt.
# Aufruf (im Repo): python3 kurs-tools/build-timing.py "<Kurs-Passwort>" <ASR-Modellordner> [vt|vo ...]
#   Modell: https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-stt_de_fastconformer_hybrid_large_pc-int8.tar.bz2
#   Pakete: pip install "sherpa-onnx==1.12.40" numpy cryptography num2words --break-system-packages, ffmpeg
# Nach build-thorsten.py laufen lassen. Ca. 18-fache Echtzeit auf 2 Kernen.
import sys, os, json, re, hashlib, subprocess, base64, time, unicodedata
import numpy as np, sherpa_onnx
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from num2words import num2words

PW, MODEL = sys.argv[1], sys.argv[2].rstrip('/') + '/'
DIRS = sys.argv[3:] or ['vt', 'vo']
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
dump = json.loads(subprocess.check_output(['node', os.path.join(ROOT, 'kurs-tools', 'speech-dump.js'), PW]))
aes = AESGCM(base64.b64decode(dump['key']))
V = dump['voice']
PRE = {'vt': 'thorsten-medium|', 'vo': V['voiceId'] + '|' + V['model'] + '|' + V['fmt'] + '|'}
rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(model=MODEL + 'model.int8.onnx', tokens=MODEL + 'tokens.txt', num_threads=os.cpu_count() or 2)

def norm(w):  # wie norm() im Kurs (Modul Follow)
    w = re.sub(r'(\d)[.,](?=\d)', r'\1', w.lower())
    return ''.join(c for c in unicodedata.normalize('NFD', w) if unicodedata.category(c)[0] in 'LN')
def keys(w):  # Zahlen zusätzlich als Wort, weil die Erkennung Zahlen ausschreibt
    k = norm(w); out = [k]
    if re.fullmatch(r'\d{1,6}', k):
        try: out.append(norm(num2words(int(k), lang='de')))
        except Exception: pass
    return out

def asr(mp3):
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', '-', '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], input=mp3, capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    s = rec.create_stream(); s.accept_waveform(16000, a); rec.decode_stream(s); r = s.result
    ws = []
    for tok, t in zip(r.tokens, r.timestamps):
        if tok.startswith((' ', '▁')) or not ws: ws.append([tok.strip(' ▁'), t])
        else: ws[-1][0] += tok
    return [(norm(w), t) for w, t in ws if norm(w)], len(a) / 16000

def timing(text, rw, dur):
    words = text.split(); n = len(words); K = [keys(w) for w in words]
    W = [len(norm(w)) + 1 + (8 if re.search(r'[.!?:]["“”)]*$', w) else 3 if re.search(r'[,;]["“”)]*$', w) else 0) for w in words]
    m = len(rw); sc = np.zeros((n + 1, m + 1), np.float32); d = np.zeros((n + 1, m + 1), np.int8)
    for i in range(1, n + 1):
        ki = K[i - 1]; val = 1 + min(2, len(ki[0]) / 4) if ki[0] else 0
        for j in range(1, m + 1):
            up, lf = sc[i - 1, j], sc[i, j - 1]
            b, dd = (up, 1) if up >= lf else (lf, 2)
            if val and rw[j - 1][0] in ki and sc[i - 1, j - 1] + val >= b: b, dd = sc[i - 1, j - 1] + val, 3
            sc[i, j] = b; d[i, j] = dd
    t = [None] * n; i, j = n, m
    while i > 0 and j > 0:
        if d[i, j] == 3: t[i - 1] = rw[j - 1][1]; i -= 1; j -= 1
        elif d[i, j] == 1: i -= 1
        else: j -= 1
    # Lücken nach Wortlänge zwischen den bekannten Zeiten verteilen
    anchors = [(-1, 0.0)] + [(k, v) for k, v in enumerate(t) if v is not None] + [(n, dur)]
    for (a, ta), (b, tb) in zip(anchors, anchors[1:]):
        if b - a <= 1: continue
        lo = a + 1; tot = sum(W[lo - 1 if a >= 0 else 0:b]) or 1
        acc = W[a] if a >= 0 else 0; base = ta
        for k in range(lo, b):
            t[k] = base + (tb - base) * acc / tot if a >= 0 else tb * sum(W[:k]) / (sum(W[:b]) or 1)
            acc += W[k]
    for k in range(1, n):
        if t[k] < t[k - 1]: t[k] = t[k - 1]
    return {'n': n, 't': [int(round(x * 100)) for x in t]}

for D in DIRS:
    OUT = os.path.join(ROOT, 'kurs', D)
    have = set(json.load(open(os.path.join(OUT, 'manifest.json'))).get('files', []))
    want, todo = set(), []
    for it in dump['items']:
        h = hashlib.sha256((PRE[D] + it['t']).encode('utf-8')).hexdigest()[:20]
        if h not in have or h in want: continue
        want.add(h)
        if not os.path.exists(os.path.join(OUT, h + '.tm.json')): todo.append((h, it['t']))
    print(D, 'Aufnahmen', len(want), 'neu', len(todo), flush=True); t0 = time.time()
    for k, (h, txt) in enumerate(todo, 1):
        b = open(os.path.join(OUT, h + '.bin'), 'rb').read()
        rw, dur = asr(aes.decrypt(b[:12], b[12:], None))
        open(os.path.join(OUT, h + '.tm.json'), 'w').write(json.dumps(timing(txt, rw, dur), separators=(',', ':')))
        if k % 25 == 0: print(D, k, 'von', len(todo), round(time.time() - t0), 's', flush=True)
    for f in os.listdir(OUT):
        if f.endswith('.tm.json') and f[:-8] not in want: os.remove(os.path.join(OUT, f))
print('Fertig', flush=True)
