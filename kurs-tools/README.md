# Werkzeuge für den Lernkurs (kurs/)

Enthält nur Code, keine Kursinhalte. Die Inhalte liegen verschlüsselt in `kurs/index.html` (window.PAYLOAD).

- `speech.js`: macht aus einem Kursschritt (HTML) einen gut vorlesbaren Sprechtext (Formeln, R-Code, Tabellen).
- `mcorder.js`: feste gemischte Reihenfolge der Antworten (gleiche Funktion `mcOrder` im Kurs).
- `build-voice.js`: legt die Sprechtexte verschlüsselt in den Kurs (ohne ELEVEN_KEY nur das) und schreibt mit Schlüssel `kurs/vo/jobs.enc` (Aufträge,
  verschlüsselt mit SHA-256 des ElevenLabs-Schlüssels). Aufruf:
  `KURS_PW=... ELEVEN_KEY=sk_... node kurs-tools/build-voice.js m2-l04-kennwerte m2-l05-korrelation ...`
  (Lektions-IDs = Reihenfolge der Vertonung). Nach jeder inhaltlichen Änderung an Lektionen erneut ausführen.
- `speech-dump.js`: gibt die Sprechtexte als JSON aus (für build-thorsten.py).
- `build-thorsten.py`: vertont alle Sprechtexte kostenlos mit der freien Stimme Thorsten (Piper, Modell de_DE-thorsten-medium, sherpa-onnx 1.12.40) und legt sie verschlüsselt unter `kurs/vt/<hash>.bin` plus `kurs/vt/manifest.json` ab. Nur Neues wird vertont, Veraltetes entfernt. Läuft in einer Claude-Sitzung (ca. 45 Min. für 600.000 Zeichen auf 2 Kernen). Aufruf: `KURS_PW=... node kurs-tools/build-voice.js && python3 kurs-tools/build-thorsten.py "<Passwort>" <Modellordner>`, danach guest-payload.js.
- `vo-run.mjs` (seit 16.11.2026 nur noch manuell, Workflow ohne Zeitplan; ElevenLabs-Credits bleiben für die Karten-App): läuft im Workflow `.github/workflows/vertonung.yml` (täglich und bei Änderung von jobs.enc),
  vertont fehlende Texte mit ElevenLabs (Stimme Max, Modell Flash v2.5) und legt sie verschlüsselt als
  `kurs/vo/<hash>.bin` ab. Verteilt die Vertonung über den Monat: 15.000 Credits pro Monat gehören der Karten-App (anteilig für die Resttage plus 2.000 immer frei), der Kurs bekommt höchstens (Kontingent - 15.000) / 30 pro Tag. Braucht das Secret `ELEVENLABS_API_KEY`.
