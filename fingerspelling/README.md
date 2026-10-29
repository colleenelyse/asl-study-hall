# ASL Fingerspelling Practice

A free website where students read fingerspelling from a realistic 3D hand. No sign-in; progress stays in the student's browser.

## Files
- `index.html`: the page and its screens (#/, #/setup, #/play, #/results, #/review, #/report, #/progress, #/chart)
- `app.js`: the game (rounds, checking, scores, progress, report, data code)
- `hand.js`: the 3D hand (made from Colleen's approved hand; letter shapes and motion unchanged)
- `words.js`: the word bank (same list as the Fingerspelling Words tab in ASL Study)
- `style.css`, `privacy.html`

## Switches (top of app.js)
- `CFG.ads`: ad spaces on Home, Results and Progress (never during play). Off.
- `CFG.ga`: a Google Analytics 4 ID (like G-XXXXXXX) to count visits per screen and game events. Empty = off.

## Publishing (later)
Upload this folder to a GitHub repository, then connect it to Cloudflare Pages (or turn on GitHub Pages). No build step: it is plain HTML.
