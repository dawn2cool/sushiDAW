/*
  roll.js — SushiDAW sushi roll reveal animation.

  When user clicks "finish roll":
  1. Modal opens, canvas animates
  2. Phase 1 (0–0.8s): ingredient strips slide in from each side, overlapping
  3. Phase 2 (0.8–1.6s): they compress and curl into a cylinder
  4. Phase 3 (1.6–2.6s): seaweed wraps around with a satisfying squish
  5. Phase 4 (2.6–3.4s): cross-section slice appears, revealing ingredient layers
  6. Phase 5 (3.4s+): "plate" slides in, roll sits on it, footer appears
*/

const Roll = (() => {
  let raf = null;
  let startTime = null;
  const DURATION = 3600; // ms total for animation

  /* Ingredient visual data — colors for the cross-section rings */
  const ING_VISUALS = {
    'cream cheese': { colors: ['#FFF9E8','#F5E8C0'], label: 'cream cheese' },
    'salmon':       { colors: ['#FF9C70','#F0603C'], label: 'salmon'       },
    'tuna':         { colors: ['#C41E3A','#940C18'], label: 'tuna'         },
    'avocado':      { colors: ['#68C858','#48A838'], label: 'avocado'      },
    'cucumber':     { colors: ['#58C068','#36A850'], label: 'cucumber'     },
    'egg':          { colors: ['#FFCC22','#FF9900'], label: 'egg'          },
    'prawn':        { colors: ['#F07050','#D84830'], label: 'prawn'        },
    'seaweed':      { colors: ['#1A5830','#0C3A1C'], label: 'seaweed'      },
  };

  const SUSHI_NAMES = [
    'The Chef\'s Special', 'Midnight Roll', 'Sunset Maki',
    'The Big Wave', 'Sakura Roll', 'Dragon Kiss',
    'Umami Bomb', 'Autumn Harvest', 'The Deep Cut',
    'Spicy Surprise', 'Golden Crunch', 'The Garden Gate',
  ];

  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2; }
  function easeOut(t)   { return 1 - Math.pow(1-t, 3); }
  function clamp(v,a,b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a,b,t)  { return a + (b-a)*t; }
  function phaseT(t, s, e) { return clamp((t - s) / (e - s), 0, 1); }

  /* Draw a wobbly rounded rect (GPGP style) */
  function wobbleRect(ctx, x, y, w, h, r, wobble = 2) {
    ctx.beginPath();
    ctx.moveTo(x + r, y + wobble * Math.sin(0));
    ctx.quadraticCurveTo(x + w * 0.5, y - wobble, x + w - r, y + wobble * Math.sin(1));
    ctx.quadraticCurveTo(x + w + wobble, y + h * 0.5, x + w - wobble * Math.sin(2), y + h - r);
    ctx.quadraticCurveTo(x + w * 0.5, y + h + wobble, x + r, y + h - wobble * Math.sin(3));
    ctx.quadraticCurveTo(x - wobble, y + h * 0.5, x + wobble * Math.sin(4), y + r);
    ctx.closePath();
  }

  function drawFrame(canvas, ctx, activeIngredients, t) {
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2 - 20;

    ctx.clearRect(0, 0, W, H);

    /* ── Background parchment ── */
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--surface2').trim() || '#F4EDD8';
    ctx.fillRect(0, 0, W, H);

    /* ─── PHASE 1: ingredients fly in from sides (0 → 0.45) ─── */
    const p1 = phaseT(t, 0, 0.45);
    if (p1 > 0 && p1 < 1.0 || t < 0.46) {
      const numIng = activeIngredients.length;
      activeIngredients.forEach((ing, i) => {
        const iv = ING_VISUALS[ing] || { colors: ['#ccc','#aaa'] };
        const delay = i / Math.max(numIng, 1) * 0.3;
        const progress = clamp((p1 - delay / 0.45) / 0.7, 0, 1);
        const ep = easeOutBack(progress);

        const stripH = 26;
        const targetY = cy - (numIng * (stripH + 4)) / 2 + i * (stripH + 4);
        const fromX   = i % 2 === 0 ? -180 : W + 180;
        const toX     = cx - 100;
        const x = lerp(fromX, toX, ep);

        const grad = ctx.createLinearGradient(x, targetY, x + 200, targetY + stripH);
        grad.addColorStop(0, iv.colors[0]);
        grad.addColorStop(1, iv.colors[1]);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, targetY, 200, stripH, 8);
        ctx.fill();

        /* label */
        if (ep > 0.5) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = `bold 11px Caveat, cursive`;
          ctx.textAlign = 'left';
          ctx.fillText(iv.label, x + 10, targetY + stripH * 0.68);
        }
      });
    }

    /* ─── PHASE 2: strips compress into cylinder shape (0.35 → 0.65) ─── */
    const p2 = phaseT(t, 0.35, 0.65);
    if (p2 > 0) {
      const ep2  = easeInOut(p2);
      const rollR = lerp(0, 100, ep2);
      const numIng = activeIngredients.length;

      activeIngredients.forEach((ing, i) => {
        const iv = ING_VISUALS[ing] || { colors: ['#ccc','#aaa'] };
        const frac = i / Math.max(numIng, 1);
        const angStart = frac * Math.PI * 2;
        const angEnd   = ((i + 1) / Math.max(numIng, 1)) * Math.PI * 2;

        /* fade from strip to arc */
        ctx.globalAlpha = ep2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rollR, angStart, angEnd);
        ctx.closePath();
        const g2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, rollR);
        g2.addColorStop(0, iv.colors[0]);
        g2.addColorStop(1, iv.colors[1]);
        ctx.fillStyle = g2;
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    /* ─── PHASE 3: seaweed wraps (0.58 → 0.82) ─── */
    const p3 = phaseT(t, 0.58, 0.82);
    if (p3 > 0) {
      const ep3 = easeInOut(p3);
      const rollR = 100;

      /* Seaweed arc sweeping from 0 to full circle */
      const sweepAngle = ep3 * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rollR, -Math.PI / 2, -Math.PI / 2 + sweepAngle);
      ctx.arc(cx, cy, rollR - 12, -Math.PI / 2 + sweepAngle, -Math.PI / 2, true);
      ctx.closePath();
      const sg = ctx.createLinearGradient(cx - rollR, cy, cx + rollR, cy);
      sg.addColorStop(0, '#1A5830');
      sg.addColorStop(0.5, '#2A7840');
      sg.addColorStop(1, '#1A5830');
      ctx.fillStyle = sg;
      ctx.fill();

      /* Seaweed texture lines */
      ctx.strokeStyle = 'rgba(10,40,20,0.5)';
      ctx.lineWidth = 1;
      for (let a = 0; a < sweepAngle; a += 0.35) {
        const ax = cx + rollR * Math.cos(-Math.PI / 2 + a);
        const ay = cy + rollR * Math.sin(-Math.PI / 2 + a);
        const bx = cx + (rollR - 12) * Math.cos(-Math.PI / 2 + a);
        const by = cy + (rollR - 12) * Math.sin(-Math.PI / 2 + a);
        ctx.beginPath();
        ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        ctx.stroke();
      }
    }

    /* ─── PHASE 4: cross-section slice (0.78 → 0.96) ─── */
    const p4 = phaseT(t, 0.78, 0.96);
    if (p4 > 0) {
      const ep4    = easeOutBack(clamp(p4, 0, 1));
      const rollR  = 100;
      const sliceX = lerp(cx + 160, cx + 5, ep4);

      /* shadow */
      ctx.shadowColor = 'rgba(40,20,5,0.25)';
      ctx.shadowBlur  = 18;

      /* SEAWEED outer ring */
      ctx.beginPath();
      ctx.arc(sliceX, cy, rollR, 0, Math.PI * 2);
      ctx.fillStyle = '#1A5830';
      ctx.fill();
      ctx.shadowBlur = 0;

      /* RICE ring */
      ctx.beginPath();
      ctx.arc(sliceX, cy, rollR - 10, 0, Math.PI * 2);
      ctx.fillStyle = '#F0EAD0';
      ctx.fill();
      /* Rice grain dots */
      for (let ai = 0; ai < 28; ai++) {
        const ang = (ai / 28) * Math.PI * 2;
        const rad = rollR - 16 + (ai % 3) * 2;
        const gx  = sliceX + rad * Math.cos(ang);
        const gy  = cy + rad * Math.sin(ang) * 0.98;
        ctx.beginPath();
        ctx.ellipse(gx, gy, 4, 2.5, ang, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fill();
      }

      /* INGREDIENT wedges */
      const numIng = activeIngredients.length;
      const innerR = rollR - 24;
      activeIngredients.forEach((ing, i) => {
        const iv  = ING_VISUALS[ing] || { colors: ['#ccc','#aaa'] };
        const a1  = (i / numIng) * Math.PI * 2 - Math.PI / 2;
        const a2  = ((i + 1) / numIng) * Math.PI * 2 - Math.PI / 2;
        const gw  = ctx.createRadialGradient(sliceX, cy, 0, sliceX, cy, innerR);
        gw.addColorStop(0, iv.colors[0]);
        gw.addColorStop(1, iv.colors[1]);
        ctx.beginPath();
        ctx.moveTo(sliceX, cy);
        ctx.arc(sliceX, cy, innerR, a1, a2);
        ctx.closePath();
        ctx.fillStyle = gw;
        ctx.fill();
        /* wedge separator */
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      /* center dot */
      ctx.beginPath();
      ctx.arc(sliceX, cy, 6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();

      /* outer ink ring */
      ctx.beginPath();
      ctx.arc(sliceX, cy, rollR, 0, Math.PI * 2);
      ctx.strokeStyle = '#2A1608';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    /* ─── PHASE 5: plate + done (0.90 → 1.0) ─── */
    const p5 = phaseT(t, 0.90, 1.0);
    if (p5 > 0) {
      const ep5 = easeOutBack(p5);
      const plateY = lerp(H + 40, cy + 115, ep5);

      /* Plate ellipse */
      ctx.beginPath();
      ctx.ellipse(cx, plateY, 130, 22, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#F8F4F0';
      ctx.fill();
      ctx.strokeStyle = '#C8B8A0';
      ctx.lineWidth = 2;
      ctx.stroke();

      /* Plate rim shadow */
      ctx.beginPath();
      ctx.ellipse(cx, plateY - 4, 124, 16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180,160,140,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      /* sesame seeds on top of roll */
      if (p5 > 0.7) {
        const sAlpha = (p5 - 0.7) / 0.3;
        ctx.fillStyle = `rgba(210,170,80,${sAlpha * 0.9})`;
        const seeds = [[cx-15,cy-95],[cx+5,cy-98],[cx+22,cy-92],[cx-28,cy-88],[cx+10,cy-90]];
        seeds.forEach(([sx, sy]) => {
          ctx.beginPath();
          ctx.ellipse(sx, sy, 3, 2, 0.4, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    /* Title text while rolling */
    if (t < 0.85) {
      const wobX = Math.sin(t * 20) * 1.5;
      ctx.font = 'bold 16px Caveat, cursive';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(42,22,8,${clamp((0.85 - t) / 0.85, 0, 0.7)})`;
      ctx.fillText(t < 0.4 ? 'gathering ingredients…' : t < 0.7 ? 'rolling…' : 'wrapping…', cx + wobX, H - 28);
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
    title.textContent = '🍣 your roll is ready!';

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
      /* Collect which ingredient *types* are active in current pattern */
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

      /* Stop playback */
      if (playing) App.stop?.();

      /* Open overlay */
      const overlay = document.getElementById('roll-overlay');
      const modal   = document.getElementById('roll-modal');
      const title   = document.getElementById('roll-modal-title');
      const footer  = document.getElementById('roll-footer');

      title.textContent = 'rolling your sushi…';
      footer.style.display = 'none';
      overlay.classList.add('active');

      /* Setup canvas */
      const canvas = document.getElementById('roll-canvas');
      const ctx    = canvas.getContext('2d');
      const size   = Math.min(380, window.innerWidth * 0.82);
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