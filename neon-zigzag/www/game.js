/* =====================================================================
 * NEON ZIGZAG  —  one-tap endless arcade game
 * ---------------------------------------------------------------------
 * Mechanic: a ball runs along a winding diamond path. Tap anywhere to
 * switch its direction. Follow the path's turns — leave the track and
 * you fall. Collect gems, chain combos, beat your best.
 *
 * Pure vanilla JS + Canvas (no deps), so it runs in any WebView and is
 * trivial to wrap with Capacitor for the App Store / Play Store.
 * ===================================================================== */
(function () {
  'use strict';

  // ---------- Canvas / sizing ----------
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Constants ----------
  var T = 64;                       // world tile size (units)
  var R = T * 0.30;                 // ball radius (units)
  var ISO = 0.70710678;            // cos/sin 45°
  // World->screen orthonormal map (rotation + reflection): "up the diamond"
  // sx = ISO*(px - py),  sy = -ISO*(px + py)
  var BALL_FY = 0.64;               // ball vertical position on screen (fraction)

  // ---------- Persistent state ----------
  var BEST_KEY = 'neonzigzag.best';
  var MUTE_KEY = 'neonzigzag.mute';
  var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  var muted = localStorage.getItem(MUTE_KEY) === '1';

  // ---------- DOM ----------
  var el = {
    hud: document.getElementById('hud'),
    score: document.getElementById('score'),
    combo: document.getElementById('combo'),
    start: document.getElementById('start'),
    startBest: document.getElementById('startBest'),
    gameover: document.getElementById('gameover'),
    finalScore: document.getElementById('finalScore'),
    newBest: document.getElementById('newBest'),
    goBest: document.getElementById('goBest'),
    continueBtn: document.getElementById('continueBtn'),
    restartBtn: document.getElementById('restartBtn'),
    homeBtn: document.getElementById('homeBtn'),
    playBtn: document.getElementById('playBtn'),
    muteBtn: document.getElementById('muteBtn'),
    tapToStart: document.getElementById('tapToStart')
  };
  el.startBest.textContent = best;
  el.muteBtn.textContent = muted ? '🔇' : '🔊';

  // =====================================================================
  // Audio (tiny WebAudio synth)
  // =====================================================================
  var actx = null;
  function audio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { actx = null; }
    }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function beep(freq, dur, type, vol) {
    if (muted) return;
    var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(a.destination);
    var t = a.currentTime;
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function sTap()  { beep(520, 0.07, 'square', 0.12); }
  function sGem()  { beep(880, 0.08, 'triangle', 0.16); beep(1320, 0.10, 'sine', 0.10); }
  function sDie()  { beep(180, 0.5, 'sawtooth', 0.22); beep(90, 0.6, 'square', 0.12); }
  function sStart(){ beep(660, 0.10, 'triangle', 0.14); }

  // =====================================================================
  // Game state
  // =====================================================================
  var state = 'menu';   // menu | playing | dying | over
  var cells = [];       // [{cx,cy,gem,out}]   out: 'x' | 'y' | null
  var cellMap = {};     // "cx,cy" -> index
  var genAxis = 'x';    // axis of next segment to generate
  var genHead = null;   // last generated cell

  var ball = { px: 0, py: 0, axis: 'x', vp: 0 };
  var progress = 0;     // index of current on-path cell
  var score = 0;
  var speedTiles = 0;   // tiles per second
  var trail = [];
  var particles = [];
  var popups = [];
  var shake = 0;
  var elapsed = 0;
  var deaths = 0;
  var continuesUsed = 0;
  var comboStreak = 0;
  var comboTimer = 0;
  var ghost = 0;        // invulnerability timer after revive
  var fall = null;      // falling animation data
  var bg = { stars: [], t: 0 };

  function key(cx, cy) { return cx + ',' + cy; }

  function initStars() {
    bg.stars = [];
    for (var i = 0; i < 60; i++) {
      bg.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4, s: Math.random() * 0.4 + 0.1 });
    }
  }
  initStars();

  // ---------- Path generation ----------
  function addCell(cx, cy) {
    var k = key(cx, cy);
    if (cellMap[k] !== undefined) return cells[cellMap[k]];
    var c = { cx: cx, cy: cy, gem: false, out: null };
    cellMap[k] = cells.length;
    cells.push(c);
    genHead = c;
    return c;
  }

  function segLenForScore() {
    // Shorter segments as the score climbs -> tighter timing.
    var hi = score < 25 ? 6 : score < 60 ? 5 : score < 120 ? 4 : 3;
    var lo = 2;
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function generateSegment() {
    var len = segLenForScore();
    var startIdx = cells.length;
    for (var i = 0; i < len; i++) {
      var nx = genHead.cx + (genAxis === 'x' ? 1 : 0);
      var ny = genHead.cy + (genAxis === 'y' ? 1 : 0);
      // mark the cell we are leaving with its outgoing axis
      genHead.out = genAxis;
      addCell(nx, ny);
    }
    // place a gem somewhere mid-segment (not on the very first cells)
    if (cells.length > 6 && Math.random() < 0.55) {
      var gi = startIdx + Math.floor(len / 2);
      if (cells[gi]) cells[gi].gem = true;
    }
    genAxis = genAxis === 'x' ? 'y' : 'x';
  }

  function ensureAhead() {
    while (cells.length < progress + 40) generateSegment();
  }

  // ---------- Reset / start ----------
  function resetGame() {
    cells = []; cellMap = {}; genAxis = 'x'; genHead = null;
    addCell(0, 0);
    // a slightly longer easy opening run in +x
    for (var i = 0; i < 5; i++) { genHead.out = 'x'; addCell(genHead.cx + 1, genHead.cy); }
    genAxis = 'y';
    progress = 0; score = 0; speedTiles = 4.4;
    trail = []; particles = []; popups = []; shake = 0; elapsed = 0;
    comboStreak = 0; comboTimer = 0; ghost = 0; fall = null; continuesUsed = 0;
    ball.px = (0 + 0.5) * T; ball.py = (0 + 0.5) * T; ball.axis = 'x';
    ensureAhead();
    updateHud();
  }

  function startGame() {
    resetGame();
    state = 'playing';
    el.start.classList.add('hidden');
    el.gameover.classList.add('hidden');
    el.hud.classList.remove('hidden');
    el.tapToStart.classList.remove('hidden');
    sStart();
  }

  function updateHud() {
    el.score.textContent = score;
    if (comboStreak >= 2) {
      el.combo.textContent = 'x' + comboStreak;
      el.combo.classList.remove('hidden');
    } else {
      el.combo.classList.add('hidden');
    }
  }

  // ---------- Death / revive ----------
  function ballScreen() {
    // ball is anchored at a fixed screen spot while playing
    return { x: W * 0.5, y: H * BALL_FY };
  }

  function die() {
    if (state !== 'playing') return;
    state = 'dying';
    shake = 16;
    sDie();
    var bs = ballScreen();
    burst(bs.x, bs.y, '#00e5ff', 26);
    burst(bs.x, bs.y, '#ff2bd6', 18);
    // falling ball continues forward then drops
    var dirx = ball.axis === 'x' ? 1 : 0, diry = ball.axis === 'y' ? 1 : 0;
    var sdx = ISO * (dirx - diry), sdy = -ISO * (dirx + diry);
    fall = { x: bs.x, y: bs.y, vx: sdx * 280, vy: sdy * 200, t: 0 };
    // offer the rewarded continue only once per run
    var canContinue = continuesUsed < 1 && score >= 5;
    el.continueBtn.classList.toggle('hidden', !canContinue);
    setTimeout(showGameOver, 850);
  }

  function showGameOver() {
    state = 'over';
    el.hud.classList.add('hidden');
    el.finalScore.textContent = score;
    var isBest = score > best;
    if (isBest) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
    el.newBest.classList.toggle('hidden', !isBest);
    el.goBest.textContent = best;
    el.gameover.classList.remove('hidden');

    deaths++;
    // Interstitial cadence: every 2nd game over, and never blocks the UI badly.
    if (window.Ads && deaths % 2 === 0) {
      Ads.showInterstitial();
    }
  }

  function reviveAt(idx) {
    var c = cells[idx];
    if (!c) return;
    ball.px = (c.cx + 0.5) * T;
    ball.py = (c.cy + 0.5) * T;
    ball.axis = c.out || ball.axis;
    progress = idx;
    fall = null; shake = 6; ghost = 1.3;
    state = 'playing';
    el.gameover.classList.add('hidden');
    el.hud.classList.remove('hidden');
    trail = [];
    ensureAhead();
  }

  function doContinue() {
    if (!window.Ads) { reviveAt(Math.max(0, progress)); return; }
    el.continueBtn.disabled = true;
    Ads.showRewarded().then(function (earned) {
      el.continueBtn.disabled = false;
      el.continueBtn.classList.add('hidden');
      if (earned) {
        continuesUsed++;
        reviveAt(Math.max(0, progress));
      }
    });
  }

  // ---------- Effects ----------
  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = Math.random() * 4 + 1.5;
      particles.push({
        x: x, y: y, vx: Math.cos(a) * sp * 60, vy: Math.sin(a) * sp * 60 - 40,
        life: 0.6 + Math.random() * 0.4, t: 0, color: color, r: Math.random() * 3 + 1.5
      });
    }
  }
  function popup(text, color) {
    var bs = ballScreen();
    popups.push({ x: bs.x, y: bs.y - 30, text: text, color: color, t: 0, life: 0.9 });
  }

  // =====================================================================
  // Input
  // =====================================================================
  function onTap() {
    audio(); // unlock on first gesture
    if (state === 'playing') {
      ball.axis = ball.axis === 'x' ? 'y' : 'x';
      sTap();
      el.tapToStart.classList.add('hidden');
      var bs = ballScreen();
      burst(bs.x, bs.y, '#ffffff', 4);
    }
  }
  // Pointer + keyboard
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); onTap(); }, { passive: false });
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onTap(); }
  });

  el.playBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.restartBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.continueBtn.addEventListener('click', function (e) { e.stopPropagation(); doContinue(); });
  el.homeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    state = 'menu';
    el.gameover.classList.add('hidden');
    el.start.classList.remove('hidden');
    el.startBest.textContent = best;
  });
  el.muteBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    el.muteBtn.textContent = muted ? '🔇' : '🔊';
    if (!muted) sStart();
  });

  // =====================================================================
  // Update
  // =====================================================================
  function update(dt) {
    bg.t += dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (ghost > 0) ghost = Math.max(0, ghost - dt);

    // particles
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 320 * dt; p.vx *= 0.98;
    }
    // popups
    for (var j = popups.length - 1; j >= 0; j--) {
      var pu = popups[j]; pu.t += dt; pu.y -= 40 * dt;
      if (pu.t >= pu.life) popups.splice(j, 1);
    }

    if (state === 'dying' && fall) {
      fall.t += dt;
      fall.x += fall.vx * dt; fall.y += fall.vy * dt; fall.vy += 900 * dt;
      return;
    }
    if (state !== 'playing') return;

    elapsed += dt;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) { comboStreak = 0; updateHud(); } }

    // speed ramps with score — starts gentle, eases in over the first ~15 pts
    var ramp = score < 15 ? score * 0.012 : 0.18 + (score - 15) * 0.02;
    speedTiles = Math.min(11, 4.4 + ramp);
    var step = speedTiles * T * dt;

    // move along current axis
    if (ball.axis === 'x') ball.px += step; else ball.py += step;

    // trail
    trail.push({ x: ball.px, y: ball.py });
    if (trail.length > 26) trail.shift();

    // which cell are we in?
    var cx = Math.floor(ball.px / T), cy = Math.floor(ball.py / T);
    var idx = cellMap[key(cx, cy)];

    if (idx === undefined) {
      // off the track
      if (ghost > 0) {
        // during ghost time, snap back gently onto the path
        var safe = cells[progress];
        if (safe) {
          if (ball.axis === 'x') ball.py = (safe.cy + 0.5) * T;
          else ball.px = (safe.cx + 0.5) * T;
        }
      } else {
        die();
        return;
      }
    } else if (idx > progress) {
      // advanced to a new on-path cell
      for (var s = progress + 1; s <= idx; s++) {
        score += 1;
        var c = cells[s];
        if (c && c.gem) {
          c.gem = false;
          comboStreak++; comboTimer = 1.4;
          var bonus = 10 + (comboStreak >= 2 ? comboStreak * 2 : 0);
          score += bonus;
          var bs = ballScreen();
          burst(bs.x, bs.y, '#7CFFB2', 14);
          sGem();
          popup('+' + bonus, '#7CFFB2');
        }
      }
      progress = idx;
      ensureAhead();
      updateHud();
    }
  }

  // =====================================================================
  // Render
  // =====================================================================
  function worldToScreen(px, py, cam, ox, oy) {
    return {
      x: ISO * ((px - cam.px) - (py - cam.py)) + ox,
      y: -ISO * ((px - cam.px) + (py - cam.py)) + oy
    };
  }

  function drawBackground() {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0f2a');
    g.addColorStop(0.55, '#141a40');
    g.addColorStop(1, '#0a0d22');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // drifting stars
    ctx.save();
    for (var i = 0; i < bg.stars.length; i++) {
      var s = bg.stars[i];
      var y = (s.y + bg.t * s.s * 0.05) % 1;
      ctx.globalAlpha = 0.5 * s.r / 2;
      ctx.fillStyle = '#9fd0ff';
      ctx.beginPath();
      ctx.arc(s.x * W, y * H, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // top glow
    var rg = ctx.createRadialGradient(W / 2, H * 0.18, 0, W / 2, H * 0.18, H * 0.6);
    rg.addColorStop(0, 'rgba(0,229,255,0.10)');
    rg.addColorStop(1, 'rgba(0,229,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }

  function tileDiamond(c, cam, ox, oy) {
    // four corners of the cell in world space -> screen
    var x0 = c.cx * T, y0 = c.cy * T, x1 = x0 + T, y1 = y0 + T;
    var pad = 3;
    var a = worldToScreen(x0 + pad, y0 + pad, cam, ox, oy);
    var b = worldToScreen(x1 - pad, y0 + pad, cam, ox, oy);
    var d = worldToScreen(x1 - pad, y1 - pad, cam, ox, oy);
    var e = worldToScreen(x0 + pad, y1 - pad, cam, ox, oy);
    return [a, b, d, e];
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground();

    // camera = ball (or fall origin)
    var cam = { px: ball.px, py: ball.py };
    var shx = (Math.random() - 0.5) * shake;
    var shy = (Math.random() - 0.5) * shake;
    var ox = W * 0.5 + shx;
    var oy = H * BALL_FY + shy;

    // ---- path tiles ----
    var lo = Math.max(0, progress - 10);
    var hi = Math.min(cells.length - 1, progress + 34);
    for (var i = hi; i >= lo; i--) {
      var c = cells[i];
      var poly = tileDiamond(c, cam, ox, oy);
      var depth = i - progress;
      var fade = depth > 24 ? Math.max(0, 1 - (depth - 24) / 10) : 1;
      ctx.globalAlpha = fade;
      // face
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      ctx.lineTo(poly[1].x, poly[1].y);
      ctx.lineTo(poly[2].x, poly[2].y);
      ctx.lineTo(poly[3].x, poly[3].y);
      ctx.closePath();
      var grd = ctx.createLinearGradient(poly[0].x, poly[0].y, poly[2].x, poly[2].y);
      grd.addColorStop(0, '#2b3a8f');
      grd.addColorStop(1, '#1b2360');
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(120,170,255,0.35)';
      ctx.stroke();

      // gem
      if (c.gem) {
        var gc = worldToScreen((c.cx + 0.5) * T, (c.cy + 0.5) * T, cam, ox, oy);
        var bob = Math.sin(bg.t * 4 + i) * 4;
        drawGem(gc.x, gc.y + bob);
      }
    }
    ctx.globalAlpha = 1;

    // ---- trail ----
    for (var k = 0; k < trail.length; k++) {
      var tp = trail[k];
      var ts = worldToScreen(tp.x, tp.y, cam, ox, oy);
      var f = k / trail.length;
      ctx.globalAlpha = f * 0.5;
      ctx.fillStyle = '#00e5ff';
      ctx.beginPath();
      ctx.arc(ts.x, ts.y, R * 0.9 * f, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- ball ----
    if (state === 'playing' || (state === 'dying' && !fall)) {
      drawBall(W * 0.5 + shx, H * BALL_FY + shy);
    } else if (state === 'dying' && fall) {
      drawBall(fall.x, fall.y);
    }

    // ---- particles (screen space) ----
    for (var pi = 0; pi < particles.length; pi++) {
      var p = particles[pi];
      var pf = 1 - p.t / p.life;
      ctx.globalAlpha = pf;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x + shx, p.y + shy, p.r * pf + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- popups ----
    for (var qi = 0; qi < popups.length; qi++) {
      var pu = popups[qi];
      ctx.globalAlpha = 1 - pu.t / pu.life;
      ctx.fillStyle = pu.color;
      ctx.font = '800 26px -apple-system, Segoe UI, Roboto, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pu.text, pu.x, pu.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawGem(x, y) {
    var s = T * 0.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = '#7CFFB2';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.8, 0);
    ctx.closePath();
    var g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, '#d6ffe9'); g.addColorStop(1, '#37e08a');
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }

  function drawBall(x, y) {
    var r = R * 1.25;
    var inv = ghost > 0 && Math.floor(ghost * 10) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = inv ? 0.45 : 1;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 22;
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.4, '#6cf0ff');
    g.addColorStop(1, '#0095c8');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // =====================================================================
  // Loop
  // =====================================================================
  var last = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Init ads (no-op / fallback on web)
  if (window.Ads) Ads.init();

  // Pause audio context when tab hidden
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && actx) actx.suspend();
  });
})();
