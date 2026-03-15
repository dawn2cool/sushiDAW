/*
  roll.js — SushiDAW  (Pixel Art / Indie Game Edition)
  Stardew Valley × Tsuki Adventure × RPG item reveal
*/

const Roll = (() => {
  let raf = null;
  let startTime = null;
  const DURATION = 5200;

  const ING_VISUALS = {
    'cream cheese': { colors: ['#FFF9E8','#E8D898'], outline: '#C8A840', label: 'cream cheese', emoji: '🧀' },
    'salmon':       { colors: ['#FF8C60','#E05A32'], outline: '#B03820', label: 'salmon',       emoji: '🐟' },
    'tuna':         { colors: ['#D63242','#A61B28'], outline: '#780F18', label: 'tuna',         emoji: '🍣' },
    'avocado':      { colors: ['#82D068','#58A042'], outline: '#286022', label: 'avocado',      emoji: '🥑' },
    'cucumber':     { colors: ['#B4E8A8','#68C45A'], outline: '#186028', label: 'cucumber',     emoji: '🥒' },
    'egg':          { colors: ['#FFD242','#E6A212'], outline: '#C07A00', label: 'egg',          emoji: '🍳' },
    'prawn':        { colors: ['#FF9A7B','#E86A44'], outline: '#B03020', label: 'prawn',        emoji: '🦐' },
    'wasabi':       { colors: ['#78B868','#4A863A'], outline: '#1A5028', label: 'wasabi',       emoji: '🌿' },
  };

  const SUSHI_NAMES = [
    'THE CHEF\'S SPECIAL', 'MIDNIGHT ROLL', 'SUNSET MAKI',
    'THE BIG WAVE', 'SAKURA ROLL', 'DRAGON KISS',
    'UMAMI BOMB', 'AUTUMN HARVEST', 'THE DEEP CUT',
    'SPICY SURPRISE', 'GOLDEN CRUNCH', 'THE GARDEN GATE',
  ];

  // Score ratings based on # of ingredients
  const RATINGS = [
    { min: 0, label: 'RICE BALL', stars: 1, color: '#B09070' },
    { min: 1, label: 'NOVICE ROLL', stars: 2, color: '#C8A840' },
    { min: 3, label: 'GOOD MAKI',  stars: 3, color: '#3A8030' },
    { min: 5, label: 'MASTER CHEF', stars: 4, color: '#E85038' },
    { min: 7, label: 'S-RANK SUSHI!', stars: 5, color: '#D09010' },
  ];

  function getRating(n) {
    let r = RATINGS[0];
    for (const rt of RATINGS) { if (n >= rt.min) r = rt; }
    return r;
  }

  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t-1,3) + c1 * Math.pow(t-1,2);
  }
  function easeInOut(t) { return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
  function easeOutBounce(t) {
    const n1=7.5625,d1=2.75;
    if(t<1/d1)      return n1*t*t;
    else if(t<2/d1) return n1*(t-=1.5/d1)*t+0.75;
    else if(t<2.5/d1) return n1*(t-=2.25/d1)*t+0.9375;
    else            return n1*(t-=2.625/d1)*t+0.984375;
  }
  function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }
  function lerp(a,b,t)  { return a+(b-a)*t; }
  function phaseT(t,s,e) { return clamp((t-s)/(e-s),0,1); }

  /* ── Pixel font renderer ── */
  function pixelText(ctx, text, x, y, size, color, align='center') {
    ctx.font = `${size}px 'Press Start 2P', monospace`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(text, x+2, y+2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /* ── Pixel rectangle with chunky border ── */
  function pixelRect(ctx, x, y, w, h, fill, stroke, sw=3) {
    ctx.fillStyle = fill;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = sw;
      ctx.lineJoin = 'miter';
      ctx.strokeRect(Math.round(x)+sw/2, Math.round(y)+sw/2, Math.round(w)-sw, Math.round(h)-sw);
    }
  }

  /* ── Sparkle / pixel star burst ── */
  function drawSparks(ctx, cx, cy, t, count=8, radius=60, color='#FFD242') {
    for (let i=0; i<count; i++) {
      const angle = (i/count)*Math.PI*2 + t*3;
      const r = radius * t;
      const sx = cx + r*Math.cos(angle);
      const sy = cy + r*Math.sin(angle);
      const size = Math.max(0, 5*(1-t));
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(sx-size/2), Math.round(sy-size/2), Math.round(size), Math.round(size));
    }
  }

  /* ── Pixel star (rating) ── */
  function drawPixelStar(ctx, cx, cy, filled, size=14) {
    const pts = [];
    for (let i=0; i<10; i++) {
      const angle = (i/10)*Math.PI*2 - Math.PI/2;
      const r = i%2===0 ? size : size*0.45;
      pts.push({ x: cx+r*Math.cos(angle), y: cy+r*Math.sin(angle) });
    }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i=1; i<pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fillStyle = filled ? '#FFD242' : 'rgba(120,90,50,0.3)';
    ctx.fill();
    ctx.strokeStyle = filled ? '#C89010' : 'rgba(80,60,30,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /* ── Pixel progress bar ── */
  function drawProgressBar(ctx, x, y, w, h, progress, fillColor, bgColor, label) {
    pixelRect(ctx, x, y, w, h, bgColor, '#2A1608', 2);
    const fw = Math.max(0, (w-4)*progress);
    if (fw > 0) pixelRect(ctx, x+2, y+2, fw, h-4, fillColor, null);
    // Shine
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x+2, y+2, fw, Math.floor((h-4)/2));
    if (label) {
      ctx.font = "6px 'Press Start 2P', monospace";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#2A1608';
      ctx.fillText(label, x+6, y+h/2);
    }
  }

  /* ── Seaweed wrapping ring ── */
  function drawSeaweedRing(ctx, cx, cy, r, progress) {
    const sweep = progress * Math.PI * 2;
    // Outer fill
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI/2, -Math.PI/2 + sweep);
    ctx.arc(cx, cy, r-16, -Math.PI/2 + sweep, -Math.PI/2, true);
    ctx.closePath();
    ctx.fillStyle = '#1B4D2E';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0A2A14';
    ctx.stroke();
  }

  /* ── Sushi cross-section ── */
  function drawCrossSection(ctx, cx, cy, r, ingredients) {
    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5;
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.fillStyle = '#1B4D2E'; ctx.fill();
    ctx.restore();

    // Seaweed outer (pixelated circle = octagon-ish)
    ctx.beginPath();
    const segs = 16;
    for (let i=0; i<=segs; i++) {
      const a = (i/segs)*Math.PI*2;
      const wobble = (Math.sin(a*4)*2 + Math.cos(a*7)*1.5);
      const rx = cx + (r+wobble)*Math.cos(a);
      const ry = cy + (r+wobble)*Math.sin(a);
      i===0 ? ctx.moveTo(rx,ry) : ctx.lineTo(rx,ry);
    }
    ctx.closePath();
    ctx.fillStyle = '#1B4D2E'; ctx.fill();
    ctx.strokeStyle = '#0A2A14'; ctx.lineWidth = 4; ctx.stroke();

    // Seaweed texture lines
    ctx.strokeStyle = '#0C3A1C'; ctx.lineWidth = 1.5;
    for (let a=0; a<Math.PI*2; a+=Math.PI/6) {
      const x1=cx+(r-14)*Math.cos(a), y1=cy+(r-14)*Math.sin(a);
      const x2=cx+(r-4)*Math.cos(a),  y2=cy+(r-4)*Math.sin(a);
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }

    // Rice layer
    const riceR = r - 13;
    ctx.beginPath(); ctx.arc(cx,cy,riceR,0,Math.PI*2);
    ctx.fillStyle = '#FFFDF4'; ctx.fill();
    ctx.strokeStyle = '#C8B890'; ctx.lineWidth = 3; ctx.stroke();

    // Rice grain dots
    ctx.fillStyle = '#F0E8D0';
    for (let i=0; i<18; i++) {
      const a = (i/18)*Math.PI*2;
      const gx = cx + (riceR-18)*Math.cos(a);
      const gy = cy + (riceR-18)*Math.sin(a);
      ctx.save();
      ctx.translate(gx,gy); ctx.rotate(a+0.4);
      ctx.fillRect(-5,-2.5,10,5);
      ctx.strokeStyle = '#D8D0B8'; ctx.lineWidth=1;
      ctx.strokeRect(-5,-2.5,10,5);
      ctx.restore();
    }

    // Ingredient blobs
    const numIng = ingredients.length;
    const innerR = numIng <= 1 ? 0 : Math.min(riceR-28, 20 + numIng*3);
    ingredients.forEach((ing, i) => {
      const iv = ING_VISUALS[ing] || { colors:['#E8DCC8','#C8A880'], outline:'#907040' };
      const a = (i/numIng)*Math.PI*2 - Math.PI/2;
      const dist = numIng === 1 ? 0 : innerR;
      const bx = cx + dist*Math.cos(a);
      const by = cy + dist*Math.sin(a);
      const blobR = Math.min(riceR-18, 22 - numIng*0.5);

      ctx.beginPath();
      const bsegs = 10;
      for (let j=0; j<=bsegs; j++) {
        const ba = (j/bsegs)*Math.PI*2;
        const w = 2 + Math.sin(ba*3)*2;
        const bx2 = bx+(blobR+w)*Math.cos(ba), by2 = by+(blobR+w)*Math.sin(ba);
        j===0 ? ctx.moveTo(bx2,by2) : ctx.lineTo(bx2,by2);
      }
      ctx.closePath();

      // Ingredient gradient
      const grad = ctx.createRadialGradient(bx-blobR*0.3,by-blobR*0.3,0,bx,by,blobR*1.2);
      grad.addColorStop(0, iv.colors[0]);
      grad.addColorStop(1, iv.colors[1]);
      ctx.fillStyle = grad; ctx.fill();
      ctx.strokeStyle = iv.outline || iv.colors[1]; ctx.lineWidth = 2.5; ctx.stroke();

      // Shine on ingredient
      ctx.beginPath(); ctx.arc(bx-blobR*0.3, by-blobR*0.3, blobR*0.3, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill();
    });

    // Cute pixel face (center)
    const eyeColor = '#2A1608';
    // Left eye
    ctx.fillStyle = eyeColor;
    ctx.fillRect(cx-12, cy-6, 4, 5);
    // Right eye
    ctx.fillRect(cx+8,  cy-6, 4, 5);
    // Smile (pixel arc)
    const smilePoints = [-6,-4,-2,0,2,0,6,-4]; // dx,dy pairs
    ctx.fillStyle = eyeColor;
    for (let i=0; i<smilePoints.length; i+=2) {
      ctx.fillRect(cx+smilePoints[i]-1, cy+4+smilePoints[i+1], 3, 3);
    }
    // Blush
    ctx.fillStyle = 'rgba(255,100,100,0.38)';
    ctx.fillRect(cx-20, cy+2, 8, 6);
    ctx.fillRect(cx+12, cy+2, 8, 6);
  }

  function drawFrame(canvas, ctx, ingredients, t) {
    const W = canvas.width, H = canvas.height;
    const cx = W/2, cy = H/2 - 28;

    ctx.clearRect(0,0,W,H);

    // Background — parchment with pixel grid
    const theme = document.documentElement.dataset.theme;
    const bgColor = theme==='dark' ? '#251808' : '#F4EDD8';
    const gridColor = theme==='dark' ? 'rgba(255,200,130,0.05)' : 'rgba(60,30,10,0.06)';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0,0,W,H);

    // Pixel grid dots
    ctx.fillStyle = gridColor;
    for (let gx=8; gx<W; gx+=16) {
      for (let gy=8; gy<H; gy+=16) {
        ctx.fillRect(gx,gy,2,2);
      }
    }

    const inkColor  = theme==='dark' ? '#F0E6D0' : '#2A1608';
    const ink2Color = theme==='dark' ? '#AA8860' : '#7A5A3A';
    const surfColor = theme==='dark' ? '#321E0C' : '#FFFDF4';
    const surf2Color= theme==='dark' ? '#3E2A14' : '#F4EDD8';

    /* ══ PHASE 1: Ingredient cards slide in (0 → 0.38) ══ */
    const p1 = phaseT(t, 0, 0.38);
    if (p1 > 0 && t < 0.42) {
      const numIng = ingredients.length || 1;
      const cardH = 34, cardW = 200, gap = 6;
      const totalH = numIng*(cardH+gap) - gap;
      const startY = cy - totalH/2;

      ingredients.forEach((ing, i) => {
        const iv = ING_VISUALS[ing] || { colors:['#E8DCC8','#C8A880'], outline:'#907040', label:ing, emoji:'🍱' };
        const delay = i/Math.max(numIng,1)*0.28;
        const prog  = clamp((p1 - delay/0.38)/0.72, 0, 1);
        const ep    = easeOutBack(prog);

        const targetX = cx - cardW/2;
        const fromX   = i%2===0 ? -cardW-20 : W+20;
        const x = lerp(fromX, targetX, ep);
        const y = startY + i*(cardH+gap);

        // Card shadow
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(Math.round(x)+4, Math.round(y)+4, cardW, cardH);

        // Card body
        pixelRect(ctx, x, y, cardW, cardH, surf2Color, inkColor, 3);

        // Ingredient color stripe on left
        pixelRect(ctx, x, y, 8, cardH, iv.colors[0], null);

        // Emoji
        ctx.font = '18px serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(iv.emoji||'🍱', x+14, y+cardH/2);

        // Label
        if (ep > 0.45) {
          pixelText(ctx, iv.label.toUpperCase(), x+44, y+cardH/2, 7, inkColor, 'left');
        }

        // Shimmer on fresh-revealed card
        if (ep > 0.6 && ep < 0.95) {
          const shimX = x + cardW*(ep-0.6)/0.35;
          const shimGrad = ctx.createLinearGradient(shimX-10,0,shimX+10,0);
          shimGrad.addColorStop(0,'rgba(255,255,255,0)');
          shimGrad.addColorStop(0.5,'rgba(255,255,255,0.3)');
          shimGrad.addColorStop(1,'rgba(255,255,255,0)');
          ctx.fillStyle = shimGrad;
          ctx.fillRect(x, y, cardW, cardH);
        }
      });
    }

    /* ══ PHASE 2: Seaweed wraps (0.34 → 0.65) ══ */
    const p2 = phaseT(t, 0.34, 0.65);
    if (p2 > 0 && t < 0.72) {
      const rollR = 100;
      drawSeaweedRing(ctx, cx, cy, rollR, easeInOut(p2));

      // Wrap progress text
      if (p2 < 0.95) {
        drawProgressBar(ctx, cx-90, H-60, 180, 18, easeInOut(p2), '#1B4D2E', surf2Color, 'ROLLING...');
      }
    }

    /* ══ PHASE 3: Cross-section slides in (0.62 → 0.88) ══ */
    const p3 = phaseT(t, 0.62, 0.88);
    if (p3 > 0) {
      const rollR = 100;
      const ep3 = easeOutBack(clamp(p3, 0, 1));
      const sliceX = lerp(W + rollR + 20, cx, ep3);

      drawCrossSection(ctx, sliceX, cy, rollR, ingredients);

      // Sparks burst when it arrives
      if (p3 > 0.7 && p3 < 0.95) {
        const sparkT = (p3-0.7)/0.25;
        drawSparks(ctx, sliceX, cy, sparkT, 12, 90, '#FFD242');
        drawSparks(ctx, sliceX, cy, sparkT*0.8, 8, 70, '#FF8C60');
      }
    }

    /* ══ PHASE 4: Score panel slides up (0.80 → 1.0) ══ */
    const p4 = phaseT(t, 0.80, 1.0);
    if (p4 > 0) {
      const ep4 = easeOutBounce(p4);
      const panelW = 240, panelH = 64;
      const panelX = cx - panelW/2;
      const panelY = lerp(H+20, H-panelH-16, ep4);

      const rating = getRating(ingredients.length);

      // Panel shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(panelX+4, panelY+4, panelW, panelH);

      // Panel body
      pixelRect(ctx, panelX, panelY, panelW, panelH, surf2Color, inkColor, 3);

      // Colored top strip
      pixelRect(ctx, panelX, panelY, panelW, 22, rating.color + 'CC', null);

      // Rating label
      pixelText(ctx, rating.label, cx, panelY+11, 7, '#FFFFFF');

      // Stars row
      const totalStars = 5;
      const starSpacing = 26;
      const starsStartX = cx - (totalStars-1)*starSpacing/2;
      for (let s=0; s<totalStars; s++) {
        const filled = s < rating.stars;
        const starT  = filled ? clamp((p4*5 - s*0.18), 0, 1) : 1;
        const scale  = filled ? easeOutBack(starT) : 1;
        ctx.save();
        ctx.translate(starsStartX + s*starSpacing, panelY+44);
        ctx.scale(scale, scale);
        drawPixelStar(ctx, 0, 0, filled);
        ctx.restore();
      }
    }

    /* ══ Rolling phase messages ══ */
    if (t < 0.78) {
      const msgs = [
        [0.00, 'PREPARING...'],
        [0.18, 'GATHERING...'],
        [0.36, 'ROLLING UP!'],
        [0.60, 'SLICING!'],
        [0.72, 'ALMOST...'],
      ];
      let msg = msgs[0][1];
      for (const [threshold, text] of msgs) { if (t >= threshold) msg = text; }

      const wobX = Math.round(Math.sin(t*12)*2);
      const alpha = clamp((0.78-t)/0.15, 0, 1);

      // Pixel text box
      const tw = 180, th = 24, tx = cx-tw/2, ty = H-48;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(tx+3, ty+3, tw, th);
      pixelRect(ctx, tx, ty, tw, th, surf2Color, inkColor, 2);
      pixelText(ctx, msg, cx+wobX, ty+th/2, 7, inkColor);
      ctx.globalAlpha = 1;
    }
  }

  function animate(canvas, ctx, ingredients) {
    cancelAnimationFrame(raf);
    startTime = null;

    function frame(ts) {
      if (!startTime) startTime = ts;
      const t = Math.min((ts - startTime) / DURATION, 1);

      drawFrame(canvas, ctx, ingredients, t);

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        showFooter(ingredients);
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function showFooter(ingredients) {
    document.getElementById('roll-modal-title').textContent = 'ROLL COMPLETE!';

    const name   = SUSHI_NAMES[Math.floor(Math.random() * SUSHI_NAMES.length)];
    const unique = [...new Set(ingredients)];
    const rating = getRating(unique.length);

    document.getElementById('roll-name').textContent = '\u{1F371} ' + name;
    document.getElementById('roll-ingredients').textContent =
      unique.map(i => (ING_VISUALS[i]?.emoji || '') + ' ' + i).join('  \u00b7  ') || '\u{1F35A} plain rice roll';

    if (typeof Mascot !== 'undefined') Mascot.onRollDone();
    const footer = document.getElementById('roll-footer');
    footer.style.display       = 'flex';
    footer.style.flexDirection = 'column';
    footer.style.alignItems    = 'center';
    footer.style.gap           = '8px';

    // Save to MongoDB if logged in
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn() && typeof DB !== 'undefined') {
      const canvas     = document.getElementById('roll-canvas');
      const canvasData = canvas ? canvas.toDataURL('image/jpeg', 0.5) : '';
      DB.saveRoll({
        rollName:      name,
        ingredients:   unique,
        rating:        rating.stars,
        ratingLabel:   rating.label,
        canvasDataUrl: canvasData,
        beatId:        window._lastSavedBeatId || ''
      }).catch(e => console.warn('saveRoll failed:', e));
    }
  }

  return {
      async trigger() {
        const grid = window.getGrid ? window.getGrid() : [];
        const activeIngredients = [];

        grid.forEach((row, r) => {
          if (row.some(c => c && c.active)) {
            const inst = window.channelInstances?.[r];
            if (inst) activeIngredients.push(inst.def.name);
          }
        });

        if (activeIngredients.length === 0) activeIngredients.push('rice');

        if (typeof App !== 'undefined' && App.stop) App.stop();

        const overlay = document.getElementById('roll-overlay');
        const footer  = document.getElementById('roll-footer');
        const title   = document.getElementById('roll-modal-title');

        footer.style.display = 'none';
        overlay.classList.add('active');

        // FIXED: Added a Promise.race to prevent the tag from blocking the animation forever
        if (typeof ProducerTag !== 'undefined') {
          title.textContent = '🎙 rolling...';
          await Promise.race([
            ProducerTag.onFinish(),
            new Promise(resolve => setTimeout(resolve, 3500)) // 3.5s hard timeout
          ]);
        }

        title.textContent = 'MAKING YOUR SUSHI...';
        const canvas = document.getElementById('roll-canvas');
        const ctx    = canvas.getContext('2d');
        const size   = Math.min(440, window.innerWidth * 0.9);
        canvas.width  = size;
        canvas.height = Math.round(size * 0.95);

        animate(canvas, ctx, activeIngredients);
      },

      close() {
        cancelAnimationFrame(raf);
        document.getElementById('roll-overlay').classList.remove('active');
      }
    };
  })();

  window.Roll = Roll;