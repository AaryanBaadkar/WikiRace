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

## 3. Find your local IP address

The server and client must both use your machine's **local IPv4 address** (not `localhost`) so that Expo Go on your phone can reach the backend.

**Windows:**
```bash
ipconfig
```
Look for **Wireless LAN adapter Wi-Fi → IPv4 Address** (e.g. `192.168.1.42`).

**Mac/Linux:**
```bash
ifconfig | grep "inet "
```
Look for the address on your Wi-Fi interface (e.g. `192.168.1.42`), not `127.0.0.1`.

> Keep this IP handy — you'll use it in both the server and client `.env` files.

## 4. Configure the server

```bash
cd server
cp .env.example .env
```

Edit `.env` and set these values:

| Variable | What to set |
|----------|-------------|
| `DATABASE_URL` | Your PostgreSQL connection string (default: `postgresql://postgres:postgres@localhost:5432/wikirace`) |
| `SERVER_HOST` | Your local IP from step 3 (e.g. `192.168.1.42`) |
| `JWT_SECRET` | Any random string (default works for dev) |

> **Important:** `SERVER_HOST` must be your local IP, not `localhost` or `127.0.0.1`. The server binds to this address so that your phone can connect to it over Wi-Fi.

## 5. Install and start the server

```bash
npm install
npm start
```

The server will:
- Run database migrations automatically
- Start listening on `http://<SERVER_HOST>:3000`

## 6. Seed the database (first time only)

In a new terminal:

```bash
cd server
node src/db/seed.js
```

This populates the article pool with 30 Wikipedia articles across various categories.

## 7. Configure the client

```bash
cd ../client
```

Create a `.env` file:

```
EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000
```

Replace `<YOUR_LOCAL_IP>` with the same IP from step 3 (e.g. `http://192.168.1.42:3000`).

> **Both must match:** The `SERVER_HOST` in `server/.env` and the IP in `EXPO_PUBLIC_API_URL` in `client/.env` must be the same address.

## 8. Install and start the client

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
