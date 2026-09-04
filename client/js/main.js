// Main entry – handles screens & auth
const API = ''; // same origin

let currentUser = null;
let currentCharacter = null;
let socket = null;

document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.getElementById('tab-login').onclick = () => switchTab('login');
  document.getElementById('tab-register').onclick = () => switchTab('register');

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const isLogin = document.getElementById('tab-login').classList.contains('active');
    const errEl = document.getElementById('auth-error');
    errEl.textContent = '';

    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const res = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');

      currentUser = data.username;
      currentCharacter = data.character || null;

      // Go to editor (or skip if they already have a character)
      showScreen('editor-screen');
      Editor.init();

      if (currentCharacter) {
        // Optional: could load into editor, but for now just offer default path
        document.getElementById('char-name').value = currentCharacter.name || currentUser;
      }
    } catch (err) {
      errEl.textContent = err.message;
    }
  };

  document.getElementById('save-character').onclick = async () => {
    const char = Editor.getCharacterData();
    char.username = currentUser;

    // Save to server
    try {
      await fetch(API + '/api/save-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, character: char })
      });
    } catch (e) {
      console.warn('Could not save character', e);
    }

    enterGame(char);
  };

  document.getElementById('skip-editor').onclick = () => {
    const char = createDefaultCharacter();
    char.name = currentUser || 'Buddy';
    enterGame(char);
  };
});

function switchTab(which) {
  document.getElementById('tab-login').classList.toggle('active', which === 'login');
  document.getElementById('tab-register').classList.toggle('active', which === 'register');
  document.getElementById('auth-btn').textContent = which === 'login' ? 'Login' : 'Register';
  document.getElementById('auth-error').textContent = '';
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function enterGame(character) {
  character.username = currentUser;
  showScreen('game-screen');

  // Connect socket
  socket = io({
    transports: ['websocket', 'polling']
  });

  socket.on('connect', () => {
    console.log('Connected to server');
    Game.init(socket, character);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error', err);
    alert('Could not connect to multiplayer server. Is it running?');
  });
}
