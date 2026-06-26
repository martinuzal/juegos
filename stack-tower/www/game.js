/* =====================================================================
 * STACK TOWER — one-tap block stacking arcade game
 * ---------------------------------------------------------------------
 * A block slides side to side. Tap to drop it on the stack. Whatever
 * hangs over the block below gets sliced off. Line it up perfectly to
 * keep your width (and grow it). Stack as high as you can.
 *
 * Vanilla JS + Canvas. Wrap with Capacitor for the stores. AdMob hooks
 * in ads.js (interstitial on game over, rewarded "continue").
 * ===================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2.5);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  // ---------- Layout ----------
  var BH = 42;                 // block height (px)
  var ROW_Y = function () { return H * 0.30; }; // screen y of the active row
  var baseW = function () { return Math.min(W * 0.62, 280); };

  // ---------- Persistent ----------
  var BEST_KEY = 'stacktower.best', MUTE_KEY = 'stacktower.mute';
  var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  var muted = localStorage.getItem(MUTE_KEY) === '1';

  var el = {
    hud: document.getElementById('hud'), score: document.getElementById('score'),
    combo: document.getElementById('combo'), start: document.getElementById('start'),
    startBest: document.getElementById('startBest'), gameover: document.getElementById('gameover'),
    finalScore: document.getElementById('finalScore'), newBest: document.getElementById('newBest'),
    goBest: document.getElementById('goBest'), continueBtn: document.getElementById('continueBtn'),
    restartBtn: document.getElementById('restartBtn'), homeBtn: document.getElementById('homeBtn'),
    playBtn: document.getElementById('playBtn'), muteBtn: document.getElementById('muteBtn')
  };
  el.startBest.textContent = best;
  el.muteBtn.textContent = muted ? '🔇' : '🔊';

  // ---------- Audio ----------
  var actx = null;
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; } }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function beep(freq, dur, type, vol) {
    if (muted) return; var a = audio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.value = freq; g.gain.value = 0.0001;
    o.connect(g); g.connect(a.destination); var t = a.currentTime;
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function sPlace(n) { beep(300 + Math.min(n, 24) * 28, 0.08, 'square', 0.13); }
  function sPerfect(n) { beep(600 + Math.min(n, 20) * 40, 0.10, 'triangle', 0.18); beep(1200, 0.08, 'sine', 0.08); }
  function sDie() { beep(150, 0.5, 'sawtooth', 0.22); }

  // ---------- State ----------
  var state = 'menu';      // menu | playing | over
  var stack = [];          // [{x, w, hue}]
  var moving = null;       // {x, w, dir, speed, hue}
  var debris = [];         // falling trimmed pieces (screen space)
  var particles = [];
  var camY = 0;            // how far the world has scrolled up (px)
  var camTarget = 0;
  var score = 0;
  var combo = 0;
  var shake = 0;
  var deaths = 0;
  var continuesUsed = 0;
  var flash = 0;           // perfect flash timer
  var hueBase = 200;

  function hueColor(hue, light) { return 'hsl(' + ((hue % 360) + 360) % 360 + ',70%,' + (light || 58) + '%)'; }

  function reset() {
    stack = []; debris = []; particles = []; camY = 0; camTarget = 0;
    score = 0; combo = 0; shake = 0; continuesUsed = 0; flash = 0;
    hueBase = 200 + Math.floor(Math.random() * 120);
    var bw = baseW();
    stack.push({ x: (W - bw) / 2, w: bw, hue: hueBase });
    spawnMoving();
    updateHud();
  }

  function spawnMoving() {
    var top = stack[stack.length - 1];
    var speed = 150 + Math.min(stack.length * 9, 240); // px/s, ramps with height
    var fromLeft = stack.length % 2 === 0;
    moving = {
      x: fromLeft ? -top.w + 0 : W, w: top.w, dir: fromLeft ? 1 : -1,
      speed: speed, hue: hueBase + stack.length * 8
    };
    // start just off the opposite edge
    moving.x = fromLeft ? 0 : W - top.w;
    moving.dir = fromLeft ? 1 : -1;
  }

  function startGame() {
    reset(); state = 'playing';
    el.start.classList.add('hidden'); el.gameover.classList.add('hidden');
    el.hud.classList.remove('hidden');
    beep(660, 0.1, 'triangle', 0.14);
  }

  function updateHud() {
    el.score.textContent = score;
    if (combo >= 2) { el.combo.textContent = '¡PERFECTO! x' + combo; el.combo.classList.remove('hidden'); }
    else el.combo.classList.add('hidden');
  }

  // ---------- Drop logic ----------
  function drop() {
    if (state !== 'playing' || !moving) return;
    var top = stack[stack.length - 1];
    var mvL = moving.x, mvR = moving.x + moving.w;
    var tpL = top.x, tpR = top.x + top.w;
    var ovL = Math.max(mvL, tpL), ovR = Math.min(mvR, tpR);
    var overlap = ovR - ovL;

    if (overlap <= 0) { die(); return; }

    var perfect = Math.abs(moving.x - top.x) <= 6;
    var newX, newW;
    if (perfect) {
      newX = top.x; newW = top.w;
      combo++;
      // reward: grow slightly back toward base, capped
      var grow = Math.min(10, baseW() - newW);
      if (grow > 0) { newX -= grow / 2; newW += grow; }
      score += 1 + combo;
      flash = 0.3; shake = 6;
      sPerfect(stack.length);
      burst(W / 2, ROW_Y(), hueColor(moving.hue), 18);
    } else {
      combo = 0;
      // trimmed overhang -> debris
      if (mvL < ovL) addDebris(mvL, ovL - mvL, moving.hue);      // left slice
      if (mvR > ovR) addDebris(ovR, mvR - ovR, moving.hue);      // right slice
      newX = ovL; newW = overlap;
      score += 1;
      sPlace(stack.length);
      burst(ovL + overlap / 2, ROW_Y(), hueColor(moving.hue), 6);
    }

    stack.push({ x: newX, w: newW, hue: moving.hue });
    camTarget += BH; // scroll up by one block
    spawnMoving();
    updateHud();
  }

  function addDebris(x, w, hue) {
    debris.push({ x: x, y: ROW_Y(), w: w, h: BH, vx: (x < W / 2 ? -1 : 1) * 40, vy: -30, vr: (Math.random() - 0.5) * 6, r: 0, hue: hue, t: 0 });
  }

  function burst(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = Math.random() * 4 + 1.5;
      particles.push({ x: x, y: y, vx: Math.cos(a) * sp * 55, vy: Math.sin(a) * sp * 55 - 30, life: 0.6 + Math.random() * 0.4, t: 0, color: color, r: Math.random() * 3 + 1.5 });
    }
  }

  // ---------- Death / revive ----------
  function die() {
    if (state !== 'playing') return;
    state = 'over'; shake = 14; sDie();
    // the missed block falls
    if (moving) addDebris(moving.x, moving.w, moving.hue);
    moving = null;
    el.hud.classList.add('hidden');
    el.finalScore.textContent = score;
    var isBest = score > best;
    if (isBest) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
    el.newBest.classList.toggle('hidden', !isBest);
    el.goBest.textContent = best;
    var canContinue = continuesUsed < 1 && score >= 5;
    el.continueBtn.classList.toggle('hidden', !canContinue);
    el.gameover.classList.remove('hidden');
    deaths++;
    if (window.Ads && deaths % 2 === 0) Ads.showInterstitial();
  }

  function reviveContinue() {
    if (!window.Ads) { doRevive(); return; }
    el.continueBtn.disabled = true;
    Ads.showRewarded().then(function (earned) {
      el.continueBtn.disabled = false; el.continueBtn.classList.add('hidden');
      if (earned) { continuesUsed++; doRevive(); }
    });
  }
  function doRevive() {
    // restore a forgiving block aligned over the top and resume
    state = 'playing'; combo = 0;
    el.gameover.classList.add('hidden'); el.hud.classList.remove('hidden');
    spawnMoving();
    var top = stack[stack.length - 1];
    if (moving) { moving.x = top.x; } // start aligned to make it easy
    updateHud();
  }

  // ---------- Input ----------
  function onTap() { audio(); if (state === 'playing') drop(); }
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); onTap(); }, { passive: false });
  window.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onTap(); } });
  el.playBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.restartBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.continueBtn.addEventListener('click', function (e) { e.stopPropagation(); reviveContinue(); });
  el.homeBtn.addEventListener('click', function (e) {
    e.stopPropagation(); state = 'menu';
    el.gameover.classList.add('hidden'); el.start.classList.remove('hidden'); el.startBest.textContent = best;
  });
  el.muteBtn.addEventListener('click', function (e) {
    e.stopPropagation(); muted = !muted; localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    el.muteBtn.textContent = muted ? '🔇' : '🔊'; if (!muted) beep(660, 0.1, 'triangle', 0.12);
  });

  // ---------- Update ----------
  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (flash > 0) flash = Math.max(0, flash - dt);
    camY += (camTarget - camY) * Math.min(1, dt * 8);

    if (state === 'playing' && moving) {
      moving.x += moving.dir * moving.speed * dt;
      var top = stack[stack.length - 1];
      // bounce within a comfortable range around the screen
      var leftLimit = -moving.w * 0.15;
      var rightLimit = W - moving.w * 0.85;
      if (moving.x <= leftLimit) { moving.x = leftLimit; moving.dir = 1; }
      if (moving.x >= rightLimit) { moving.x = rightLimit; moving.dir = -1; }
    }

    for (var i = debris.length - 1; i >= 0; i--) {
      var d = debris[i]; d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 1400 * dt; d.r += d.vr * dt;
      if (d.y - camOffsetDelta() > H + 120) debris.splice(i, 1);
    }
    for (var j = particles.length - 1; j >= 0; j--) {
      var p = particles[j]; p.t += dt; if (p.t >= p.life) { particles.splice(j, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt;
    }
  }
  function camOffsetDelta() { return 0; }

  // ---------- Render ----------
  function screenYForRow(rowIndex) {
    // active row index = stack.length is drawn at ROW_Y(); lower rows are below
    var activeIndex = stack.length;
    return ROW_Y() + (activeIndex - rowIndex) * BH - (camTarget - camY);
  }

  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawBlock(x, w, screenY, hue) {
    var g = ctx.createLinearGradient(x, screenY, x, screenY + BH);
    g.addColorStop(0, hueColor(hue, 66));
    g.addColorStop(1, hueColor(hue, 46));
    ctx.fillStyle = g;
    roundRect(x, screenY, w, BH - 4, 7); ctx.fill();
    // top highlight
    ctx.fillStyle = hueColor(hue, 78);
    roundRect(x + 3, screenY + 2, w - 6, 5, 3); ctx.fill();
  }

  function render() {
    // background
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#241845'); bg.addColorStop(0.6, '#1a1030'); bg.addColorStop(1, '#120a22');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    var shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
    ctx.save(); ctx.translate(shx, shy);

    if (flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (flash * 0.5) + ')'; ctx.fillRect(-20, -20, W + 40, H + 40); }

    // stacked blocks (draw visible ones)
    for (var i = 0; i < stack.length; i++) {
      var sy = screenYForRow(i);
      if (sy > H + BH || sy < -BH) continue;
      drawBlock(stack[i].x, stack[i].w, sy, stack[i].hue);
    }
    // moving block
    if (moving && state === 'playing') {
      drawBlock(moving.x, moving.w, ROW_Y(), moving.hue);
    }
    // debris
    for (var d = 0; d < debris.length; d++) {
      var db = debris[d];
      ctx.save(); ctx.translate(db.x + db.w / 2, db.y + db.h / 2); ctx.rotate(db.r);
      ctx.globalAlpha = Math.max(0, 1 - db.t / 1.4);
      drawBlock(-db.w / 2, db.w, -db.h / 2, db.hue);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // particles
    for (var p = 0; p < particles.length; p++) {
      var pp = particles[p]; var f = 1 - pp.t / pp.life;
      ctx.globalAlpha = f; ctx.fillStyle = pp.color;
      ctx.beginPath(); ctx.arc(pp.x, pp.y, pp.r * f + 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  var last = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (window.Ads) Ads.init();
  document.addEventListener('visibilitychange', function () { if (document.hidden && actx) actx.suspend(); });
})();
