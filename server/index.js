const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json({ limit: '2mb' })); // sprites can be a bit large as base64
app.use(express.static(path.join(__dirname, '../client')));

// Simple file-based user storage (replace with DB for production)
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading users:', e);
  }
  return {};
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();

// In-memory lobby state
const lobby = {
  players: new Map(), // socketId -> player data
};

// Auth endpoints
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || username.length < 2 || password.length < 4) {
    return res.status(400).json({ error: 'Username min 2 chars, password min 4' });
  }
  if (users[username.toLowerCase()]) {
    return res.status(400).json({ error: 'Username already taken' });
  }
  const hash = await bcrypt.hash(password, 10);
  users[username.toLowerCase()] = {
    username,
    passwordHash: hash,
    createdAt: Date.now(),
    character: null // will store frames later
  };
  saveUsers(users);
  res.json({ success: true, username });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users[username.toLowerCase()];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({
    success: true,
    username: user.username,
    character: user.character
  });
});

app.post('/api/save-character', (req, res) => {
  const { username, character } = req.body;
  if (!username || !character) return res.status(400).json({ error: 'Missing data' });
  const key = username.toLowerCase();
  if (!users[key]) return res.status(404).json({ error: 'User not found' });
  users[key].character = character;
  saveUsers(users);
  res.json({ success: true });
});

// Serve client
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  socket.on('join-lobby', (data) => {
    const { username, character } = data;
    if (!username) return;

    // Leave previous if any
    if (lobby.players.has(socket.id)) {
      lobby.players.delete(socket.id);
    }

    const player = {
      id: socket.id,
      username,
      character: character || getDefaultCharacter(),
      x: 400 + Math.random() * 200 - 100,
      y: 300,
      vx: 0,
      vy: 0,
      facing: 1, // 1 right, -1 left
      state: 'idle', // idle, walk, jump, fall, sit, blink
      frame: 0,
      sitting: false,
      lastBlink: Date.now(),
      chatMessage: null,
      chatUntil: 0
    };

    lobby.players.set(socket.id, player);
    socket.join('lobby');

    // Send current players to new joiner
    const others = [];
    for (const [id, p] of lobby.players) {
      if (id !== socket.id) others.push(sanitizePlayer(p));
    }
    socket.emit('lobby-state', { players: others, you: sanitizePlayer(player) });

    // Notify others
    socket.to('lobby').emit('player-joined', sanitizePlayer(player));
  });

  socket.on('player-update', (data) => {
    const player = lobby.players.get(socket.id);
    if (!player) return;

    // Trust client for position for this simple hangout (add server validation later)
    if (typeof data.x === 'number') player.x = data.x;
    if (typeof data.y === 'number') player.y = data.y;
    if (typeof data.vx === 'number') player.vx = data.vx;
    if (typeof data.vy === 'number') player.vy = data.vy;
    if (data.facing) player.facing = data.facing;
    if (data.state) player.state = data.state;
    if (typeof data.frame === 'number') player.frame = data.frame;
    if (typeof data.sitting === 'boolean') player.sitting = data.sitting;

    socket.to('lobby').emit('player-moved', {
      id: socket.id,
      x: player.x,
      y: player.y,
      vx: player.vx,
      vy: player.vy,
      facing: player.facing,
      state: player.state,
      frame: player.frame,
      sitting: player.sitting
    });
  });

  socket.on('chat', (msg) => {
    const player = lobby.players.get(socket.id);
    if (!player || !msg || typeof msg !== 'string') return;
    const text = msg.slice(0, 80).trim();
    if (!text) return;

    player.chatMessage = text;
    player.chatUntil = Date.now() + 6000;

    io.to('lobby').emit('chat-message', {
      id: socket.id,
      username: player.username,
      message: text
    });
  });

  socket.on('disconnect', () => {
    if (lobby.players.has(socket.id)) {
      const player = lobby.players.get(socket.id);
      lobby.players.delete(socket.id);
      socket.to('lobby').emit('player-left', { id: socket.id, username: player.username });
    }
    console.log('Player disconnected:', socket.id);
  });
});

function sanitizePlayer(p) {
  return {
    id: p.id,
    username: p.username,
    character: p.character,
    x: p.x,
    y: p.y,
    facing: p.facing,
    state: p.state,
    frame: p.frame,
    sitting: p.sitting,
    chatMessage: p.chatMessage,
    chatUntil: p.chatUntil
  };
}

function getDefaultCharacter() {
  // Simple colored rectangle placeholder frames (will be overridden by editor)
  return {
    name: 'New Character',
    width: 16,
    height: 16,
    frames: {
      idle: null,
      walk1: null,
      walk2: null,
      jump: null,
      fall: null,
      sit: null,
      blink: null
    }
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Hangout Game server running on http://localhost:${PORT}`);
  console.log('Open the URL in your browser to play!');
});
