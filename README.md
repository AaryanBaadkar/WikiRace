# WikiRace

A multiplayer Wikipedia racing game — navigate from one article to another using only hyperlinks. Play against bots, friends, or solo.

Built with **Expo (React Native)** on the frontend and **Fastify + PostgreSQL** on the backend, connected via **Socket.io** for real-time gameplay.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/download/) (v14+)
- [Expo Go](https://expo.dev/go) app on your phone (for mobile testing)

---

## 1. Clone the repo

```bash
git clone https://github.com/AaryanBaadkar/WikiRace.git
cd WikiRace
```

## 2. Set up PostgreSQL

Make sure PostgreSQL is running, then create the databases:

```bash
createdb wikirace
createdb wikirace_test
```

> **Windows (pgAdmin):** Open pgAdmin → right-click *Databases* → *Create* → name it `wikirace`. Repeat for `wikirace_test`.

## 3. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `.env` and update these values:

| Variable | What to set |
|----------|-------------|
| `DATABASE_URL` | Your PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/wikirace`) |
| `SERVER_HOST` | Your machine's local IP (run `ipconfig` on Windows, `ifconfig` on Mac/Linux) |
| `JWT_SECRET` | Any random string (default works for dev) |

## 4. Install and start the server

```bash
npm install
npm start
```

The server will:
- Run database migrations automatically
- Start listening on `http://<SERVER_HOST>:3000`

## 5. Seed the database (first time only)

In a new terminal:

```bash
cd server
node src/db/seed.js
```

This populates the article pool with 30 Wikipedia articles across various categories.

## 6. Configure the client

```bash
cd ../client
```

Create a `.env` file:

```
EXPO_PUBLIC_API_URL=http://<YOUR_SERVER_HOST>:3000
```

Replace `<YOUR_SERVER_HOST>` with the same IP you used in the server's `SERVER_HOST`.

## 7. Install and start the client

```bash
npm install
npm start
```

Then choose how to run:
- Press **`a`** → Android (Expo Go or emulator)
- Press **`i`** → iOS (simulator, macOS only)
- Press **`w`** → Web browser

> **Mobile:** Make sure your phone is on the same Wi-Fi network as your computer.

---

## Running tests

### Server tests

```bash
cd server
npm test
```

### Client tests

```bash
cd client
npm test
```

---

## Project structure

```
WikiRace/
├── server/
│   ├── src/
│   │   ├── db/           # Migrations, seeds, connection pool
│   │   ├── middleware/    # JWT auth middleware
│   │   ├── routes/       # REST API (auth, matches, leaderboard, profile)
│   │   ├── services/     # Game logic (bots, matchmaking, Wikipedia API)
│   │   ├── socket/       # Real-time game events via Socket.io
│   │   └── utils/        # JWT and password helpers
│   └── tests/
├── client/
│   ├── app/
│   │   ├── (auth)/       # Login & register screens
│   │   └── (app)/        # Game screens (race, matchmaking, leaderboard, etc.)
│   ├── components/       # ArticleWebView, HUD
│   ├── hooks/            # useAuth, useMatch
│   ├── services/         # API client, socket client
│   └── __tests__/
```

---

## Game modes

- **Bot** — Race against an AI opponent
- **PvP** — Play against another player in real-time
- **Solo** — Navigate at your own pace

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` on client | Check `EXPO_PUBLIC_API_URL` matches server IP and port |
| Database connection error | Verify PostgreSQL is running and `DATABASE_URL` is correct |
| App can't reach server on mobile | Ensure phone and computer are on the same Wi-Fi network |
| Port 3000 already in use | Change `PORT` in server `.env` and update client `.env` to match |
