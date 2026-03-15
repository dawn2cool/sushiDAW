/*
  mascot.js — SushiDAW pixel art mascot
  The sushi roll character lives in the bottom-right corner.
  It reacts to everything happening in the DAW.
*/

const Mascot = (() => {

  // ── State ─────────────────────────────────────────────────
  let currentState = 'idle';
  let bubbleTimer  = null;
  let idleTimer    = null;
  let bounceTimer  = null;
  let isVisible    = true;

  // ── Messages per state ────────────────────────────────────
  const MESSAGES = {
    idle: [
      'ready to roll?',
      'add some beats!',
      'click a cell ↑',
      'try randomise!',
      'what will you cook?',
      'im hungry...',
      'rice + nori ready!',
      'bpm looking good',
    ],
    playing: [
      "let's go!!",
      'yummy rhythms!',
      'i can feel it!',
      'cook it up!!',
      'so good!',
      'the beat drops!',
      'vibing hard rn',
      'chefs kiss 🤌',
    ],
    cell_on: [
      'nice one!',
      'ooh good pick',
      'yes chef!',
      'tasty beat!',
      'more more more!',
    ],
    cell_off: [
      'aw gone...',
      'maybe later',
      'saving for later?',
    ],
    ingredient_add: [
      'new ingredient!!',
      'the more the yummier',
      'ooh what is that?',
      'stacking up!',
    ],
    randomise: [
      'spicy choice!',
      'oooh shake it up!',
      'bold! i like it!',
      'chaos cooking!',
    ],
    clear: [
      'fresh start!',
      'clean slate!',
      'back to rice...',
      'ah, silence.',
    ],
    finish: [
      'rolling rolling!!',
      'here we gooooo!',
      'masterpiece!',
      'its happening!!',
    ],
    roll_done: [
      'DELICIOUS!!!!',
      'S-RANK!!! 🌟',
      'i want a bite!',
      'art + food!!',
    ],
    gemini: [
      'AI says hi!',
      'ghost notes!',
      'try the hints!',
    ],
    save: [
      'saved forever!',
      'great beat!',
      'cloud storage!',
    ],
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ── DOM ───────────────────────────────────────────────────
  function getEl()      { return document.getElementById('mascot-container'); }
  function getImg()     { return document.getElementById('mascot-img'); }
  function getBubble()  { return document.getElementById('mascot-bubble'); }

  // ── Core show/hide bubble ─────────────────────────────────
  function say(msg, duration = 3200) {
    const bubble = getBubble();
    if (!bubble) return;

    clearTimeout(bubbleTimer);
    bubble.textContent = msg;
    bubble.classList.remove('hide');
    bubble.classList.add('show');

    bubbleTimer = setTimeout(() => {
      bubble.classList.remove('show');
      bubble.classList.add('hide');
    }, duration);
  }

  // ── Switch mascot image + state ───────────────────────────
  function setState(state) {
    const img = getImg();
    const container = getEl();
    if (!img || !container) return;

    currentState = state;

    // Pick image based on state
    const useLeft = ['playing', 'finish', 'roll_done', 'excited'].includes(state);
    img.src = useLeft ? 'mascot_left.png' : 'mascot_right.jpg';

    // Remove all state classes, add current
    container.className = 'mascot-container mascot-' + state;
  }

  // ── Bounce the mascot briefly ─────────────────────────────
  function bounce() {
    const img = getImg();
    if (!img) return;
    clearTimeout(bounceTimer);
    img.classList.add('mascot-bounce');
    bounceTimer = setTimeout(() => img.classList.remove('mascot-bounce'), 500);
  }

  // ── Idle cycling ─────────────────────────────────────────
  function startIdleCycle() {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (currentState === 'idle') {
        say(pick(MESSAGES.idle), 3000);
      }
    }, 8000);
  }

  // ── Public event hooks ────────────────────────────────────

  function onPlay() {
    setState('playing');
    say(pick(MESSAGES.playing), 4000);
    bounce();
  }

  function onStop() {
    setState('idle');
    say('paused!', 2000);
  }

  function onCellOn() {
    if (currentState !== 'playing') setState('idle');
    say(pick(MESSAGES.cell_on), 1800);
    bounce();
  }

  function onCellOff() {
    say(pick(MESSAGES.cell_off), 1600);
  }

  function onIngredientAdd(name) {
    say((name ? name + '!' : pick(MESSAGES.ingredient_add)), 2400);
    bounce();
  }

  function onRandomise() {
    setState(currentState === 'playing' ? 'playing' : 'idle');
    say(pick(MESSAGES.randomise), 2800);
    bounce();
  }

  function onClear() {
    say(pick(MESSAGES.clear), 2400);
  }

  function onFinish() {
    setState('finish');
    say(pick(MESSAGES.finish), 5000);
    bounce();
  }

  function onRollDone() {
    setState('roll_done');
    say(pick(MESSAGES.roll_done), 5000);
    bounce();
  }

  function onGemini() {
    say(pick(MESSAGES.gemini), 2800);
  }

  function onSave() {
    say(pick(MESSAGES.save), 2200);
    bounce();
  }

  function onLogin(username) {
    say('hey ' + (username || 'chef') + '!', 3000);
    bounce();
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    // Build the DOM
    const existing = document.getElementById('mascot-container');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.id        = 'mascot-container';
    container.className = 'mascot-container mascot-idle';

    container.innerHTML = `
      <div class="mascot-bubble-wrap">
        <div id="mascot-bubble" class="mascot-bubble"></div>
        <div class="mascot-bubble-tail"></div>
      </div>
      <img id="mascot-img" class="mascot-img" src="mascot_right.jpg" alt="sushi mascot"/>
    `;

    // Click to toggle visibility / get a message
    container.addEventListener('click', () => {
      say(pick(MESSAGES[currentState] || MESSAGES.idle), 2600);
      bounce();
    });

    document.body.appendChild(container);

    // Say hello on load
    setTimeout(() => say('ready to roll?', 3000), 1200);
    startIdleCycle();

    // Greet logged-in user
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      const u = Auth.getUser();
      setTimeout(() => onLogin(u?.producerTag || u?.username), 2000);
    }
  }

  return {
    init,
    onPlay,
    onStop,
    onCellOn,
    onCellOff,
    onIngredientAdd,
    onRandomise,
    onClear,
    onFinish,
    onRollDone,
    onGemini,
    onSave,
    onLogin,
    say,
    bounce,
  };
})();

window.Mascot = Mascot;