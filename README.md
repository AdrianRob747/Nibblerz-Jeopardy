# Daily Jeopardy — Friends Edition

A classic blue-and-gold Jeopardy-style trivia game for a small friend group. Players join a room from separate devices, choose dollar-value questions, submit answers, and see the board update live. The host can manually override automatic grading before revealing the correct answer. Daily scores can reset while all-time totals persist.

## Included in this starter

- Private-by-convention rooms with shareable room codes/links
- 5 categories and sample $100–$500 board (sample question bank currently contains $100 and $200 questions)
- Live room updates through Supabase Realtime
- One submission per player per question
- Automatic exact-answer grading with accepted variants
- Host review/override before reveal
- Daily and all-time score display
- “Start new daily game” resets daily scores while preserving all-time scores
- Responsive classic blue-and-gold interface

## Important security note

This is a **starter implementation**, not a hardened public product. It uses a room code and permissive Supabase policies for a quick private prototype. Do not put sensitive information in it or publish it as a public game without hardening it. In this starter, answer keys and score writes are exposed to the anonymous client. A production version should use authenticated player identities and server-side RPC functions to keep answer keys hidden, enforce host permissions, prevent score tampering, and award points transactionally. Do not put a Supabase `service_role` key in the browser.

## 1. Create the Supabase backend

1. Go to [Supabase](https://supabase.com/) and create a project.
2. Open **SQL Editor** in the project dashboard.
3. Paste and run `supabase/schema.sql`.
4. In **Project Settings → API**, copy the Project URL and the `anon` / publishable key.
5. In the project settings, make sure Realtime is available for the project.

## 2. Run locally

Install Node.js (LTS), unzip this folder, and open a terminal in the project folder.

```bash
cp .env.example .env
```

Edit `.env` and replace the placeholders:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Then run:

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

## 3. Deploy so friends can access it

A straightforward option is **Vercel** or **Netlify**:

1. Upload this project to a private GitHub repository.
2. Import the repository into Vercel or Netlify.
3. Set the build command to `npm run build`.
4. Set the output directory to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as deployment environment variables.
6. Deploy, then send your friends the public site URL. The room link includes `?room=ABCDE`.

Supabase hosts the shared data; Vercel/Netlify hosts the website. You need both for multiplayer use.

## Gameplay

- One person creates a room and shares the invite link/code.
- Friends enter their display names and join the same room.
- A player selects a dollar tile and submits a private-to-them answer.
- When every joined player has submitted, the host reviews any ambiguous answers and reveals.
- Correct players receive the tile value. Incorrect answers receive $0; there is no negative scoring.
- The host can start a new daily game. That resets daily scores and reopens the board while keeping all-time totals.

## Current limitations / next upgrades

- This prototype starts with a small sample question bank; add more questions in `src/App.jsx` to fill the $300–$500 tiles.
- Daily questions are seeded when a room is created; the host's new-day button reopens the same board. For a true rotating daily question set, add a scheduled question source or host question editor.
- Automatic grading is exact after normalization; use host override for synonyms, spelling differences, or answers that need interpretation.
- The starter does not have accounts/passwords; room links act as invitations.
- For a secure public release, implement Supabase Auth, server-side answer checking/reveal/score awarding, and restrictive row-level security policies.
