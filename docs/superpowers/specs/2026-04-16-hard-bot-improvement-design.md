# Hard Bot Improvement Design

**Goal:** Make the hard bot navigate smarter (fewer hops via backlink pre-fetching) while staying beatable by increasing its step interval to 2 seconds.

**Architecture:** Replace the current 20+ API-call-per-step pattern with a 3-call maximum using Wikipedia's `linkshere` API to pre-fetch which articles link directly to the target. Remove category fetching from the hard path entirely.

**Tech Stack:** Node.js, Wikipedia Action API (`prop=linkshere`), existing promise-based caching pattern.

---

## Changes

### `server/src/services/bot.js`

**New function: `fetchBacklinks(targetTitle)`**

- Calls `action=query&prop=linkshere&titles=<target>&lhnamespace=0&lhlimit=500&format=json`
- Returns `Set<string>` of article titles that link directly to the target
- Cached in a new `backlinksCache` Map using the same promise-caching pattern as existing caches
- Cap at `CACHE_MAX` (500 entries) with the existing `maybeClearCache` helper

**Rewritten `pickHard(currentTitle, targetTitle)`**

Step-by-step logic:
1. `links = await fetchWikiLinks(currentTitle)` — fetch current page's outgoing links
2. If `links.includes(targetTitle)` → return `targetTitle` (direct hit)
3. `backlinks = await fetchBacklinks(targetTitle)` — cached after first call
4. `matches = links.filter(l => backlinks.has(l))` — links that are one hop from target
5. If `matches.length > 0`:
   - `scoreMap = await fetchSearchRelevance(targetTitle)` — cached
   - Score each match by `scoreMap.get(link) + wordOverlapScore(link, targetTitle)`
   - Return the highest-scoring match
6. Fallback (no backlink matches):
   - `scoreMap = await fetchSearchRelevance(targetTitle)` — cached
   - Score all links by `scoreMap.get(link) + wordOverlapScore(link, targetTitle)`
   - Return the highest-scoring link (or `pickEasy` if all scores are 0)

**What is removed:**
- `fetchCategories` — no longer called in hard mode
- The top-10 candidate loop with parallel category + one-hop fetching
- `clearCaches` export updated to clear `backlinksCache` too

**API calls per step (worst case):**
- Step 1: `fetchWikiLinks` (1 call) + `fetchBacklinks` (1 call, cached after) + `fetchSearchRelevance` (1 call, cached after) = 3 calls
- Step 2+: `fetchWikiLinks` (1 call) + 2 cache hits = 1 call

### `server/src/socket/matchEvents.js`

- Hard mode interval: `800` → `2000` ms
  ```js
  const delay = room.difficulty === 'hard' ? 2000 : room.difficulty === 'medium' ? 1500 : 2500;
  ```

---

## Why This Works

The backlinks set tells us: "these articles are one click away from the target." If the bot's current page links to any of them, it's guaranteed to reach the target next step. This is a much stronger signal than the current approach of checking one-hop for 10 candidates individually (10 API calls just for that signal).

For the fallback path (no backlink match found), BM25 search relevance is already a strong signal for popular targets and is cached after the first call.

The 2-second interval means a human clicking links quickly (~1 link/sec) can outpace the bot on time even if the bot takes fewer total hops.

---

## Out of Scope

- Medium and easy bot difficulty — unchanged
- LLM-based navigation — explicitly excluded (API-free requirement)
- Client-side changes — none required
