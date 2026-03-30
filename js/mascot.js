// mascot state and ui logic

const Mascot = (() => {

  // state
  let currentState = 'idle';
  let bubbleTimer  = null;
  let idleTimer    = null;
  let bounceTimer  = null;
  let isVisible    = true;

  // messages per state
  const MESSAGES = {
    idle: [
      'ready to roll?',
      'add some beats',
      'click a cell',
      'try randomise',
      'what will you cook?',
      'im hungry...',
      'rice and nori ready',
      'bpm looking good',
    ],
    playing: [
      'lets go',
      'yummy rhythms',
      'i can feel it',
      'cook it up',
      'so good',
      'the beat drops',
      'vibing hard rn',
      'chefs kiss',
    ],
    cell_on: [
      'nice one',
      'good pick',
      'yes chef',
      'tasty beat',
      'more more more',
    ],
    cell_off: [
      'aw gone',
      'maybe later',
      'saving for later?',
    ],
    ingredient_add: [
      'new ingredient',
      'the more the yummier',
      'what is that?',
      'stacking up',
    ],
    randomise: [
      'spicy choice',
      'shake it up',
      'bold',
      'chaos cooking',
    ],
    clear: [
      'fresh start',
      'clean slate',
      'back to rice',
      'ah, silence',
    ],
    finish: [
      'rolling rolling',
      'here we go',
      'masterpiece',
      'its happening',
    ],
    roll_done: [
      'delicious',
      's-rank',
      'i want a bite',
      'art and food',
    ],
    gemini: [
      'ai says hi',
      'ghost notes',
      'try the hints',
    ],
    save: [
      'saved forever',
      'great beat',
      'cloud storage',
    ],
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // dom references
  function getEl()      { return document.getElementById('mascot-container'); }
  function getImg()     { return document.getElementById('mascot-img'); }
  function getBubble()  { return document.getElementById('mascot-bubble'); }

  // core show/hide bubble
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

  // switch mascot image and state
  function setState(state) {
    const img = getImg();
    const container = getEl();
    if (!img || !container) return;

    currentState = state;

    // pick image based on state
    const useLeft = ['playing', 'finish', 'roll_done', 'excited'].includes(state);
    img.src = useLeft ? 'mascot_left.png' : 'mascot_right.jpg';

    // remove all state classes, add current
    container.className = 'mascot-container mascot-' + state;
  }

  // bounce the mascot briefly
  function bounce() {
    const img = getImg();
    if (!img) return;
    clearTimeout(bounceTimer);
    img.classList.add('mascot-bounce');
    bounceTimer = setTimeout(() => img.classList.remove('mascot-bounce'), 500);
  }

  // idle cycling
  function startIdleCycle() {
    clearInterval(idleTimer);
    idleTimer = setInterval(() => {
      if (currentState === 'idle') {
        say(pick(MESSAGES.idle), 3000);
      }
    }, 8000);
  }

  // public event hooks
  function onPlay() {
    setState('playing');
    say(pick(MESSAGES.playing), 4000);
    bounce();
  }

  function onStop() {
    setState('idle');
    say('paused', 2000);
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
    say((name ? name : pick(MESSAGES.ingredient_add)), 2400);
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
    say('hey ' + (username || 'chef'), 3000);
    bounce();
  }

  // init
  function init() {
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

    container.addEventListener('click', () => {
      say(pick(MESSAGES[currentState] || MESSAGES.idle), 2600);
      bounce();
    });

    document.body.appendChild(container);

    setTimeout(() => say('ready to roll?', 3000), 1200);
    startIdleCycle();

    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      const u = Auth.getUser();
      setTimeout(() => onLogin(u?.producerTag || u?.username), 2000);
    }
  }

  return {
    init, onPlay, onStop, onCellOn, onCellOff,
    onIngredientAdd, onRandomise, onClear, onFinish,
    onRollDone, onGemini, onSave, onLogin, say, bounce,
    updateMood(isHappy) {
        if (isHappy) setState('playing');
        else setState('idle');
    }
  };
})();

window.Mascot = Mascot;
