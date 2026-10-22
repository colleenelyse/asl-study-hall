# asl.cool/theatre — Adaptive Theatre production app

Hand-off from the planning conversation (2026-10-21). This branch (`theatre-start`) holds the engine pieces, built and tested.
Nothing here is live: `main` is what deploys to asl.cool.

## What it is

A one-stop app for Colleen's adaptive theatre class: students with and without disabilities put on a Broadway Junior / KIDS musical together.
First show: **Disney's High School Musical JR.** (MTI). It must work for any licensed script, because the course repeats with new shows.
Main device: **iPads** (simple, big touch targets). Also: teacher laptop, projector, theatre sound system.

Students it must serve: emerging readers, nonverbal / AAC users, autistic students and sensory needs, vision and hearing needs.

## Hosting (decided)

- Lives at **asl.cool/theatre**, as the `theatre/` folder of this repo, served by the existing `asl-study-hall` Worker (`worker.js`, `run_worker_first`).
- Static files are served by `env.ASSETS` automatically. Only the API needs Worker code.
- Storage: reuse the existing KV binding `LOCKS`, keys prefixed `theatre:` (never touch the `state` key the home page uses).
- Other Claude sessions also work in this repo (ASL Study Hall). Keep changes to shared files (`worker.js`, `.assetsignore`) small and pull before pushing.
- The repo is public and mirrored to colleenelyse.github.io. So:

## Copyright rules (important)

- **Never commit script text, lyrics, the script PDF, or track audio.** The license covers this cast only.
- Script lines and lyrics enter the app only when the teacher imports her PDF in the browser (`js/script-parser.js` runs on her device).
- Everything cast-specific (lines, lyrics, student names, photos, track audio) is stored **encrypted** in KV:
  AES-GCM with a key from the **cast password** (PBKDF2-SHA256, 250k+ iterations), same pattern as the home page's `slocks`.
- A separate **teacher password** is needed to save. Send `PBKDF2(teacherPw, vsalt)` as proof; the Worker compares SHA-256 of it with `vhash` (copy `save()` in worker.js). Rate-limit wrong guesses per IP (`theatre:fail:<ip>`).
- First-time setup: allow the first save to set `vsalt/vhash` only while none exists (or require a `THEATRE_SETUP` secret if set).

Suggested API (all under `/theatre/api/`):
- `GET show` → `{ enc:{iter,salt,iv,data}, vsalt, updated }` or 404 before setup
- `POST show` → `{ proof, enc, newVsalt?, newVhash? }`
- `GET track/<songId>/<rehearsal|performance>` and `POST` same (teacher proof), value = encrypted audio (KV max 25 MB per value)

## Built and tested on this branch

| File | What it does | Tested |
|---|---|---|
| `js/script-parser.js` | Reads an MTI actor's script (via pdf.js text positions): scenes, every spoken line by speaker, stage directions, music cues, songs with **who sings** and **lyrics** (syllables rejoined), printed page numbers. Skips sheet-music glyphs. `ScriptParser.fromPdfJs(pdf)` → `ScriptParser.parse(pages, {songNumbers})` | HSM JR script: 17 scenes, 349 dialogue lines, 13 songs, 476 lyric lines. Run `dev/test-script-parser.js` (counts only) |
| `js/line-check.js` | Did the student say their line? Paraphrase allowed: checks meaning words, not exact order. Handles speech-recognition quirks (dropped apostrophes, misheard names, numbers), catches a dropped "not". Strictness loose / medium / exact, teacher key words, hints with first letters | `dev/test-line-check.js` (all pass) |
| `js/melody.js` | Wordless melody line: aligns the guide-vocal track with the performance track (FFT cross-correlation), subtracts to isolate the voice, YIN pitch tracking → notes `{t, d, midi}`. `schedule()` plays them as a soft tone over the performance track | `dev/test-melody.js`: offset exact, all notes within 20 ms |
| `js/show-hsm-jr.js` | The show's outline, no script text: 27 characters with plain-language descriptions and aliases, 17 scenes (place, time, page, our own story summary, sensory warnings), 13 songs, 35 **moments** (each stretch of talking or song) with who is on stage, starter costume plot | Built from the parser's output plus the MTI synopsis |

Script layout facts the parser relies on (MTI Broadway Junior actor's script): speaker name centered in bold capitals on its own line;
dialogue at the left margin; directions indented italic in ( ); `SCENE n: PLACE – DAY, TIME`; music cues `#9 – GET'CHA HEAD IN THE GAME`;
sheet-music pages have spoken lines as `TROY: words` and singer labels like `9 TROY:` above staves. Printed page = PDF page − 11 for this script (detected automatically).

pdf.js in the browser: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js` (+ `pdf.worker.min.js`). Call `page.getOperatorList()` before `getTextContent()` so font names (bold/italic) resolve; `fromPdfJs` already does this.

## Built in session 2 (2026-10-21): the app

| File | What it is |
|---|---|
| `index.html`, `css/app.css` | The page. Lexend + Atkinson Hyperlegible, light/dark/high contrast, text size, 56px+ targets, print styles |
| `js/store.js` | Encryption and storage. A random **show key** encrypts the show; the cast password (PBKDF2-SHA256 250k) only wraps that key, so changing the cast password does not break the tracks. An iPad that ticks Remember keeps the show key (a CryptoKey in IndexedDB, never the password) plus the last encrypted copy, so it opens offline; Settings > Lock this iPad forgets both. Tracks: 12-byte iv + AES-GCM bytes, cached on the device by version |
| `js/app.js` | Student screens: Unlock, Who are you?, Actor home, Practice Lines (Listen and Run my role), My Schedule, My Songs, My Costumes, The Story, Settings |
| `js/teacher.js` | Teacher mode: Setup (both passwords), Script import + speaker names + per-scene edit (story, sensory warnings, lines, key words, lyrics, singers), Cast (photo, characters, practice settings per actor), On stage grid + minutes, Costumes, Songs & tracks (upload, Make melody line), Passwords & backup (encrypted backup file) |
| `api.js` | The Worker API (imported by `worker.js`, hidden by `.assetsignore`): `GET/POST show`, `POST check`, `GET/POST/DELETE track/<song>/<rehearsal\|performance>`. KV keys `theatre:show`, `theatre:track:*`, `theatre:fail:<ip>` |
| `dev/test-api.mjs` | 13 checks of the API on a fake KV (`node theatre/dev/test-api.mjs`) |
| `dev/dev-server.mjs` | Local test server (site + API on an in-memory KV). Put the script PDF in a folder OUTSIDE the repo and pass it as the third argument |

Parser fixes this session (`js/script-parser.js`): a scene heading or the "Actor's Glossary" heading at the very top of a page was being dropped as a page header
(pdf.js gave 14 scenes and read the glossary as one of Troy's lines); now 17 scenes, 333 lines, 448 lyric lines. Split contractions in lyrics ("did n't") are rejoined.

Tested in the browser with the real HSM JR PDF (kept outside the repo): setup, wrong/right teacher password, import (17 scenes, 333 lines, speaker names map automatically
except SOLO and DUET in the Megamix, which the teacher chooses), cast, Run my role with a stand-in for speech recognition (silent / not quite / got it, then it moves on),
"I did it", hints, schedule, encrypted track upload and download, melody line (9 of 9 test notes), song player (guide on/off, melody tone, loop), costumes, story,
settings, phone and iPad widths. Not yet tried on a real iPad (microphone, voices) or on the live Worker.

How students "say" a line: Run my role listens with webkitSpeechRecognition (iPad Safari, https only). AAC / sign users get the "I did it" button (set per actor, or on any device without speech recognition).

## Still to build
- **Show Control** (projector + sound system): unchanged from the plan below.
- **Start a new show** for next year: needs a way to enter the new show's song list (the parser only treats cues whose numbers are songs as songs) and characters. Teacher mode can already add characters from unknown speaker names and adds scenes it does not know.
- Lyrics: the parser still leaves a few split syllables ("hap pen"); the teacher can fix them in Script > scene > tap the song.
- Try on a real iPad: the voices list, the microphone prompt, and Add to Home Screen.

### Show Control (projector + sound system)
- Laptop plays performance tracks to the sound system from tracks stored on that laptop (IndexedDB), so performances don't depend on Wi-Fi.
- A second window on the projector (BroadcastChannel to sync) shows the current line or lyric in huge type for the back wall. Advance with space bar / presentation clicker; optional "tap along once to record timings, then auto-advance".
- Later: phone as remote using the existing live rooms (`rt/live.js`).

### Later sections (Colleen wants these next; ask which first)
- **Casting**: audition sign-ups, audition notes, callback list, cast list.
- **Production**: rehearsal calendar, who's called, attendance, conflicts.

## Design notes
- Fonts: Lexend (headings) + Atkinson Hyperlegible (body), both on Google Fonts, chosen for readability.
- Each character gets a "spike tape" color used on their chips, schedule cards and lines.
- Touch targets 56px+, base text 18px scaled by the actor's setting, light and dark themes, reduced motion respected.
- Track links: rehearsal tracks folder `1oTAmJVz1E6LtZhVr8uqBhv1ZCpBZ6A_A` (Guide Vocals), performance tracks `1TH1Tp166f7TxQ0-fSAhIeUD4uYuBPolo`. File names weren't readable without the Google Drive connector.
