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

**Voices** (`js/voices.js`): every line plays a classmate's recording first, then ElevenLabs, then the device voice (`T.Voices.say`, used by Listen, Run my role,
Say it for me, Echo, lines over the music). Students: Practice Lines › a scene › **Record my lines** (MediaRecorder, keep / try again; their own device plays
their own recording at once). Recordings go live for everyone at once (Colleen) unless the teacher turns on checking first; Teacher mode › **Voices &
recordings** lists every new one (play, OK, take down), and makes ElevenLabs lines: MTI-permission tick, her API key kept on her computer only (localStorage
`xiKey`), a voice per character + one for group lines, quality (multilingual v2 or flash v2.5), a character count before making, only missing lines,
names via the pronunciation list. API: `voice/<line>/<tts|rec>`, `voice/<line>/pending/<actor>`, `voice/<line>/approve/<actor>`, `voice/pending`,
`voice/index` (which lines have audio; line ids are hashes), `voice/settings`. Not tried against the real ElevenLabs service (tested with a stand-in).
**asl.cool/theatre-teacher** redirects to `/theatre/#/teacher`. An **update banner** appears when the app's files change on asl.cool; `sw.js` checks for
new files every time (v2).
Asked for, waiting on the district: students sign in with their school Google account at asl.cool/theatre (Google sign-in needs an OAuth client and, for
students under 18, the district's Google admin to trust it).

**Follow along with a bouncing ball** (Colleen: music notation following along with the tracks, a bouncing ball, looking like the real script): the reader now
keeps each sung syllable's position (`lyric.syl`, split by letters when one printed item holds two words). Teacher mode › Songs & tracks › **Lyrics timing**:
**Find them in the guide vocals** (`Melody.alignLyrics` on the sung stretches, `Melody.sylTimes` on the sung notes; `dev/test-lyrics.js`), or tap Now per line;
Test, nudge, Save (`T.show.lyricTimes[song] = { kind: 'performance', lines: [{ t, e, s }] }`, band-track clock). `T.Follow` (pages.js) shows a song's real
pages, highlights the line being sung, and moves a red ball (hop animation, none with reduced motion) to each syllable: in My Songs (switch **Bouncing ball
on the music**) and on the scene's pages when a song plays inside a run. Re-import the PDF after updating so lyrics have syllable positions.

**Show and tell** (Colleen: groups that worked in different spaces perform for each other; give the audition soloists, whose one sung line is a stretch,
a moment to shine): a 🎤 Show and tell group type (everyone together); the semester plan makes every other Friday (before the clean-up stretch) a show and
tell, listing the groups since the last one; `day.spotlight` (two at a time, taking turns) are students with a small solo (`T.soloists()`: featured or small roles
with 1–4 solo lyric lines; for HSM JR: James, Susan, Cathy, Cyndra in "Auditions"); their Today says "you sing your solo line for the class" with the song;
the day page has a Spotlight solos picker.

**Talents** (Colleen: during auditions ask each student one thing they are really excited to do on stage; someone can do a cartwheel? work it into the
choreo): the sign-up asks it (`signups[actor].excited`, quick picks or their own words); Casting › Sign-ups shows **Talents to use**; each sign-up and the
notes page show it; a day's Dance / Run-through / Show and tell group lists the talents of the students in it.

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

**Hardest first, then review** (Colleen: learn the most difficult things first and keep rehearsing them as easier things are added): scenes and songs get a
`diff` score in season.js (length, people, big numbers); `nextScene` / `pickSong` teach in that order; in the scenes stretch every Wednesday is a
"Review day (the hardest so far)" (`reviewScene` / `reviewSong`: the hardest learned item rehearsed longest ago). Semester plan shows the teaching order.

**Watch the movie** (Colleen: after the title is announced, before rehearsals begin in earnest): a 🎬 `watch` focus (everyone together); the semester plan
has a "Watch the movie" box (`production.movieDays`, default 3, 0 for none); `starter(movie)` puts those days right after day one, before the audition days.

**The script with notes** (Colleen: both modes see the actual PDF and add notes): js/script-view.js. Students: #/script (tile "The Script"), their lines
highlighted, yellow notes only they see (saved in their practice record, `rec.notes`, so they follow them), purple director's notes. Teacher: #/teacher/read
("Read the script"), highlight any character, her notes are `T.show.scriptNotes` (everyone sees them). Pages are drawn near the screen only.
Line highlights everywhere skip the character's name (`T.Pages.wordBoxes`; the parser now marks `named`).

**Light, sound and music cues** (Colleen: LX numbered from 5 at the top of the show, 1–4 kept for house cues; SX numbered from 1; MX use the script's
music numbers; every blackout or scene change is a "Blue out"; for songs a light cue at the start and between verse / chorus / bridge / mood changes):
js/cues.js. `T.show.cues.list` [{ id, k, n, y, text, sug, mx }]; LX/SX numbers follow page order (`T.cueLabel`). Suggestions (`T.Cues.refresh`,
keeps accepted and hand-made cues): "#N – TITLE" in directions → MX, sound words → SX, blackout / spotlight / split scene / flashback → LX, Lights up
at each scene, Blue out at each scene end, songs: start, new singer group, a chorus coming back (two repeated lines), a 3.5 s break (with lyrics timing),
the end. On Read the script (teacher) cues sit beside the page (numbers only on phones); tap to accept, edit, move, delete, or play an MX.
Teacher › Cue sheet: list, filter, accept all, print. Songs & tracks: "Add many band / guide-vocal tracks" matches file names by their leading number
(songs and scene-change music, stored as tracks `mx<N>`); a Scene-change music table lists them. Students can turn cues on in The Script (off by default).

**Stage manager script** (Colleen: the original PDF with the cues added over it; LX yellow, MX pink, SX blue, scene changes green): Teacher › Stage
manager script (also from the Cue sheet), `T.teacherPages.smscript` in cues.js: every page drawn a little smaller with a cue column on the left (number +
words on the cue's color, a line to the spot) and the cue's line highlighted (cues on the same line share it in stripes); optional suggested cues and
director's notes; print or Save as PDF. Scene changes (`T.Cues.isChange`: Blue out: scene change, Lights up: Scene) are green everywhere.
Printable pages draw with pdf.js intent 'print' (`T.Pages.draw(..., true)`) so they keep going in a hidden tab. Read the script › Go to puts the scene
heading at the top of the screen.

**Mic plot** (Colleen: 8 body mics that cover all spoken or sung lines; swaps written into each performer's track: give up or get a mic, when,
where, who is helping): js/mics.js, Teacher › Mic plot. Units are actors once cast (a doubled actor keeps one mic), characters before. Ensemble
group labels (Jocks, Students, ALL…) are chorus: area mics. Plan: most lines first, a mic shared only by people who never speak in the same scene,
handoffs at a scene change cost more; someone left out who says more bumps the people in their way. Scenes with more speakers than mics are flagged.
Settings in `T.show.micPlot` { n, pin { unit: mic | 'hand' }, where, helper (actor id) }. `T.micSteps(chars, actorId)` gives a person's steps, which
`buildSchedule` puts on their My Schedule cards (🎙️, ⚡ for a handoff at a scene change); the helper (if a cast member) gets the swaps too.
The page lists the swaps (print), each mic in order, who has no mic, and pins.

**Script reader fixes** (Colleen: "many lines were missed and many sung syllables were missed" in Gabriella's highlighted script): a page that is
part music and part script now reads the script above the first song banner or staff and below the last staff (`firstMusic` / `lastStave`);
lines went from 357 to 389 (every centered speaker name in HSM JR is found but one, Jack Scott p78). Singer labels are placed where they sit along the
staff: each lyric word goes to the label before it, so a staff line that changes singer is split (`pushLyric`); "+ TROY:" joins whoever is singing.
Re-import the PDF to get these; importing clears lyrics timing only for songs whose lyric lines changed (find them again on Songs & tracks).
Mic plot, more (Colleen: keep going back to the same mic number whenever possible; if not, mixing is fine; every switch at a scene change): someone
who still will not fit on one mic now takes a free mic scene by scene (the one used last time first), so a change of mic only happens at a scene
change; the page lists who changes numbers. HSM JR with Jack Scott and the Moderator on handhelds: Scenes 7 and 17 each have 10 people speaking or
singing, so 10 body mics cover everyone (each on one mic number all show); 8 or 9 cannot.
The show file can carry a starting mic plot (`micPlot` in show-hsm-jr.js: 10 mics, Jack Scott and the Moderator on handhelds); a plot saved
before (no `v`) moves to it once, keeping the station and helper (`T.micSettings`). Pins can be on a character or an actor.
A stage direction right under a staff ("(#22 – STATUS QUO – PLAYOFF…") is read as a direction, not lyrics or skipped; all 42 HSM JR music numbers
are found, so "Add many … tracks" can place every file (songs and scene-change music) by its number.
Re-importing keeps the saved pages (`pdfVer`) until the new PDF is saved; a show saved without `pdfVer` while the PDF is on the server is reconnected
when the teacher home opens (`recoverPdf`). Read the script, Cue sheet and Stage manager script tiles show whenever there is a script; their pages
explain what to do if the pages are not saved.

**Show look** (Colleen: "a little more branded to High School Musical… around copyright"): the show file's `theme` ({ id, color, presents, cheer })
sets `data-show` on the page (`T.showTheme`, `applyTheme`; a show saved before themes takes it from the show file when the title matches).
East High: school red and white tokens (light and dark), the Graduate varsity font for the title bar and banner only (`--font-show`), pennant
stripe under the bar, a school-color top on tiles, and `T.showBanner()` on the student and teacher home pages (a basketball and spotlight drawn
in SVG for the app). A student's own color, page tint and high contrast still win. Nothing from Disney (no logo, show art or movie fonts).

**Highlighting fix** (Colleen: Gabriella's script lit up Jack Scott / Ms. Darbus lines): ALL in a sung line now means everyone on stage for that
song (`isMine(label, scene, chars, moment)`, `T.songMomentFor`), not everyone anywhere in the scene, so the auditioners' ALL lines in "Auditions"
are no longer Gabriella's. Singer labels: read from the text on the line only (a time signature or sharp beside "RYAN:" no longer hides it), a
label split over two lines ("SHARPAY," / "RYAN:") is joined, a label in pieces ("MS." "DARBUS:") is read, and a lone "SHARPAY," is never a lyric.
HSM JR: 386 spoken lines (three junk lines gone), 515 sung lines, every one with a singer. Re-import the PDF to get it.

**Piano melody from the sheet music** (Colleen: a piano plunks the vocal notes, from the top line of music with lyrics; no notes where nobody
sings): js/sheet-melody.js. Staff lines and barlines from the page's drawing (pdf.js operator list, following save/restore/transform); noteheads
from the Maestro music font (œ ˙ w; ¿ = rhythm-only for spoken words, skipped); pitch from the note's height (treble clef), key signatures
(after the clef or partway along) and accidentals to the next barline; top note of a chord. Only the staff a lyric line sits under; with two vocal
staves at once, the upper one. Each note is timed by the lyrics timing (a note over a syllable starts with it; others placed by position), so it
follows the recording. `T.show.sheetMelody[songId] = { notes: [{ t, d, midi }] }`; the song player's melody switch plays it as a piano
(`SheetMelody.schedule`) when it exists, else the old tone. Songs & tracks: 🎹 per song and "Piano melody for every song"; finding or saving lyrics
timing remakes it; an import that changes a song's lyrics clears it.

**Sheet music always on the song page; guide vocals in Lyrics timing** (Colleen: "i still don't see the pdf of the sheet music to follow along";
"when i do lyric timing… play the guide vocal version so i can hear it"): the song player shows the song's real pages as soon as the script PDF
is saved (`T.Follow.canShow`), with or without a track or lyrics timing, behind a "Sheet music" switch; the bouncing ball joins once the lyrics
are timed. A song's pages start at its own music (its lyrics), not the page with its cue. Lyrics timing plays the guide vocals when uploaded:
times are shown and tapped on the guide's clock and saved on the band track's clock, using the two tracks' offset (`T.show.trackOffset`, worked
out once, or from Find). The lyric matcher (`Melody.alignLyrics`) may skip a line with no stretch of its own (a one-word piece sung in one breath
with its neighbor, now that lines split at singer names) and gives it its share of the neighbor's time by syllables.
Lyrics timing page layout (Colleen: "impossible to keep up with when the button is at the top"): the player is a bar fixed to the bottom
(next line's words, play, back 3 s, time, Now, Clear, Save); while the track plays the sung line lights up and scrolls to the middle
(`follow`), the next line to tap is outlined; on phones the words get a full line above the buttons.

**Lit-up lines instead of the bouncing ball** (Colleen 2026-10-23): the ball is gone; the lyric line being sung lights up in the singer's
character color (several singers side by side; groups in the show's color; `T.lyricColors`), `T.LYRIC_LEAD` = 0.75 s before its timed start
(the tap marks the first sung word; the highlight comes early so singers see it in time; the Lyrics timing page lights rows the same way).
The page stops scrolling by itself for 4 s after the reader scrolls (wheel, touch, keys). The song player's play / back / position are in a
bar fixed to the bottom (`#songbar`); the switches, volume and loop stay in the card at the top.

**Bracketed systems** (Colleen 2026-10-23: staves joined by a bracket at the left are sung at the same time; read left to right across the
system; each staff keeps its own singer): `ScriptParser.geometry` (shared with sheet-melody.js) finds staves (only full-length level lines, so
beams don't break them; thin rectangles count, clipping boxes don't), barlines (also ones running through several staves) and systems (a tall
line at the staves' left edge). `fromPdfJs` stores `page.systems`; `parse` puts each lyric line under its staff, gives singer labels to the
staff under them, keeps a singer per staff (`singerByIdx`), splits a staff's words at rests (> 48 pt) inside a system, and adds a system's
lyrics sorted by where they start. HSM JR: 552 sung lines, every one with a singer. Import clears lyrics timing when a song's lines change in
words or order.
**Character colors** (Colleen 2026-10-23): Troy red, Gabriella purple, Sharpay pink, Ryan green, Chad blue, Taylor golden yellow, Zeke orange
(`color` in show-hsm-jr.js; a show saved before takes them from the show file); chorus / group lines light up highlighter yellow.

**Lyrics timing: Fix and singers; sections by measure** (Colleen 2026-10-23): 🎯 Fix on any line plays from 3 s before it; the next Now
moves that line (keeping its syllable timing, so the piano follows) and the following taps fix the lines after it (she chose "keep playing";
"Done fixing" ends it). The singer's name on a line opens a picker (characters, or Everyone); fixes are kept in `T.show.lyricWho[songNum]`
["index|words"] and put back after a re-import (same line, or the same words in that song). Lit-up sections start at a measure ("count 1 or
5") and are at most two measures long (`measures()` in the reader, using each staff's barlines kept in `page.systems`); a one- or two-syllable
pickup stays with the words before it. HSM JR: 708 sections.
A performer who plays several roles keeps one color in all of them (`color` in app.js): their first role with a picked color (a lead's
wins), else their first role; a lyric line sung by two of their roles lights up in that one color.

**Songs split like a poem** (Colleen 2026-10-23: "dividing the song as you would if it were written like poetry. the end word of a phrase
meant to complete a rhyme scheme should be the last word in a line"): `poetic()` in the reader replaces the two-measure sections. Words in
singing order; a line ends after . ! ? ; : , after a comma or dash once it has 5 syllables, at a rest or held note (a gap much wider than the
staff's usual word spacing) once it has 3, when the singer changes, before a capitalized word (lyric lines start with a capital; not I or
Oh), and at 18 to 24 syllables. A line can run onto the next staff: `lyric.boxes` (box = the first), each syllable knows its box (`b`);
`T.Pages.lyricBoxes(l)` everywhere (lit-up lines, print, script view, song pages), and the piano reads each part under its own staff.
HSM JR: 635 lines. The light goes off when a line's last word is done (last syllable + 1.6 s, or its end) and comes back LEAD before the
next line (Colleen: off during music between lines).
**Sections on the music** (Colleen: after Save, show all the sections at once to edit names, colors, starts and stops): the Lyrics timing page
has two tabs; Save switches to "Sections on the music": the song's pages with every section lit in its singer's colors and numbered
(`drawSections`, `overlay`). Tap one: the bottom bar edits who sings it (color follows), its start (− + Test, Fix), and its words (tap a
syllable to start a new section there, `splitSec`; join with the one before or after, `joinSec`), keeping the times in step. A song edited
this way is marked in `T.show.lyricKeep` and kept as it is when the script is imported again.
**No more re-importing** (Colleen: "why do i have to keep reimporting the pdf?"): `ScriptParser.VERSION` stamps each reading (`script.reader`);
when teacher mode opens on a reading by an older reader, `rereadScript` reads the saved PDF again (the same as an import: speaker names,
key words, singer fixes, edited songs carry over) and saves. **Bump VERSION whenever the reader changes.**
Undo and Reset (Colleen: "what if i used the merge lyrics incorrectly. there's no undo button"): ↶ Undo on both Lyrics timing tabs steps
back through splits, joins, singer changes, nudges, taps, Find and Clear (`snapshot` / `undo`, 60 steps). Sections tab › "Reset this song"
re-reads the saved PDF, puts that song's sections back as the reader makes them (✎ singer fixes stay), clears its lyricKeep mark, timing and
piano.
Lyrics timing: a song position slider (`#ltpos`) in both tabs' bottom bars (the Sections tab also gets play and the time). Dragging while it
plays jumps there; while paused, the spot is remembered (`seekTo`) and play starts there (a jump on a paused, never-played track is lost).
`load()` resolves once the track's metadata is in.

**Spoken lines in songs; overlap; 0.4 s** (Colleen 2026-10-23): lines spoken over the music once the song's title banner has passed ("after
the heading of a song is listed, that is when the track starts"), at the start or in the middle, join the song's sections (`spoken: true`,
no syllables) so they are timed and lit up too; marked 🗣 spoken / italic / dotted outline. Reader VERSION 2026-10-23.2 (teacher mode
re-reads on its own). `T.LYRIC_LEAD` = 0.4 s. Every line being sung is lit at once: from LEAD before its first word until its singing is
done (`T.lineEnd`: its end, at most 2.5 s after its last syllable), so close lines overlap; the Lyrics timing rows light the same way.
Sections that start together (Colleen: in a bracket the JOCKS' "Woh!" and TROY's "Get-" on one beat light up together): `pairStarts` marks a
section starting at the same spot (|dx| < 14) in another staff of the same bracket as one a few sections before it: `lyric.sync` = how far
back its partner is (HSM JR: 29 pairs). Lyrics timing gives it the partner's start after Find, taps, nudges and before Save (`applySync`), Now
skips it, and the list shows "⇄ with N"; "Find lyrics timing for every song" pairs them too. Reader VERSION 2026-10-23.3.
"Only my lines light up" (Colleen 2026-10-23): a switch under the sheet music on a student's song page (`st.mineOnly`, `#follow` data-mine);
T.Follow.update then lights only lines where `T.isMine(who, scene, T.me.chars, the song's moment)`: their character named (alone or with
others), ALL when they are on stage for the song, a group (JOCKS) only for its members.

**School sign-in** (Colleen 2026-10-23: the app should know from the school account who the student is; district OK to proceed): Teacher ›
Passwords & backup › School sign-in: Google Client ID + school email domain (`T.show.signin`). Cast: a school email per student (actor editor,
or "Name<tab>email" / "Last, First, email" in Paste a class list), stored only as `emailHash` = SHA-256("theatre:" + lowercase email) plus a
hint ("j•••@school.org"); no readable address in the show. Who are you?: "Sign in with your school account" (Google Identity Services,
auto_select + prompt, so a Chromebook signed into the school account signs in by itself after the first time); the token's email (and domain)
is matched to the cast list and remembered on the device; the picture picker stays below. The cast password still unlocks the show once per
device. Needs: an OAuth Web Client ID with https://asl.cool (and localhost for testing) as authorized JavaScript origins; the district allowing
the app for students.
**School sign-in page** (Colleen: "ASL Study Hall remembers who they are by the Google account Chrome is logged into; how can that work but
this can't?"): theatre/signin-script/ is a tiny Apps Script web app in her school account (scriptId 1vXplEAJVyuzAQTN7xvmBv59sRzKFXgkuAooIYoOZebIMXz5O2D6pyJAU,
deployment AKfycbyPT5T6gQ6nB-fEqI7QkZ7eu-wSmQ9TGSiFu5iCJUHGoOcznJncTDeWo3OLz2k0Y4CPEA, execute as owner, domain only, like ASL Study).
It reads Session.getActiveUser() and sends the student back to asl.cool/theatre/#/signin/<SHA-256("theatre:" + email)> (the email never leaves
Google; only asl.cool/theatre and localhost:8830 are allowed as return addresses). The app: on Who are you?, when the cast has school emails
and the student isn't known, it hops there once per browser session (`goSignin`), and `applySignin` matches the code to `cast[].emailHash` and
remembers the student. Push changes with clasp --user school from a folder holding these two files and this .clasp.json scriptId (not inside
ASL port); redeploy with `clasp update-deployment <deploymentId>` to keep the address. The Google Client ID route stays as an option.

**Delete a section; spoken lines in edited songs; group singers** (Colleen 2026-10-23): Sections tab › 🗑 Delete (Undo brings it back;
pairs after it keep their partners). A re-read keeps edited songs (lyricKeep) but now puts in the spoken lines a newer reader found, in page
order, with an empty time each, keeping the song's saved timing (`keptMoved`); reader VERSION 2026-10-23.4; `rereadScript.busy` resets after a
re-read. Group singers: `T.show.groupMembers` (show file default: jocks = Chad, Zeke; brainiacs = Taylor, Martha), edited on Cast › Who sings
with the groups; `isMine` counts a group label for its members (a JOCKS line is Chad's; a CHAD line only Chad's; Troy not a Jock).
**One outline per line** (Colleen: overlapping boxes on spoken lines were hard to read; "lines should be encased by one polygon that outlines the
whole line… shaped to the space the line occupies"): `T.Pages.shapes(host, boxes, { cls, colors, data, title })` draws a line's printed rows on
a page as one SVG path (rows joined like a text selection, each row's band kept to its own row so neighbors never overlap; several singers as
stripes via a gradient). Used for the lit-up lines (song pages, practice) and the Sections view (numbers are separate `.sec-num` badges).
**Re-read from any teacher page**: opening any Teacher mode page with an out-of-date reading goes to the home page and re-reads first
(`needsReread`); Script › "Re-read the saved script now" runs it by hand (`rereadScript(true)`).

## 2026-10-23: highlights fit the words; drag the ends; Fix starts fresh
- pages.js: `T.Pages.lyricBoxes(l)` now gives the rows as they light up: each row trimmed to its syllables, rows with no words left off, and the teacher's own ends from `l.cut[k]` ({x0,x1} PDF points, or 0 = hidden). `T.Pages.rawBoxes(l)` is the stored rows (split/join/piano use these; syllable `b` indexes them). `T.Pages.setNeighbors(lyrics)` makes sections on the same printed row (and tightly stacked rows) meet halfway, so no dark overlap.
- teacher.js Sections: the selected section shows round end handles (drag) and ✕ per piece; "Fit to the words again" clears l.cut. setLine (split/join) drops l.cut.
- teacher.js Timing: 🎯 Fix clears the line's time (startFix/endFix, fixOld keeps its syllable timing; Done fixing or Save puts back an untapped line); ✕ Clear per line (and in the Sections bar); "Clear all timing" asks first. Undo ends a fix.

- Passwords & backup › School sign-in: "Test the school sign-in" (T.testSignin in app.js; applySignin sees ls signinTest, toasts the result, returns to #/teacher/passwords). The student button only shows once a cast member has an email.

## 2026-10-23: every password listed; other passwords (parents, peer helpers…)
- Store: `unlockAny` (cast wrap, then enc.more wraps → { key, access id }), `save` opts `addPw {id,pw}` / `dropPw id`, `sealVault/openVault`. Saves and proof calls refuse without the teacher proof (no 403s that would lock the school's address).
- api.js keeps `enc.more` (≤30, checked). test-api covers it. dev-server keeps its KV in <private>/dev-kv and reloads api.js when it changes.
- T.show.vault: { teacher, cast, extra{id:pw} } sealed with the teacher password (T.tpw, memory only). Setup seeds it; cast/teacher changes update it; older passwords: "Type it once" (checked).
- T.show.passes: [{ id, name, off, who student|parent|helper, pages[], teach[], fullCal, practice }]. The iPad remembers ls passId; T.usePass() on open (off/deleted → iPad locked). Parents: names shortened in memory to first + last initial (T.shortName); never saved (view only). Teacher sign-in on such an iPad re-reads the full show.
- Routing: T.passAllows(page) for student pages; T.passTeach for view-only teacher pages (callboard, read, cues, smscript, mics). Calendar "Show everyone" (T.dayBoard, shared with the call board; parents: no Away or private notes). Practice is not recorded unless the checklist says so.
- School sign-in card: the Google Client ID and domain fields were removed (Colleen will not use one); the GIS code stays dormant (only runs if T.show.signin.clientId exists).
- Practice: the per-password "Practice counts" switch is gone. Parents: nothing recorded (Colleen wanted hidden tracking of parents; declined, so off for parents). Helpers: saved to the student, time also counted in time[day].helped; Progress shows "with a helper".
- App use (Colleen asked to measure parents unannounced): anonymous counts only. api.js `usage` (POST no password, rate-limited 400/hour per address, added up in theatre:usage:<YYYY-MM> by kind student|parent|helper, page, [opens, seconds]; GET needs the proof). app.js counts page opens and active seconds (10 s ticks within 2 min of a touch), sends every minute / when hidden. Teacher mode is not counted. Report: Teacher mode › App use (T.teacherPages.usage). No names, students, devices or addresses kept. The parent home line no longer says nothing is recorded.
- Wording (Colleen 2026-10-23): Company Artists (Artist), Company Mentors (Mentor), the Company. User-facing "student(s)" → Company member(s); "peer helper" → Company Mentor; the helper password mode works "with an Artist"; Trench Crew are Company Mentors. Internal names (pass who "helper"/"student", group id "helpers") are unchanged. The mic helper wording was left as it was (her call).
- Cast: a.company = artist | mentor (T.COMPANY, T.companyTag). Cast page grouped (Company Artists / Company Mentors / Not marked yet); actor dialog "In the Company" Artist / Mentor / Not set; paste list reads "Artist"/"Mentor" on a line; Progress filter Everyone / Artists / Mentors; a Mentor password lists only Artists (when any are marked).
- Lyrics timing: 🎯 Fix clears only the chosen line; after its tap the next line keeps its time (another Now overrides it, nothing is cleared ahead). Typed start times: a box on each line and in the Sections bar (47.15 or 0:47.15; typeTime moves the whole line with its syllables).
- Follow-along scrolling: keepInView (pages.js) keeps the newest lit line ~30% down the space above the player bar, pre-scrolls to the next line in music with no words, every 700 ms at most, waits 4 s after the reader scrolls. (The old scrollIntoView aimed at the line shape, which is a whole-page SVG since the outlines, so it stopped after the first line.)
- Held notes: on Save, addHolds finds where each line's singing stops in the guide vocals (voiceRegions; capped at next line + 1 s) and saves h; T.lineEnd uses h. Old rule kept as the fallback. Saved lines without h: Save the song's timing again.
- Time boxes 104 px wide, with the do-not-autofill attributes (a password extension's icon covered the numbers).
- Highlight look (Colleen, her pastel palettes): T.pastel / T.deepShade (pages.js, HSL from each character color); shapes fill pastel (stripes for two singers) with a deeper outline in the same colors (two-color outline for stripes); follow-line and sec-box are opaque (multiply keeps the print showing), no overlaps.
- Reader 2026-10-23.5 (song 19 reprise): a name alone followed by sentence words before the next notes is a speaker, not a singer label (speechFollows, lyricRow); spoken words on a row with a sharp sign; "NAME: (direction)" in italics then the words; "KELSI :" (space before the colon) in LAB; a spoken line continues only onto the row right below on the same page (no more lyrics and measure numbers glued on); tidy() drops trailing measure marks; a singer label at the end of a spoken row is split off.
- Sections: "Join with…" menu (joinPair, removeAt) joins a section with any section up to 6 away, the same singer first (two staves sung together alternate numbers).
- Stop times: h + hm (set by hand). Timing tab: an Ends box per line (typeEnd; empty = automatic) and "✋ Set the stops" (drawStops: a button for each line lit now or just dark; tap when its singing stops). Save keeps hm stops; addHolds fills only the others.
- Re-read keeps lyric timing line by line (same singer+words, same place on the page, or same words); a song loses its timing only if no line matches.
- Reader 2026-10-23.6: a "NAME: words" line right under a staff with no lyrics is read (saidLike); lines hidden at the bottom of a music page that repeat the next page's top lines are skipped (nextTop).
- Timing list: a redraw while paused keeps the scroll (follow(true, true)); pausing clears the lit row. Each row: 📍 (open Sections with that section selected, centered, its number pulsing) and 🗑 (delSec). "Time: Everything / 🎵 Sung / 🗣 Spoken" (timeKind, ls): Now and the fix run go only to that kind; others dimmed.
- Lyrics timing side by side (wide screens, ≥1000 px; "One at a time" / "⇆ Side by side", ls ltSplit): #ltleft list, #ltright music (sticky, own scroll) with a compact section bar on top. draw() redraws only the list and the player bar once the music is there; section actions call refresh(); tapping a section picks its row (pickRow); 📍 shows the section (showSec); lines being sung get .sec-on and the music panel scrolls along (lightMusic).
- Reader 2026-10-23.7 (reading order, Colleen: left to right along a row, then the next row): addLyric tags each sung lyric with its staff row (_pg, _sy); readingOrder() moves a spoken line printed just above a staff into that row by its left edge (sung order untouched); sung phrases a spoken line used to split are joined again by poetic(). A singer label at the end of a spoken row (also with a stray music symbol) is split off on every path; repeat marks tidied there too.
- Timing one part at a time (brackets): loadGeo() reads each page's systems (ScriptParser.geometry) on the Timing page; sysAt/partOf give a line's staff in its bracket (part 0 = top; lines on a staff of their own count as part 0). "⬆ Top part / Middle / ⬇ Bottom part" in the Time switch; "⤵ Fill the other parts from this one" (fillParts): every syllable of the other parts takes the time of the timed part's syllable at the same place along the staff (within 4 pt), between notes by position, past the ends at the nearest pace. Undo puts them back.
- Piano 2026-10-24: ScriptParser.geometry also returns beams (filled 4-corner bars), arcs (ties/slurs: filled curves) and stems (the script reader ignores them; its output is unchanged). sheet-melody staffNotes reads lengths (w 4, ˙ 2, œ 1 halved per beam/flag j r, dot ×1.5), rests (Œ Ó ‰ ≈ ∑), ties (a curve to the next same-pitch note). make() lays each staff's notes out by beats between the sung syllables (median pace outside them), every part kept: notes { t, d, midi, p (staff in its bracket), w (who) }; low voices (show lowVoices) an octave down (octaveFor). Pitches checked against key signatures (F# on the top line etc.).
- Song player: "Piano plays: My part / All parts / Melody only" (st.piano; My part = the student's notes clear, the rest soft). Timing page part mode: "✎ Who sings this part" (partSinger, kept in lyricWho). Old pianos: Save a song's timing (or 🎹 in Songs & tracks) to make it again.
- Parts by position (Colleen): top = highest staff of a bracket, bottom = lowest (two or three staves), middle only in three-staff brackets (sysAt part 0/1/2; an old saved part1 on a two-staff song becomes part2).
- Singer fixes (lyricWho) are put back with T.applyWhoFixes (re-read and Reset this song): same index+words, else the shift learned from fixes that matched (unique words), only onto the same words; never by words alone (two staves sing the same words with different singers, which gave both lines one color). Reader 2026-10-24.1 to re-read once and repair. Songs with edited sections (lyricKeep) keep their lines: fix those with ✎ or Who sings this part.
- Timing: Now taps the first untimed line after the playhead (nextOpen from the last line timed at or before it). ⏩ Retime from here on each line (runFrom, fixRun): plays from 3 s before it; each Now gives the next line its time and moves on to the end; nothing cleared ahead; Done fixing ends it.
