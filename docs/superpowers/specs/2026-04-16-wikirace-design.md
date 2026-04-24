# WikiRace — Design Specification
**Date:** 2026-04-16  
**Status:** Approved

---

## One-Sentence Pitch

Outrace an algorithm through Wikipedia using nothing but hyperlinks.

---

## Overview

WikiRace is a competitive mobile navigation game where players race to reach a target Wikipedia article starting from a random article, using only the hyperlinks inside articles to navigate. Players can race against an AI bot (with adjustable difficulty) or against another human in real time.

---

## Platform & Stack

| Layer | Technology |
|---|---|
| Mobile client | React Native + Expo Go |
| Backend | Node.js + Fastify |
| Real-time | Socket.io |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |
| Wikipedia | Wikipedia REST API (server-side fetch) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                React Native (Expo Go)                │
│  Auth → Lobby → Game Setup → Race → Results → Stats │
│  Socket.io client  |  REST API calls                 │
└────────────────┬────────────────────────────────────┘
                 │ HTTP + WebSocket
┌────────────────▼────────────────────────────────────┐
│              Node.js + Fastify                       │
│  REST: auth, profile, history, leaderboard           │
│  Socket.io: game rooms, race state, bot ticks        │
│  Wikipedia Service: fetch + strip articles           │
│  Bot Service: pathfinding engine (per difficulty)    │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│              PostgreSQL                              │
│  users | matches | match_participants | leaderboard  │
└─────────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│           Wikipedia REST API (external)              │
│  Fetched server-side, HTML stripped, sent to client  │
└─────────────────────────────────────────────────────┘
```

---

## Data Model

```sql
users
  id             uuid primary key
  username       text unique not null
  email          text unique not null
  password_hash  text not null
  avatar_url     text
  created_at     timestamptz default now()

matches
  id             uuid primary key
  mode           text check (mode in ('bot', 'pvp'))
  difficulty     text check (difficulty in ('easy', 'medium', 'hard'))  -- null for pvp
  start_article  text not null
  target_article text not null
  status         text check (status in ('waiting', 'in_progress', 'completed'))
  head_start_sec int not null default 60
  created_at     timestamptz default now()
  ended_at       timestamptz

match_participants
  id             uuid primary key
  match_id       uuid references matches(id)
  user_id        uuid references users(id)  -- null = bot
  path           jsonb not null default '[]'  -- ordered array of article titles visited
  steps          int not null default 0
  completed_at   timestamptz
  won            boolean not null default false

-- Materialized view (MATERIALIZED VIEW leaderboard_entries), recomputed via REFRESH on match completion
-- Columns: user_id, wins, losses, total_matches, win_rate, avg_steps, fastest_win_secs

-- Curated pool of interesting Wikipedia articles for pair generation
article_pool
  id       serial primary key
  title    text unique not null
  category text  -- e.g. 'person', 'place', 'food', 'concept', 'object'
```

**Notes:**
- Bot is represented as a `null` user_id in `match_participants` — no special tables needed
- `path` as JSONB enables full match replay from stored data
- `leaderboard_entries` is a materialized view recomputed on each match completion
- Leaderboard requires minimum 10 matches to qualify for ranking

---

## Core Gameplay Loop

1. Player selects mode (vs bot or vs human); in bot mode, configures difficulty and head start duration (60–120s)
2. Server picks a start + target article pair from `article_pool`, validated to be 3–8 hops apart
3. Match room is created; `match:ready` emitted with both article titles
4. **Bot mode:** head start timer begins — player navigates freely while bot waits, then bot starts after the timer expires. **PvP mode:** both players start simultaneously with no head start
5. First participant to land on the target article wins; server validates and broadcasts `match:won`
6. Results screen shows both paths, step counts, and time taken; match written to DB

---

## Real-Time Race Events (Socket.io)

| Event | Direction | Payload |
|---|---|---|
| `match:ready` | server → client | `{ matchId, startArticle, targetArticle, headStartSec }` |
| `match:start` | server → client | `{ startsAt: timestamp }` |
| `match:bot_start` | server → client | `{ startsAt: timestamp }` — after head start expires |
| `match:step` | client → server | `{ matchId, article }` — player visited a new article |
| `match:step` | server → client | `{ participantId, article, steps, isBot }` — broadcast to room |
| `match:won` | server → client | `{ winnerId, winnerPath, loserPath }` |
| `match:abandoned` | client → server | player disconnected or gave up |

---

## Navigation Rules

- Players may only move by tapping an internal Wikipedia hyperlink within the current article body
- No back navigation, no Wikipedia search, no external links — enforced by stripping all non-body links from the served HTML
- Each link tap is reported to the server as `match:step` before navigation occurs
- Server validates that the tapped article was a valid link in the previously visited article (cheat prevention)
- Win condition: first `match:step` event where `article === targetArticle`

---

## Wikipedia Article Rendering

Articles are fetched server-side from the Wikipedia REST API and sent to the React Native client as stripped HTML. The client renders them in a `WebView` with injected JavaScript that:

1. Removes all Wikipedia navigation chrome (header, footer, sidebar, edit links, category links)
2. Intercepts all `<a>` tag tap events
3. Filters to internal Wikipedia article links only (strips external links, file links, citation links)
4. Posts the tapped article title back to React Native via `window.ReactNativeWebView.postMessage`
5. Blocks default link navigation (React Native controls all routing)

This gives full article fidelity (text, images, formatting) while keeping players inside the game.

---

## Bot Difficulty

| Level | Strategy |
|---|---|
| Easy | Picks a random link from the current article |
| Medium | Picks the link whose title has the highest word/token overlap with the target article title |
| Hard | BFS/greedy: pre-fetches links 1–2 levels ahead, picks the branch with shortest known path to target |

Bot tick speed is throttled to feel human-like (0.5–2s per step depending on difficulty).

---

## Auth

- Email + password registration; bcrypt password hashing
- JWT access token (15 min expiry) + refresh token (30 days) stored in Expo SecureStore
- No OAuth for v1

---

## User Profile & History

**Profile screen shows:**
- Win/loss record, win rate, avg steps, personal best (fewest steps + fastest time)
- Recent match history list

**Match replay:**
- Stepping through both participants' `path` arrays side by side
- Shows which article each was on at each step number
- No live re-navigation — purely a visual step-through of stored paths

---

## Leaderboard

- Global ranking by win rate (minimum 10 matches)
- Tabs: Most Wins | Fewest Avg Steps | Fastest Avg Time
- Filterable: All modes | Bot only | PvP only

---

## Article Pair Generation

- Pairs drawn from `article_pool` — a curated set of interesting articles across categories (people, countries, foods, objects, concepts, events)
- On match creation, server randomly selects a start and target, then validates they are 3–8 hops apart using a lightweight BFS over the Wikipedia link graph
- Pairs that fail validation are discarded and regenerated
- Pool seeded with ~500 articles initially; expandable via admin endpoint

---

## Screens

1. **Auth** — Login / Register
2. **Home / Lobby** — Play vs Bot | Play vs Human | Leaderboard | Profile
3. **Game Setup** — Mode config; if bot: difficulty + head start duration; if PvP: no extra config
4. **Matchmaking** (PvP) — Waiting room until opponent joins
5. **Race** — WebView article renderer + HUD (current article, steps, opponent steps, target)
6. **Results** — Winner, both paths displayed, step counts, time
7. **Replay** — Step-through of a stored match
8. **Profile** — Stats, match history
9. **Leaderboard** — Global rankings

---

## Out of Scope (v1)

- Push notifications
- Friends / social graph
- In-app purchases or cosmetics
- Tournament / bracket mode
- Non-English Wikipedia
