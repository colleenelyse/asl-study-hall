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

## Still to build (the screens)

### Students (iPad)
1. **Unlock**: cast password once per iPad (remember it; keep an encrypted offline copy in IndexedDB).
2. **Who are you?** Big photo/initials cards of the cast; if no cast yet, pick a character.
3. **Actor home**: big tiles: My Schedule · Practice Lines · My Songs · My Costumes · The Story. Settings (text size, high contrast, read-aloud speed, symbols).
4. **Practice Lines** (pick a scene, then a mode):
   - **Listen**: reads the scene aloud line by line (speechSynthesis, a different voice/pitch per character). Toggles: say names before each line, read stage directions, speed. Big play/pause/back/next; current line highlighted; tap a line to jump. Songs show a card with the track.
   - **Run my role**: pick a character; app reads everyone else and **stops at my lines** until I say it. Microphone (webkitSpeechRecognition, works in iPad Safari on https) → `LineCheck.check()` → "You got it!" / "So close, you missed …" / "Not quite" + hint levels (`LineCheck.hint`) / "I didn't hear you". Options per actor: line shown / hint / hidden; **echo first** (app says my line, I repeat it); **"I did it" button instead of mic** for AAC and sign users; "say my line for me" (app speaks it as their voice); strictness. Lines labeled `ALL`, groups, or `TROY, GABRIELLA` count for each named role (map labels with `aliases` and `labelGroups`).
5. **My Schedule** (Colleen's example: "Song 1 – on stage singing ___ · Song 2 – off stage, change into basketball uniform (__ minutes)"): walk the `moments` in order for the actor's characters. On stage: what I do (acting with N lines / singing which song), costume, props. Off stage: group consecutive off moments into one card with **about N minutes** (sum of moment minutes), and "change into X" when the next on-stage costume differs. Visual first-then layout, icons, printable.
6. **My Songs**: list of my songs, with a player: performance track + toggles **Melody line on/off** and **Guide vocals on/off** (the bridge from rehearsal tracks to no support), volume, loop a section, lyrics alongside.
7. **My Costumes**: costume cards with items checklist and photo, which moments.
8. **The Story**: scene-by-scene story in plain language, read-aloud, sensory warnings, who's in it.

### Teacher mode (teacher password)
- **Import script PDF** → review speaker labels → map to characters → review/edit lines and lyrics per scene. Rebuild `moments` from the parse (talk segments + songs, presence from speakers/singers), keeping the teacher's edits.
- **Cast**: actors (name, characters, photo resized small, access settings above).
- **On stage grid**: characters × moments, tap to toggle; minutes per moment.
- **Costumes & props**: per character, which moments.
- **Songs & tracks**: upload rehearsal (guide vocal) and performance tracks per song from the laptop (encrypted to KV); song lengths fill in from the audio; **Make melody line** runs `Melody.extract` once and saves the notes in the show.
- **Passwords**, backup export/import, start a new show for next year.

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
