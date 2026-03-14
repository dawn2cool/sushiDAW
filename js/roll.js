/*
  roll.js — SushiDAW sushi roll reveal animation. (Cozy Indie Game Style)
*/

const Roll = (() => {
  let raf = null;
  let startTime = null;
  const DURATION = 4800; // Slowed down to 4.8s for a cozier, relaxed pace

  /* Cozy, flat-ish colors for the cross-section */
  const ING_VISUALS = {
    'cream cheese': { colors: ['#FFF9E8','#E8DCC8'], label: 'cream cheese' },
    'salmon':       { colors: ['#FF8C60','#E05A32'], label: 'salmon'       },
    'tuna':         { colors: ['#D63242','#A61B28'], label: 'tuna'         },
    'avocado':      { colors: ['#82D068','#58A042'], label: 'avocado'      },
    'cucumber':     { colors: ['#B4E8A8','#68C45A'], label: 'cucumber'     },
    'egg':          { colors: ['#FFD242','#E6A212'], label: 'egg'          },
    'prawn':        { colors: ['#FF9A7B','#E86A44'], label: 'prawn'        },
    'wasabi':       { colors: ['#78B868','#4A863A'], label: 'wasabi'       },
  };

  const SUSHI_NAMES = [
    'the chef\'s special', 'midnight roll', 'sunset maki',
    'the big wave', 'sakura roll', 'dragon kiss',
    'umami bomb', 'autumn harvest', 'the deep cut',
    'spicy surprise', 'golden crunch', 'the garden gate',
  ];

  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
  function clamp(v,a,b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a,b,t)  { return a + (b-a)*t; }
  function phaseT(t, s, e) { return clamp((t - s) / (e - s), 0, 1); }

  /* Helper to draw imperfect, cute, wobbly circles */
  function drawWobblyCircle(ctx, cx, cy, r, segments = 10, wobbleAmount = 3) {
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      // Add pseudo-random wobble based on angle
      const wobble = Math.sin(angle * 3) * wobbleAmount + Math.cos(angle * 5) * (wobbleAmount * 0.5);
      const x = cx + (r + wobble) * Math.cos(angle);
      const y = cy + (r + wobble) * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawFrame(canvas, ctx, activeIngredients, t) {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2 - 20;

    ctx.clearRect(0, 0, W, H);

    /* ── Background parchment ── */
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--surface2').trim() || '#F4EDD8';
    ctx.fillRect(0, 0, W, H);

    // Set indie-game chunky line styles globally
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    /* ─── PHASE 1: ingredients slide in lazily (0 → 0.40) ─── */
    const p1 = phaseT(t, 0, 0.40);
    if (p1 > 0 && p1 < 1.0 || t < 0.41) {
      const numIng = activeIngredients.length;
      activeIngredients.forEach((ing, i) => {
        const iv = ING_VISUALS[ing] || { colors: ['#E8DCC8','#C8A880'] };
        const delay = i / Math.max(numIng, 1) * 0.3;
        const progress = clamp((p1 - delay / 0.40) / 0.7, 0, 1);
        const ep = easeOutBack(progress);

        const stripH = 30;
        const targetY = cy - (numIng * (stripH + 6)) / 2 + i * (stripH + 6);
        const fromX   = i % 2 === 0 ? -200 : W + 200;
        const toX     = cx - 110;
        const x = lerp(fromX, toX, ep);

        ctx.fillStyle = iv.colors[0];
        ctx.strokeStyle = '#3E2723'; // Warm dark brown outline
        ctx.lineWidth = 4;

        ctx.beginPath();
        ctx.roundRect(x, targetY, 220, stripH, 12);
        ctx.fill();
        ctx.stroke();

        /* label */
        if (ep > 0.5) {
          ctx.fillStyle = '#3E2723';
          ctx.font = `bold 13px JetBrains Mono, monospace`;
          ctx.textAlign = 'left';
          ctx.fillText(iv.label, x + 14, targetY + stripH * 0.68);
        }
      });
    }

    /* ─── PHASE 2 & 3: seaweed wraps gently (0.35 → 0.75) ─── */
    const p3 = phaseT(t, 0.35, 0.75);
    if (p3 > 0 && t < 0.90) {
      const ep3 = easeInOut(p3);
      const rollR = 110;

      const sweepAngle = ep3 * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rollR, -Math.PI / 2, -Math.PI / 2 + sweepAngle);
      ctx.arc(cx, cy, rollR - 16, -Math.PI / 2 + sweepAngle, -Math.PI / 2, true);
      ctx.closePath();

      ctx.fillStyle = '#1B4D2E'; // Seaweed green
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0F2C1A';
      ctx.stroke();
    }

    /* ─── PHASE 4: cozy cross-section slice appears (0.70 → 0.96) ─── */
    const p4 = phaseT(t, 0.70, 0.96);
    if (p4 > 0) {
      const ep4    = easeOutBack(clamp(p4, 0, 1));
      const rollR  = 110;
      const sliceX = lerp(cx + 200, cx, ep4); // slides into center

      /* shadow */
      ctx.fillStyle = 'rgba(62, 39, 35, 0.15)';
      ctx.beginPath();
      ctx.ellipse(sliceX + 4, cy + rollR + 10, rollR * 0.9, 15, 0, 0, Math.PI * 2);
      ctx.fill();

      /* SEAWEED outer ring (wobbly) */
      drawWobblyCircle(ctx, sliceX, cy, rollR, 14, 4);
      ctx.fillStyle = '#1B4D2E';
      ctx.fill();
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#0F2C1A';
      ctx.stroke();

      /* RICE inner layer (wobbly and textured) */
      drawWobblyCircle(ctx, sliceX, cy, rollR - 12, 12, 4);
      ctx.fillStyle = '#FFFDF4';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#D4CBB3';
      ctx.stroke();

      /* Cute little rice grains around the edge */
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#E6DECC';
      ctx.lineWidth = 2;
      for (let ai = 0; ai < 14; ai++) {
        const ang = (ai / 14) * Math.PI * 2;
        const rad = rollR - 26;
        const gx  = sliceX + rad * Math.cos(ang);
        const gy  = cy + rad * Math.sin(ang);
        ctx.beginPath();
        // Give grains slight randomized rotation
        ctx.ellipse(gx, gy, 7, 4, ang + 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      /* INGREDIENT blobs (instead of sharp pizza slices) */
      const numIng = activeIngredients.length;
      activeIngredients.forEach((ing, i) => {
        const iv  = ING_VISUALS[ing] || { colors: ['#E8DCC8','#C8A880'] };
        const a1  = (i / numIng) * Math.PI * 2;
        const dist = 24; // Push out from center slightly
        const blobX = sliceX + dist * Math.cos(a1);
        const blobY = cy + dist * Math.sin(a1);

        drawWobblyCircle(ctx, blobX, blobY, 32, 8, 5); // Chunky ingredient blob
        ctx.fillStyle = iv.colors[0];
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = iv.colors[1];
        ctx.stroke();
      });

      /* Cute optional face on the center of the roll if it's completely done */
      if (p4 > 0.9) {
          ctx.fillStyle = '#3E2723';
          // Left eye
          ctx.beginPath(); ctx.arc(sliceX - 12, cy - 4, 3, 0, Math.PI*2); ctx.fill();
          // Right eye
          ctx.beginPath(); ctx.arc(sliceX + 12, cy - 4, 3, 0, Math.PI*2); ctx.fill();
          // Little smile
          ctx.beginPath();
          ctx.arc(sliceX, cy + 2, 5, 0.2, Math.PI - 0.2);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#3E2723';
          ctx.stroke();
          // Blushes
          ctx.fillStyle = 'rgba(255, 100, 100, 0.4)';
          ctx.beginPath(); ctx.arc(sliceX - 18, cy + 2, 4, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.arc(sliceX + 18, cy + 2, 4, 0, Math.PI*2); ctx.fill();
      }
    }

    /* ─── PHASE 5: cozy plate slides up (0.85 → 1.0) ─── */
    const p5 = phaseT(t, 0.85, 1.0);
    if (p5 > 0) {
      const ep5 = easeOutBack(p5);
      const plateY = lerp(H + 80, cy + 130, ep5);

      /* Plate */
      ctx.beginPath();
      ctx.ellipse(cx, plateY, 150, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#F8F4F0';
      ctx.fill();
      ctx.strokeStyle = '#C8B8A0';
      ctx.lineWidth = 5;
      ctx.stroke();

      /* Plate rim detail */
      ctx.beginPath();
      ctx.ellipse(cx, plateY - 6, 135, 18, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200,184,160,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* Cozy Title text while rolling */
    if (t < 0.85) {
      const wobX = Math.sin(t * 10) * 2;
      ctx.font = 'bold 20px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(62, 39, 35, ${clamp((0.85 - t) / 0.85, 0, 0.8)})`;

      let text = 'preparing the mat...';
      if (t > 0.25) text = 'gathering ingredients...';
      if (t > 0.50) text = 'rolling it up tight...';
      if (t > 0.70) text = 'slicing the maki...';

      ctx.fillText(text, cx + wobX, H - 35);
    }
  }

  function animate(canvas, ctx, activeIngredients) {
    cancelAnimationFrame(raf);
    startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / DURATION, 1);

      drawFrame(canvas, ctx, activeIngredients, t);

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        showFooter(activeIngredients);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function showFooter(activeIngredients) {
    const title = document.getElementById('roll-modal-title');
    title.textContent = 'your roll is ready!';

    const name  = SUSHI_NAMES[Math.floor(Math.random() * SUSHI_NAMES.length)];
    document.getElementById('roll-name').textContent = name;
    document.getElementById('roll-ingredients').textContent =
      [...new Set(activeIngredients)].join(' · ') || 'plain rice roll';

    const footer = document.getElementById('roll-footer');
    footer.style.display = 'flex';
    footer.style.flexDirection = 'column';
    footer.style.alignItems    = 'center';
    footer.style.gap           = '8px';
  }

  return {
    trigger() {
      const grid = getGrid();
      const activeIngredients = [];
      grid.forEach((row, r) => {
        if (row.some(Boolean)) {
          const inst = channelInstances[r];
          if (inst) activeIngredients.push(inst.def.name);
        }
      });

      if (activeIngredients.length === 0) {
        activeIngredients.push('rice'); // always have rice
      }

      if (playing) App.stop?.();

      const overlay = document.getElementById('roll-overlay');
      const footer  = document.getElementById('roll-footer');
      const title   = document.getElementById('roll-modal-title');

      title.textContent = 'making your sushi...';
      footer.style.display = 'none';
      overlay.classList.add('active');

      const canvas = document.getElementById('roll-canvas');
      const ctx    = canvas.getContext('2d');
      const size   = Math.min(420, window.innerWidth * 0.9);
      canvas.width  = size;
      canvas.height = size;

      animate(canvas, ctx, activeIngredients);
    },

    close() {
      cancelAnimationFrame(raf);
      document.getElementById('roll-overlay').classList.remove('active');
    }
  };
})();