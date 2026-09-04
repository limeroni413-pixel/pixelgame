// Simple 16x16 pixel art editor for character frames
const PIXEL_SIZE = 16;
const SCALE = 20; // canvas is 320x320

const Editor = {
  currentFrame: 'idle',
  frames: {
    idle: null,
    walk1: null,
    walk2: null,
    jump: null,
    fall: null,
    sit: null,
    blink: null
  },
  pixels: null, // current frame 16x16 array of color strings or null
  tool: 'pencil',
  color: '#ff6b6b',
  isDrawing: false,

  init() {
    this.canvas = document.getElementById('pixel-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.preview = document.getElementById('preview-canvas');
    this.pctx = this.preview.getContext('2d');

    this.pixels = this.createEmptyFrame();
    this.frames.idle = this.cloneFrame(this.pixels);

    this.bindEvents();
    this.draw();
    this.drawPreview();
  },

  createEmptyFrame() {
    const f = [];
    for (let y = 0; y < PIXEL_SIZE; y++) {
      f[y] = [];
      for (let x = 0; x < PIXEL_SIZE; x++) {
        f[y][x] = null;
      }
    }
    return f;
  },

  cloneFrame(src) {
    return src.map(row => row.slice());
  },

  bindEvents() {
    // Frame buttons
    document.querySelectorAll('.frame-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveCurrentFrame();
        document.querySelectorAll('.frame-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFrame = btn.dataset.frame;
        this.pixels = this.frames[this.currentFrame]
          ? this.cloneFrame(this.frames[this.currentFrame])
          : this.createEmptyFrame();
        this.draw();
        this.drawPreview();
      });
    });

    // Tools
    document.getElementById('tool-pencil').onclick = () => this.setTool('pencil');
    document.getElementById('tool-eraser').onclick = () => this.setTool('eraser');
    document.getElementById('tool-fill').onclick = () => this.setTool('fill');
    document.getElementById('clear-frame').onclick = () => {
      this.pixels = this.createEmptyFrame();
      this.draw();
      this.drawPreview();
    };
    document.getElementById('copy-from-idle').onclick = () => {
      if (this.frames.idle) {
        this.pixels = this.cloneFrame(this.frames.idle);
        this.draw();
        this.drawPreview();
      }
    };

    document.getElementById('color-picker').oninput = (e) => {
      this.color = e.target.value;
    };

    // Palette
    document.querySelectorAll('.swatch').forEach(s => {
      s.addEventListener('click', () => {
        this.color = s.dataset.color;
        document.getElementById('color-picker').value = this.color;
      });
    });

    // Drawing
    this.canvas.addEventListener('mousedown', (e) => this.onPointer(e, true));
    this.canvas.addEventListener('mousemove', (e) => this.onPointer(e, false));
    this.canvas.addEventListener('mouseup', () => { this.isDrawing = false; });
    this.canvas.addEventListener('mouseleave', () => { this.isDrawing = false; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.onPointer(e.touches[0], true);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.onPointer(e.touches[0], false);
    }, { passive: false });
    this.canvas.addEventListener('touchend', () => { this.isDrawing = false; });
  },

  setTool(t) {
    this.tool = t;
    document.querySelectorAll('.tool').forEach(b => b.classList.remove('active'));
    if (t === 'pencil') document.getElementById('tool-pencil').classList.add('active');
    if (t === 'eraser') document.getElementById('tool-eraser').classList.add('active');
    if (t === 'fill') document.getElementById('tool-fill').classList.add('active');
  },

  getPixelCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / SCALE);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / SCALE);
    return { x: Math.max(0, Math.min(PIXEL_SIZE - 1, x)), y: Math.max(0, Math.min(PIXEL_SIZE - 1, y)) };
  },

  onPointer(e, isDown) {
    const { x, y } = this.getPixelCoords(e);
    const isRight = e.button === 2;

    if (isDown) {
      this.isDrawing = true;
      if (this.tool === 'fill') {
        this.floodFill(x, y, isRight ? null : this.color);
      } else {
        this.setPixel(x, y, isRight || this.tool === 'eraser' ? null : this.color);
      }
    } else if (this.isDrawing && this.tool !== 'fill') {
      this.setPixel(x, y, isRight || this.tool === 'eraser' ? null : this.color);
    }
    this.draw();
    this.drawPreview();
  },

  setPixel(x, y, color) {
    this.pixels[y][x] = color;
  },

  floodFill(sx, sy, newColor) {
    const target = this.pixels[sy][sx];
    if (target === newColor) return;
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || x >= PIXEL_SIZE || y < 0 || y >= PIXEL_SIZE) continue;
      if (this.pixels[y][x] !== target) continue;
      this.pixels[y][x] = newColor;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  },

  draw() {
    this.ctx.fillStyle = '#0a0a12';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // grid
    this.ctx.strokeStyle = '#1f1f30';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= PIXEL_SIZE; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i * SCALE, 0);
      this.ctx.lineTo(i * SCALE, PIXEL_SIZE * SCALE);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i * SCALE);
      this.ctx.lineTo(PIXEL_SIZE * SCALE, i * SCALE);
      this.ctx.stroke();
    }

    for (let y = 0; y < PIXEL_SIZE; y++) {
      for (let x = 0; x < PIXEL_SIZE; x++) {
        const c = this.pixels[y][x];
        if (c) {
          this.ctx.fillStyle = c;
          this.ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
        }
      }
    }
  },

  drawPreview() {
    this.pctx.fillStyle = '#0a0a12';
    this.pctx.fillRect(0, 0, 64, 64);
    const s = 4;
    for (let y = 0; y < PIXEL_SIZE; y++) {
      for (let x = 0; x < PIXEL_SIZE; x++) {
        const c = this.pixels[y][x];
        if (c) {
          this.pctx.fillStyle = c;
          this.pctx.fillRect(x * s, y * s, s, s);
        }
      }
    }
  },

  saveCurrentFrame() {
    this.frames[this.currentFrame] = this.cloneFrame(this.pixels);
  },

  getCharacterData() {
    this.saveCurrentFrame();
    // Convert frames to base64 images for easy network transfer
    const frameImages = {};
    for (const key of Object.keys(this.frames)) {
      frameImages[key] = this.frameToDataURL(this.frames[key] || this.createEmptyFrame());
    }
    return {
      name: document.getElementById('char-name').value || 'Pixel Friend',
      width: PIXEL_SIZE,
      height: PIXEL_SIZE,
      frames: frameImages
    };
  },

  frameToDataURL(pixels) {
    const off = document.createElement('canvas');
    off.width = PIXEL_SIZE;
    off.height = PIXEL_SIZE;
    const octx = off.getContext('2d');
    for (let y = 0; y < PIXEL_SIZE; y++) {
      for (let x = 0; x < PIXEL_SIZE; x++) {
        const c = pixels[y][x];
        if (c) {
          octx.fillStyle = c;
          octx.fillRect(x, y, 1, 1);
        }
      }
    }
    return off.toDataURL('image/png');
  },

  // Load existing character frames (from server)
  loadCharacter(char) {
    if (!char || !char.frames) return;
    document.getElementById('char-name').value = char.name || 'My Pixel';
    // We keep frames as dataURLs; for editing we would need to decode,
    // but for simplicity if user already has one they can re-edit later.
    // For now just use the saved images in game.
  }
};

// Default simple character generator
function createDefaultCharacter() {
  const colors = {
    body: '#4ecdc4',
    outline: '#2d3436',
    eye: '#2d3436',
    cheek: '#fd79a8'
  };

  function makeFrame(drawFn) {
    const pixels = [];
    for (let y = 0; y < 16; y++) {
      pixels[y] = [];
      for (let x = 0; x < 16; x++) pixels[y][x] = null;
    }
    drawFn(pixels);
    // convert to dataURL
    const off = document.createElement('canvas');
    off.width = 16; off.height = 16;
    const ctx = off.getContext('2d');
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (pixels[y][x]) {
          ctx.fillStyle = pixels[y][x];
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return off.toDataURL('image/png');
  }

  const idle = makeFrame(p => {
    // body
    for (let y = 4; y < 13; y++) for (let x = 4; x < 12; x++) p[y][x] = colors.body;
    // outline
    for (let x = 4; x < 12; x++) { p[3][x] = colors.outline; p[13][x] = colors.outline; }
    for (let y = 4; y < 13; y++) { p[y][3] = colors.outline; p[y][12] = colors.outline; }
    // eyes
    p[6][6] = colors.eye; p[6][9] = colors.eye;
    // cheeks
    p[8][5] = colors.cheek; p[8][10] = colors.cheek;
  });

  const walk1 = makeFrame(p => {
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) p[y][x] = colors.body;
    for (let x = 4; x < 12; x++) { p[3][x] = colors.outline; p[12][x] = colors.outline; }
    for (let y = 4; y < 12; y++) { p[y][3] = colors.outline; p[y][12] = colors.outline; }
    p[6][6] = colors.eye; p[6][9] = colors.eye;
    // legs shifted
    p[12][5] = colors.body; p[13][5] = colors.outline;
    p[12][10] = colors.body; p[13][10] = colors.outline;
  });

  const walk2 = makeFrame(p => {
    for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) p[y][x] = colors.body;
    for (let x = 4; x < 12; x++) { p[3][x] = colors.outline; p[12][x] = colors.outline; }
    for (let y = 4; y < 12; y++) { p[y][3] = colors.outline; p[y][12] = colors.outline; }
    p[6][6] = colors.eye; p[6][9] = colors.eye;
    p[12][6] = colors.body; p[13][6] = colors.outline;
    p[12][9] = colors.body; p[13][9] = colors.outline;
  });

  const jump = makeFrame(p => {
    for (let y = 2; y < 11; y++) for (let x = 4; x < 12; x++) p[y][x] = colors.body;
    for (let x = 4; x < 12; x++) { p[1][x] = colors.outline; p[11][x] = colors.outline; }
    for (let y = 2; y < 11; y++) { p[y][3] = colors.outline; p[y][12] = colors.outline; }
    p[4][6] = colors.eye; p[4][9] = colors.eye;
    // arms up
    p[3][2] = colors.body; p[3][13] = colors.body;
  });

  const fall = makeFrame(p => {
    for (let y = 5; y < 14; y++) for (let x = 4; x < 12; x++) p[y][x] = colors.body;
    for (let x = 4; x < 12; x++) { p[4][x] = colors.outline; p[14][x] = colors.outline; }
    for (let y = 5; y < 14; y++) { p[y][3] = colors.outline; p[y][12] = colors.outline; }
    p[7][6] = colors.eye; p[7][9] = colors.eye;
  });

  const sit = makeFrame(p => {
    for (let y = 7; y < 14; y++) for (let x = 3; x < 13; x++) p[y][x] = colors.body;
    for (let x = 3; x < 13; x++) { p[6][x] = colors.outline; p[14][x] = colors.outline; }
    for (let y = 7; y < 14; y++) { p[y][2] = colors.outline; p[y][13] = colors.outline; }
    p[9][5] = colors.eye; p[9][10] = colors.eye;
  });

  const blink = makeFrame(p => {
    for (let y = 4; y < 13; y++) for (let x = 4; x < 12; x++) p[y][x] = colors.body;
    for (let x = 4; x < 12; x++) { p[3][x] = colors.outline; p[13][x] = colors.outline; }
    for (let y = 4; y < 13; y++) { p[y][3] = colors.outline; p[y][12] = colors.outline; }
    // closed eyes
    p[6][6] = colors.outline; p[6][7] = colors.outline;
    p[6][8] = colors.outline; p[6][9] = colors.outline;
  });

  return {
    name: 'Default Buddy',
    width: 16,
    height: 16,
    frames: { idle, walk1, walk2, jump, fall, sit, blink }
  };
}
