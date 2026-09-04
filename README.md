# Hangout World – Multiplayer Pixel Hangout Game

A simple Manyland-inspired multiplayer hangout game made with vanilla JS + Node.js + Socket.io.

**Features:**
- **Login / Register** system (username + password)
- **Pixel character creator** – draw Idle, Walk1, Walk2, Jump, Fall, Sit, Blink frames (16×16)
- **Lobby area** to hang out, walk, jump, sit
- **Real-time multiplayer** (positions + animations synced)
- **Chat** (messages appear in the side panel + above your character like classic social games)
- Uses existing, simple libraries (Express, Socket.io, bcryptjs)

---

## Quick Start (Local)

```bash
cd hangout-game
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

1. Register a new account (or login)
2. Draw your character frames (or skip for a default buddy)
3. Enter the lobby and invite friends (they need to connect to the same server)

---

## How to Put It Online (Playable with Friends)

You need to host the Node.js server somewhere that supports WebSockets and has a public URL.

### Option A – Render.com (Recommended, free tier)

1. Create a free account at [https://render.com](https://render.com)
2. New → **Web Service**
3. Connect your GitHub repo (push this `hangout-game` folder) **or** use “Deploy from existing image / manual”
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Deploy. You will get a URL like `https://hangout-world-xxxx.onrender.com`
6. Share that URL with friends. Everyone opens it in the browser.

> Free tier spins down after inactivity – first load may take ~30–50 seconds.

### Option B – Railway.app

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub / local
2. Add the service, set start command `npm start`
3. Generate a public domain
4. Done.

### Option C – Fly.io / Glitch / Replit

Any platform that can run a persistent Node process with WebSockets works.  
Just make sure the `PORT` environment variable is respected (the server already uses `process.env.PORT || 3000`).

### Option D – VPS (DigitalOcean, Linode, etc.)

```bash
git clone <your-repo>
cd hangout-game
npm install
# optional: use pm2
npm install -g pm2
pm2 start server/index.js --name hangout
```

Point a domain + Nginx reverse proxy (with WebSocket upgrade headers) to port 3000.

---

## Project Structure

```
hangout-game/
├── package.json
├── README.md
├── server/
│   └── index.js          # Express + Socket.io + simple file-based auth
└── client/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── main.js       # Auth + screen flow
        ├── editor.js     # Pixel art editor + default character
        └── game.js       # Lobby physics, rendering, networking
```

User data is stored in `server/data/users.json` (created automatically).  
For production you should replace the file store with a real database (MongoDB, Postgres, Supabase, etc.).

---

## Controls (in lobby)

| Key          | Action              |
|--------------|---------------------|
| ← → / A D    | Move                |
| Space / W / ↑| Jump                |
| S            | Sit / Stand         |
| Type + Enter | Chat                |

---

## Future Ideas (easy extensions)

- More areas / rooms
- Proximity voice (using WebRTC or LiveKit)
- Object / item placement
- Private rooms
- Better anti-cheat (server-side physics validation)
- Mobile touch controls

---

Made as a fun hangout prototype. Enjoy creating your pixel self and chilling!
