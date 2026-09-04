const Game = {
  canvas: null,
  ctx: null,
  socket: null,
  localPlayer: null,
  otherPlayers: new Map(),
  characterImages: new Map(), // id -> {idle: Image, walk1: ..., ...}
  keys: {},
  lastUpdate: 0,
  animTimer: 0,
  groundY: 0,
  worldWidth: 1600,
  gravity: 0.45,
  jumpForce: -9.5,
  moveSpeed: 3.2,

  init(socket, character) {
    this.socket = socket;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.groundY = this.canvas.height - 80;

    // Local player
    this.localPlayer = {
      id: 'local',
      username: character.username || 'You',
      character,
      x: 400,
      y: this.groundY - 16,
      vx: 0,
      vy: 0,
      facing: 1,
      state: 'idle',
      frame: 0,
      sitting: false,
      onGround: true,
      chatMessage: null,
      chatUntil: 0,
      animFrame: 0
    };

    this.loadCharacterImages('local', character);
    this.bindInput();
    this.bindSocket();

    // Join lobby
    this.socket.emit('join-lobby', {
      username: this.localPlayer.username,
      character
    });

    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.groundY = this.canvas.height - 80;
  },

  loadCharacterImages(id, character) {
    const imgs = {};
    const frames = character.frames || {};
    const keys = ['idle', 'walk1', 'walk2', 'jump', 'fall', 'sit', 'blink'];
    let loaded = 0;
    keys.forEach(k => {
      const img = new Image();
      img.onload = () => {
        loaded++;
      };
      img.src = frames[k] || this.createFallbackFrame();
      imgs[k] = img;
    });
    this.characterImages.set(id, imgs);
  },

  createFallbackFrame() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4ecdc4';
    ctx.fillRect(2, 2, 12, 12);
    ctx.strokeStyle = '#2d3436';
    ctx.strokeRect(2, 2, 12, 12);
    return c.toDataURL();
  },

  bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'KeyS' && !e.repeat) {
        this.localPlayer.sitting = !this.localPlayer.sitting;
        if (this.localPlayer.sitting) {
          this.localPlayer.vx = 0;
          this.localPlayer.state = 'sit';
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Chat form
    const form = document.getElementById('chat-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const msg = input.value.trim();
      if (msg) {
        this.socket.emit('chat', msg);
        input.value = '';
      }
    });
  },

  bindSocket() {
    this.socket.on('lobby-state', (data) => {
      data.players.forEach(p => {
        this.otherPlayers.set(p.id, p);
        this.loadCharacterImages(p.id, p.character);
      });
      if (data.you) {
        this.localPlayer.x = data.you.x;
        this.localPlayer.y = data.you.y;
      }
      this.updatePlayerList();
    });

    this.socket.on('player-joined', (p) => {
      this.otherPlayers.set(p.id, p);
      this.loadCharacterImages(p.id, p.character);
      this.addChatSystem(`${p.username} joined the lobby`);
      this.updatePlayerList();
    });

    this.socket.on('player-left', (data) => {
      this.otherPlayers.delete(data.id);
      this.characterImages.delete(data.id);
      this.addChatSystem(`${data.username} left`);
      this.updatePlayerList();
    });

    this.socket.on('player-moved', (data) => {
      const p = this.otherPlayers.get(data.id);
      if (p) {
        p.x = data.x;
        p.y = data.y;
        p.vx = data.vx;
        p.vy = data.vy;
        p.facing = data.facing;
        p.state = data.state;
        p.frame = data.frame;
        p.sitting = data.sitting;
      }
    });

    this.socket.on('chat-message', (data) => {
      this.addChatLine(data.username, data.message);
      // Also show above head
      if (data.id === this.socket.id) {
        this.localPlayer.chatMessage = data.message;
        this.localPlayer.chatUntil = Date.now() + 6000;
      } else {
        const p = this.otherPlayers.get(data.id);
        if (p) {
          p.chatMessage = data.message;
          p.chatUntil = Date.now() + 6000;
        }
      }
    });
  },

  updatePlayerList() {
    const el = document.getElementById('player-list');
    let html = '<h3>Online</h3>';
    html += `<div>• ${this.localPlayer.username} (you)</div>`;
    for (const p of this.otherPlayers.values()) {
      html += `<div>• ${p.username}</div>`;
    }
    el.innerHTML = html;
  },

  addChatLine(name, msg) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-line';
    div.innerHTML = `<span class="name">${this.escape(name)}:</span> ${this.escape(msg)}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },

  addChatSystem(msg) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-line';
    div.style.color = '#888';
    div.textContent = msg;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  },

  escape(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  update(dt) {
    const p = this.localPlayer;
    if (!p.sitting) {
      // Horizontal
      p.vx = 0;
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
        p.vx = -this.moveSpeed;
        p.facing = -1;
      }
      if (this.keys['ArrowRight'] || this.keys['KeyD']) {
        p.vx = this.moveSpeed;
        p.facing = 1;
      }

      // Jump
      if ((this.keys['Space'] || this.keys['ArrowUp'] || this.keys['KeyW']) && p.onGround) {
        p.vy = this.jumpForce;
        p.onGround = false;
        p.state = 'jump';
      }
    }

    // Physics
    p.vy += this.gravity;
    p.x += p.vx;
    p.y += p.vy;

    // Ground
    const feet = p.y + 16;
    if (feet >= this.groundY) {
      p.y = this.groundY - 16;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    // World bounds
    p.x = Math.max(20, Math.min(this.worldWidth - 20, p.x));

    // State machine for animation
    if (p.sitting) {
      p.state = 'sit';
    } else if (!p.onGround) {
      p.state = p.vy < 0 ? 'jump' : 'fall';
    } else if (Math.abs(p.vx) > 0.1) {
      p.state = 'walk';
      this.animTimer += dt;
      if (this.animTimer > 150) {
        p.animFrame = (p.animFrame + 1) % 2;
        this.animTimer = 0;
      }
    } else {
      // Idle / blink
      if (Date.now() - (p.lastBlink || 0) > 3000 + Math.random() * 2000) {
        p.state = 'blink';
        p.lastBlink = Date.now();
        setTimeout(() => {
          if (p.state === 'blink') p.state = 'idle';
        }, 200);
      } else if (p.state !== 'blink') {
        p.state = 'idle';
      }
    }

    // Send updates ~20 times/sec
    if (Date.now() - this.lastUpdate > 50) {
      this.socket.emit('player-update', {
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        facing: p.facing,
        state: p.state,
        frame: p.animFrame,
        sitting: p.sitting
      });
      this.lastUpdate = Date.now();
    }
  },

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Sky gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(0.6, '#2d2d5a');
    grad.addColorStop(1, '#3d3d6b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 50) % w;
      const sy = (i * 89 + 30) % (h * 0.5);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Ground
    ctx.fillStyle = '#2a2a40';
    ctx.fillRect(0, this.groundY, w, h - this.groundY);
    ctx.fillStyle = '#3a3a5c';
    ctx.fillRect(0, this.groundY, w, 6);

    // Simple decorations
    ctx.fillStyle = '#4a4a6a';
    for (let i = 0; i < 8; i++) {
      const bx = 150 + i * 180;
      ctx.fillRect(bx, this.groundY - 40, 30, 40);
      ctx.fillStyle = '#5a5a7a';
      ctx.fillRect(bx - 5, this.groundY - 50, 40, 12);
      ctx.fillStyle = '#4a4a6a';
    }

    // Camera follow local player
    const camX = Math.max(0, Math.min(this.worldWidth - w, this.localPlayer.x - w / 2));

    ctx.save();
    ctx.translate(-camX, 0);

    // Draw others
    for (const p of this.otherPlayers.values()) {
      this.drawPlayer(p, false);
    }
    // Draw local
    this.drawPlayer(this.localPlayer, true);

    ctx.restore();
  },

  drawPlayer(p, isLocal) {
    const ctx = this.ctx;
    const imgs = this.characterImages.get(isLocal ? 'local' : p.id);
    if (!imgs) return;

    let frameKey = 'idle';
    if (p.state === 'walk') {
      frameKey = p.frame === 0 ? 'walk1' : 'walk2';
    } else if (p.state === 'jump') frameKey = 'jump';
    else if (p.state === 'fall') frameKey = 'fall';
    else if (p.state === 'sit') frameKey = 'sit';
    else if (p.state === 'blink') frameKey = 'blink';

    const img = imgs[frameKey] || imgs.idle;
    const scale = 3; // 16px * 3 = 48px on screen
    const dw = 16 * scale;
    const dh = 16 * scale;

    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.facing === -1) {
      ctx.scale(-1, 1);
      ctx.drawImage(img, -dw / 2, 0, dw, dh);
    } else {
      ctx.drawImage(img, -dw / 2, 0, dw, dh);
    }
    ctx.restore();

    // Name
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '12px sans-serif';
    const name = p.username || '???';
    const tw = ctx.measureText(name).width;
    ctx.fillRect(p.x - tw / 2 - 4, p.y - 18, tw + 8, 16);
    ctx.fillStyle = isLocal ? '#4ecdc4' : '#e8e8f0';
    ctx.textAlign = 'center';
    ctx.fillText(name, p.x, p.y - 6);

    // Chat bubble
    if (p.chatMessage && Date.now() < (p.chatUntil || 0)) {
      const msg = p.chatMessage;
      ctx.font = '13px sans-serif';
      const mw = Math.min(ctx.measureText(msg).width, 180);
      const bx = p.x;
      const by = p.y - 36;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      // simple rounded rect
      const pad = 6;
      ctx.fillRect(bx - mw / 2 - pad, by - 18, mw + pad * 2, 22);
      ctx.fillStyle = '#1a1a2e';
      ctx.textAlign = 'center';
      ctx.fillText(msg.length > 30 ? msg.slice(0, 28) + '…' : msg, bx, by - 2);
    }
  },

  loop(timestamp) {
    const dt = timestamp - (this._lastTime || timestamp);
    this._lastTime = timestamp;

    this.update(dt);
    this.draw();

    requestAnimationFrame((t) => this.loop(t));
  }
};
