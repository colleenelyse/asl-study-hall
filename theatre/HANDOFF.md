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

## Built in session 3 (2026-10-21): Production, and getting ready before the cast list

How Colleen's class runs (her words, 2026-10-21): one 45-minute period every school day for the semester; **every student has something to do every day**;
weeks are revealed to students one at a time so plans can change; several rehearsals at once whenever possible (a duet rehearsing while the chorus learns the
song's dance while everyone else works crew); students need vocals, acting and dance time; **as much stage time as possible**, and big group numbers include
everyone, especially the ensemble and small roles (barring costume changes); everyone except the biggest leads has a crew and works it at least one day a week;
a place for choreography videos made by students; and the cast (how many students, abilities, genders) is only known about a week before school starts,
so the app must be ready and waiting for a class list.

`js/production.js` (Teacher mode › Production; students' **Today** tile). Data: `T.show.production = { term {first,last,off}, shown [Mondays], stations,
crewHome, crewExempt, days {date: {groups, assign, tasks, notes}}, conflicts, attendance }`, and `T.show.videos`.
- **Calendar & crew**: first and last day of class; paste the district's no-school days (one per line, ranges, many formats; unreadable lines are listed back);
  crew stations; everyone's home crew ("Fill in the rest evenly"); **Lead** tick skips the weekly crew day (defaults to students playing a `leads` character).
- **A class day** has 1+ **groups**, each Acting / Vocals / Dance / Run-through / Tech / Dress / Show, with scenes and songs, where, and who
  (everyone in it, principals only, or chorus only). **Split: singers + chorus dance** turns one song group into a Vocals group (principals) and a Dance group
  (ensemble and small roles). Each student goes to the first group they are in; otherwise to their home crew; leads with no crew get practice in the app
  (lines for scenes coming up and songs, taking turns). A student on stage every day of a week is sent to crew on the last open day. Any student's job can be
  set by hand (a group, a crew, practice, or the teacher's own words). "Same crew jobs the rest of the week".
- **Big numbers**: `big: true` on a song moment (★ in Teacher mode › On stage) puts every ensemble and small-role character on stage for it (`T.onFor` in app.js);
  tapping a box takes one off (`out`, e.g. a costume change). Set on Start of Something New, Get'cha Head, Auditions, Status Quo, Counting on You,
  We're All in This Together, Bop to the Top, Breaking Free. Ms. Tenny and the Moderator are marked `small`. Only a show set up after this change gets these
  (the outline is copied at setup).
- **Week** view with **Show this week to students**; **Stage time** (each student's days on stage by Acting / Vocals / Dance vs crew and practice, fewest first);
  **Days away** (teacher adds, or students send from Today as encrypted notes); **Attendance** for every student every class day; **Call board** for the week,
  grouped by job; **Dance videos** (students share a school Google Drive link from a song's page; the teacher OKs it before the cast sees it).
- Before the cast list: Teacher mode › Cast › **Paste a class list** (names only, "Last, First" turned around). Students without a role can sign in, see Today,
  listen to the whole show, read the story; the schedule says it comes with their role. Whole-cast groups include them.

Student supports added (research-backed, see the list Colleen was given 2026-10-21):
- **Fade** (now the default in Practice Lines): each line is shown, then a hint once it is said without help, then hidden; it steps back after help.
  Prompting with prompt fading is an evidence-based practice for autistic learners (NCAEP 2020 report).
- **Play the whole show** (My Songs): every song in order with the guide vocals, repeating, on an `<audio>` element so it plays with the screen off.
- **Today**: the next class's job in large type with a Start button straight into the activity, then the rest of the shown weeks (a visual schedule).

**Trench Crew** (Colleen's idea): a role for peers, group `helpers` ("Peer models"), not in the script. In "Get'cha Head in the Game" (k7) they are in the trench
(the pit) facing the stage, modeling the choreography and catching stray basketballs. A moment's `where: { character: text }` says where someone is when it is
not the stage; My Schedule shows it (📍) and says "In the song" instead of "On stage". Split song groups send peer models with the chorus (they model the dance).
Teacher mode › On stage can add the Trench Crew to other numbers.

**Guests** (Colleen: if there are not enough peers for the stage and the trench, recruit a few dancers to rehearse a time or two in tech week and perform):
Cast › an actor › **Guest**. A guest has no daily job, crew or class attendance; they join a group only on Run-through, Tech, Dress and Show days (or when the
teacher sets their job by hand), and appear in attendance and on the call board only on those days. Not counted in Stage time.

Tests: `dev/test-api.mjs` (19), `dev/test-dates.js` (6), `dev/test-line-check.js`.

## Built in session 4 (2026-10-21): Casting, voices, field trips, practice data

**Casting** (`js/casting.js`, Teacher mode › Casting; students' **Auditions** tile while open): Auditions open switch; students sign up on the iPad (up to 6 roles
in order, "any role is OK", comfort with lines / solo singing / dancing, how they want to audition: in class, video, with a buddy, with their talker or sign,
"things that help me", optional pronouns; sent as an encrypted note, type `audition`). Each role has an **audition side** (the scene with the most of that
character's lines, practiced with Run my role as that character: `#/lines/<scene>/run/<char>`, which does not touch their own line data) and a song they are named in.
Audition notes (1–3 for acting, singing, dance; quick tags; "think about them for"); Callbacks per named role with suggestions (★ wanted it, ✓ noted),
shown to students with a switch; Cast list draft (starts from current roles; "Fill in a draft for me" = callbacks then first choices then notes, one named role each;
"Put everyone without a role in the ensemble"), then **Post** sets every student's roles. Nothing about gender is asked or used. **First two weeks**: a starter plan
(week 1 whole-cast vocals, dance, read-through, crew tours; week 2 audition prep, auditions, callbacks), fills empty days only and shows week 1 to students.
Teacher mode › Cast › Paste a class list makes this usable on day one.
**The audition is the first week** (Colleen: teach the whole-cast numbers first and use that as the audition, starting with the finale, plus a short vocal selection
of the student's choice): First two weeks = Megamix (Bows) vocals, Megamix dance, We're All in This Together (Reprise), Wildcat Cheer, run all three + crew tours;
then pick your vocal selection (any song, about 30 seconds, chosen in the sign-up; sign or a buddy are fine), vocal selections for half the class each day
(the other half reviews the finale dance), callbacks (a group with `callbacks: true` fills itself from the callback list), and the run-through when the cast list goes up.
Audition notes › **Quick notes during a group number**: a star grid (singing, dance, acting/energy) for the whole class, saved as you tap.

**Voices** (Colleen: the read-aloud voices were "terrible"): only the device's good English voices (joke voices removed, Premium/Enhanced/natural first, a pool of 6,
gentle pitch changes). `pronounce()` fixes names from `outline.say` plus the teacher's list (Teacher mode › Script › How words are said, with Hear),
"Ms." → "Miz", dashes, ellipses, ALL-CAPS words. Settings: **My voice** (each student picks the voice for their own lines; any character that had that voice moves to
the most similar one left; per student on the device), **Story voice**, "same voice for everyone", and how to download better voices on iPad and Mac.

**Field trips and shopping** (`js/shopping.js`; Production › Shopping): a 🚌 Field trip group; "Two trips: half the class each" (another day, store and teacher; halves mix
the crews; the other half has class as usual). One shopping list for the whole show: every costume piece for every student who wears it (sizes from Cast, shown to
students only with a switch) and props (`outline.props` starter list, the teacher adds more). Students on the trip open it from Today: a "what will happen" list and
**Found it!** with a price; saved on the iPad and sent when back on Wi-Fi (`Store.queueNote` / `flushNotes`, type `shop`). Budget and money spent.

**Practice data** (`js/progress.js`; API `/theatre/api/progress[/<actor>]`): like her flashcard app. In Run my role the first try at each line counts right or wrong
(microphone result, or the student's own ✓ I got it / ✗ Not yet). After a song (track ends, or leaving after 60%+) students rate the words and the dance (😟 🙂 🤩,
or no dance). Minutes on practice pages count while the student is active or audio plays. Records live on the iPad and are saved sealed to KV (40 saves / 10 min
per student); another iPad merges them. **Study next** (Today, Practice Lines): the top three, favoring what is coming up in class in the next 10 days, lines
missed or never tried, songs rated low, and things not practiced lately. **Teacher mode › Progress**: per student % practiced (scenes with every line tried + songs
rated), minutes (7 days / all), struggling (a scene under 60% right after 3+ tries, a song rated 1), and days away when their scenes or songs were worked on,
"caught up" once they practice it afterward; 🏅 list of students who practiced everything; sort by needs help / most done / most practice; per-student detail.
Limit to know: anyone with the cast password could overwrite another student's record (it needs their id and the show key); fine for a class.

Notes from iPads now go through `T.noteHandlers[type]` (conflict, video, audition, shop); a page only clears the notes it knows.

**Theatre bookings** (Production › Calendar & crew): the theatre's name and its other bookings, pasted one per line ("12/8/2026 Jazz Band Concert 7:30pm",
ranges work). Shown as ⚠️ on the Week view, the day's plan and the call board (Colleen: watch for our set in someone's way, or theirs in ours, around tech week).
Colleen's plan (2026-10-21): a show each semester in the **Reber Center** (North Campus): fall ends in December (finals about Dec 15–17), spring ends in May
(finals about May 25–27; seniors' last day May 19). Performances the week before finals or finals week. The app holds one show at a time, so
"Start a new show" for spring is still to build.

**Performances** (`js/performances.js`; Production › Performances): each performance's day, time, in-school or evening, relaxed performance, free ticket link
(general admission on a ticketing site) and a note; the cast sees upcoming ones on Today with a **Free tickets** button for families. **Plan show week**
(Colleen: three dress days in the class period, then in-school shows, any evening for families): Monday Act 1 dress, Tuesday Act 2 dress (the show splits at
the scene where half its minutes have gone by; HSM JR has no act break), Wednesday full run, Thursday in-school shows at the times she types, plus an
evening performance (default Friday). **School-day version** (45 minutes bell to bell; evening shows keep everything): Colleen's ranked cut options live in
`outline.cutIdeas` (1. Scene 10 Horticulture HQ, 2. Scene 8 hallway) and `cutNotes` (tighten scene changes first; Jack's Scene 2 announcement as a small trim).
Length = kept moments (songs from tracks when uploaded; everything else scaled to a timed full run once she enters one) + seconds per scene change, optional
narrator bridges from the scene summaries. "Suggest" only applies her ranked cuts, then says how far over it still is. My Schedule shows **Evening show /
School-day show** and lists what of theirs is left out. The page reminds her to get MTI's written permission before performing cuts.

**Student look options** (Settings; saved per student as `prefs:<actor>` and per device): reading font (Atkinson Hyperlegible, Lexend, Andika, Comic Neue,
the device's own), letter spacing, line spacing, main color (6), page tint in light mode (6), plus the earlier text size, light/dark, high contrast, symbols, motion.
**Chromebooks** (every student has one; Chrome has good Google voices and speech recognition): keyboard shortcuts with on-screen hints on keyboard devices
(Practice: Space play/pause, ← → back/next, Enter I got it, X not yet, H hint, S say it for me, M microphone; Songs: Space, ← back 10 s; Play the whole show:
Space, ← →); checked at 1366×768. **Install as an app**: `manifest.webmanifest`, icons in `img/` (drawn by `dev/make-icons.js`), and `sw.js` (network first,
the device's copy when offline; never caches `/theatre/api/`). Installing and the microphone need https, so they work only on asl.cool (or localhost).

**Semester plan, Tracks, Doubling** (`js/season.js`): Production › **Semester plan** fills every empty class day from the school calendar, by character (works
before the cast list): the audition weeks (`T.applyStarter`, halves worked out daily), music first (read-through + vocals), then scenes in order with acting,
principals' vocals and the chorus dance at once (least-overlap song), a Friday run of what is blocked so far, a clean-up stretch (oldest scene first; Wed/Fri half
runs), runs week, show week (`T.buildShowWeek`). Generated days have `gen: true` and can be cleared. Acting rehearsals call only a scene's spoken parts.
Production › **Tracks**: every character's calendar (printable) and an at-a-glance table with the longest stretch without a call. Students: Today › My whole
calendar (shown weeks only). Casting › **Doubling**: roles never on stage together (whole-cast numbers excluded) with the shortest break for a costume change,
medium roles first; featured roles a member of a named group can play. Reading lines: others' lines light yellow, mine green, the current line strongest.

**Lines over the music** (Teacher mode › Songs & tracks › Lines over the music, `cuesPage` in teacher.js): tick the lines spoken during a song, then **Find them
in the guide vocals** (`Melody.voiceRegions` marks spoken vs sung stretches in the isolated voice; `Melody.alignLines` matches lines in order by length;
`dev/test-underscore.js`), or tap Now while the track plays; nudge, Test, Save (`T.show.underscore[song] = { kind: 'performance', cues: [{ key, t }] }`).
In Practice Lines the track plays inside the run (with or without the singers) and cued lines come on cue without stopping it; my lines pop up over the music.
**The real pages** (`js/pages.js`): the teacher's PDF is saved sealed at import (`/theatre/api/pdf`, `Store.putPdf/getPdf`); the reader keeps every item's box
(`item.boxes`, `lyric.box`, PDF points from the page's top-left, using `viewport.convertToViewportPoint`, since this PDF's pages have an offset origin).
Practice Lines › **Script pages / Lines**: the real pages with yellow (others), green (mine), the current line strongest, covers for hint/hidden lines,
the song bar above the buttons. **My script (print)**: my lines and lyrics I sing in colors I pick, an edge band on my scenes, only my scenes or the whole
script; teachers print any track before casting (Tracks › Highlighted script for this track, `#/teacher/print/<character>`). Reader fixes this session:
positions now use the page's real origin; a line near the footer is no longer dropped (357 lines, 463 lyric lines now). Re-import the PDF after updating.

## Still to build
- **Show Control** (projector + sound system): unchanged from the plan below.
- **Start a new show** for next year: needs a way to enter the new show's song list (the parser only treats cues whose numbers are songs as songs) and characters. Teacher mode can already add characters from unknown speaker names and adds scenes it does not know.
- Lyrics: the parser still leaves a few split syllables ("hap pen"); the teacher can fix them in Script > scene > tap the song.
- Try on a real iPad: the voices list, the microphone prompt, and Add to Home Screen.

### Show Control (projector + sound system)
- Laptop plays performance tracks to the sound system from tracks stored on that laptop (IndexedDB), so performances don't depend on Wi-Fi.
- A second window on the projector (BroadcastChannel to sync) shows the current line or lyric in huge type for the back wall. Advance with space bar / presentation clicker; optional "tap along once to record timings, then auto-advance".
- Later: phone as remote using the existing live rooms (`rt/live.js`).

### Later sections
- ~~Casting~~: built in session 4 (above).
- ~~Production~~: built in session 3 (above).
- Ideas offered to Colleen, not built yet (her choice): see the end of session 3's chat; e.g. social narratives for tech week and show day, video modeling, peer buddies, a break card, practice streaks.

## Design notes
- Fonts: Lexend (headings) + Atkinson Hyperlegible (body), both on Google Fonts, chosen for readability.
- Each character gets a "spike tape" color used on their chips, schedule cards and lines.
- Touch targets 56px+, base text 18px scaled by the actor's setting, light and dark themes, reduced motion respected.
- Track links: rehearsal tracks folder `1oTAmJVz1E6LtZhVr8uqBhv1ZCpBZ6A_A` (Guide Vocals), performance tracks `1TH1Tp166f7TxQ0-fSAhIeUD4uYuBPolo`. File names weren't readable without the Google Drive connector.
