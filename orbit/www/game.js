/* =====================================================================
 * ORBIT — a gravity slingshot arcade game
 * ---------------------------------------------------------------------
 * You orbit a planet. Tap to let go and fly off on a tangent. Real
 * gravity from the planets bends your path — get captured by the next
 * planet's orbit to chain upward through an endless star field. Miss,
 * and you drift into the void.
 *
 * A dotted preview line shows where a release right now would take you,
 * so it's about timing + reading the gravity. Vanilla JS + Canvas.
 * Capacitor + AdMob ready (ads.js).
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

  // ---------- Tuning ----------
  // gm = r·GM_K, kept below escape velocity at release radius so a tangent
  // release escapes the current planet while still curving the path nicely.
  var GM_K = 20000;       // gravity strength per unit planet radius
  var GRAV_RANGE = 700;   // planets pull within this distance while flying
  var MAX_ACCEL = 5200;   // clamp gravity so near passes don't explode
  var MAX_FLY = 4.2;      // seconds adrift before "lost in space"
  var RING_PAD = 32;      // capture ring = planet.r + this

  // ---------- Persistent ----------
  var BEST_KEY = 'orbit.best', MUTE_KEY = 'orbit.mute';
  var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  var muted = localStorage.getItem(MUTE_KEY) === '1';

  var el = {
    hud: document.getElementById('hud'), score: document.getElementById('score'), combo: document.getElementById('combo'),
    start: document.getElementById('start'), startBest: document.getElementById('startBest'),
    gameover: document.getElementById('gameover'), finalScore: document.getElementById('finalScore'),
    newBest: document.getElementById('newBest'), goBest: document.getElementById('goBest'),
    continueBtn: document.getElementById('continueBtn'), restartBtn: document.getElementById('restartBtn'),
    homeBtn: document.getElementById('homeBtn'), playBtn: document.getElementById('playBtn'),
    muteBtn: document.getElementById('muteBtn'), tapHint: document.getElementById('tapHint')
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
    g.gain.exponentialRampToValueAtTime(vol || 0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function sLaunch() { beep(420, 0.12, 'sawtooth', 0.12); beep(640, 0.10, 'sine', 0.07); }
  function sCapture(c) { beep(420 + Math.min(c, 18) * 32, 0.10, 'triangle', 0.15); beep(880, 0.06, 'sine', 0.06); }
  function sGem() { beep(1040, 0.07, 'triangle', 0.14); beep(1560, 0.08, 'sine', 0.07); }
  function sDie() { beep(150, 0.55, 'sawtooth', 0.2); beep(80, 0.6, 'sine', 0.1); }

  // ---------- State ----------
  var state = 'menu';     // menu | playing | dying | over
  var planets = [];       // {x,y,r,gm,gems:[{ang,rad,got}],hue}
  var topGenY = 0;        // smallest y generated so far (further = up)
  var ship = { x: 0, y: 0, vx: 0, vy: 0, mode: 'orbit', planet: null, r: 0, ang: 0, dir: 1, flyT: 0 };
  var cam = { x: 0, y: 0 };
  var targetSpeed = 230;
  var startY = 0;         // ship.y at game start (height baseline)
  var bestY = 0;          // smallest ship.y reached (max height)
  var score = 0, combo = 0;
  var lastLeft = null;    // planet just released (ignored for capture until exited)
  var particles = [], pops = [], shake = 0, captureFlash = 0;
  var deaths = 0, continuesUsed = 0;
  var stars = [];

  function rand(a, b) { return a + Math.random() * (b - a); }
  function hsl(h, l) { return 'hsl(' + h + ',75%,' + (l || 60) + '%)'; }

  function initStars() {
    stars = [];
    for (var i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), z: rand(0.2, 1), r: rand(0.4, 1.7) });
  }
  initStars();

  // ---------- Planet generation ----------
  function difficulty() { return Math.min(1, height() / 12000); }
  function makePlanet(x, y) {
    var d = difficulty();
    var r = rand(46 - d * 14, 30 - d * 8); // shrinks with difficulty
    r = Math.max(20, r);
    var p = { x: x, y: y, r: r, gm: r * GM_K, hue: rand(190, 320), gems: [] };
    var ng = Math.random() < 0.55 ? (1 + (Math.random() < 0.4 ? 1 : 0)) : 0;
    for (var i = 0; i < ng; i++) p.gems.push({ ang: rand(0, Math.PI * 2), rad: r + rand(26, 40), got: false });
    return p;
  }
  function generateAhead() {
    // keep planets generated well above the camera
    while (topGenY > cam.y - H * 1.6) {
      var prev = planets[planets.length - 1];
      var d = difficulty();
      var gap = rand(180 + d * 70, 250 + d * 110);
      var dx = rand(-150 - d * 40, 150 + d * 40);
      var nx = prev.x + dx;
      var ny = prev.y - gap;
      planets.push(makePlanet(nx, ny));
      topGenY = ny;
    }
  }

  function height() { return Math.max(0, startY - bestY); }

  // ---------- Gravity ----------
  function gravityAt(x, y, ignore) {
    var ax = 0, ay = 0;
    for (var i = planets.length - 1; i >= 0; i--) {
      var p = planets[i];
      if (p === ignore) continue;
      var dx = p.x - x, dy = p.y - y;
      var d2 = dx * dx + dy * dy;
      if (d2 > GRAV_RANGE * GRAV_RANGE) continue;
      var d = Math.sqrt(d2) || 1;
      var a = Math.min(MAX_ACCEL, p.gm / Math.max(d2, p.r * p.r));
      ax += a * dx / d; ay += a * dy / d;
    }
    return { ax: ax, ay: ay };
  }

  // ---------- Reset / start ----------
  function reset() {
    planets = []; particles = []; pops = []; shake = 0; captureFlash = 0;
    combo = 0; score = 0; continuesUsed = 0; lastLeft = null;
    targetSpeed = 230;
    var p0 = { x: 0, y: 0, r: 42, gm: 42 * GM_K, hue: 210, gems: [] };
    planets.push(p0);
    topGenY = 0;
    // a few starter planets going up
    for (var i = 0; i < 4; i++) {
      var prev = planets[planets.length - 1];
      planets.push(makePlanet(prev.x + rand(-120, 120), prev.y - rand(200, 240)));
      topGenY = planets[planets.length - 1].y;
    }
    // ship orbiting first planet
    ship.planet = p0; ship.mode = 'orbit'; ship.r = p0.r + RING_PAD; ship.ang = -Math.PI / 2; ship.dir = 1; ship.flyT = 0;
    placeOrbit();
    startY = ship.y; bestY = ship.y;
    cam.x = ship.x; cam.y = ship.y - H * 0.18;
    generateAhead();
    updateHud();
  }
  function placeOrbit() {
    var p = ship.planet;
    ship.x = p.x + Math.cos(ship.ang) * ship.r;
    ship.y = p.y + Math.sin(ship.ang) * ship.r;
  }

  function startGame() {
    reset(); state = 'playing';
    el.start.classList.add('hidden'); el.gameover.classList.add('hidden'); el.hud.classList.remove('hidden');
    el.tapHint.classList.remove('hidden');
    beep(660, 0.1, 'triangle', 0.12);
  }
  function updateHud() {
    score = Math.floor(height() / 10) + combo * 0; // base on height; gems add below
    el.score.textContent = displayScore();
    if (combo >= 2) { el.combo.textContent = 'x' + combo; el.combo.classList.remove('hidden'); }
    else el.combo.classList.add('hidden');
  }
  var gemScore = 0;
  function displayScore() { return Math.floor(height() / 10) + gemScore; }

  // ---------- Release / capture ----------
  function release() {
    if (ship.mode !== 'orbit') return;
    var p = ship.planet;
    var rx = Math.cos(ship.ang), ry = Math.sin(ship.ang);
    // tangent direction
    var tx = -ry * ship.dir, ty = rx * ship.dir;
    ship.vx = tx * targetSpeed; ship.vy = ty * targetSpeed;
    ship.mode = 'fly'; ship.flyT = 0;
    lastLeft = p;
    sLaunch();
    spawnParticles(ship.x, ship.y, hsl(p.hue, 70), 10, 2.5);
    el.tapHint.classList.add('hidden');
  }

  function tryCapture() {
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var dx = ship.x - p.x, dy = ship.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var ring = p.r + RING_PAD;
      if (p === lastLeft) { if (d > ring + 24) lastLeft = null; continue; }
      if (d <= ring && d >= p.r * 0.6) {
        capture(p, d, dx, dy);
        return;
      }
    }
  }
  function capture(p, d, dx, dy) {
    ship.planet = p; ship.mode = 'orbit';
    ship.r = Math.max(p.r + 16, Math.min(d, p.r + RING_PAD));
    ship.ang = Math.atan2(dy, dx);
    // keep rotation direction consistent with incoming velocity (cross product sign)
    var cross = dx * ship.vy - dy * ship.vx;
    ship.dir = cross >= 0 ? 1 : -1;
    placeOrbit();
    combo++;
    captureFlash = 0.25; shake = Math.min(8, 3 + combo * 0.3);
    sCapture(combo);
    spawnParticles(ship.x, ship.y, hsl(p.hue, 75), 14, 3);
    if (combo >= 2) addPop('x' + combo, hsl(p.hue, 75));
    // speed ramps gently with height
    targetSpeed = 230 + Math.min(150, height() * 0.012);
    updateHud();
  }

  // ---------- Effects ----------
  function spawnParticles(x, y, color, n, sp) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = Math.random() * sp + 1;
      particles.push({ x: x, y: y, vx: Math.cos(a) * s * 55, vy: Math.sin(a) * s * 55, life: 0.5 + Math.random() * 0.5, t: 0, color: color, r: Math.random() * 2.5 + 1 });
    }
  }
  function addPop(text, color) { pops.push({ x: ship.x, y: ship.y, text: text, color: color, t: 0, life: 0.9 }); }

  // ---------- Death / revive ----------
  function die() {
    if (state !== 'playing') return;
    state = 'dying'; shake = 14; sDie();
    spawnParticles(ship.x, ship.y, '#5cf0ff', 24, 4); spawnParticles(ship.x, ship.y, '#c46bff', 16, 3);
    setTimeout(showGameOver, 800);
  }
  function showGameOver() {
    state = 'over';
    el.hud.classList.add('hidden');
    var sc = displayScore();
    el.finalScore.textContent = sc;
    var isBest = sc > best;
    if (isBest) { best = sc; localStorage.setItem(BEST_KEY, String(best)); }
    el.newBest.classList.toggle('hidden', !isBest);
    el.goBest.textContent = best;
    el.continueBtn.classList.toggle('hidden', !(continuesUsed < 1 && sc >= 5));
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
    // re-capture onto the nearest planet near the camera top
    var bestP = null, bestD = 1e9;
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var dy = p.y - (cam.y - H * 0.1);
      var d = Math.abs(dy) + Math.abs(p.x - cam.x) * 0.3;
      if (p.y < cam.y + H * 0.4 && d < bestD) { bestD = d; bestP = p; }
    }
    if (!bestP) bestP = planets[planets.length - 1];
    ship.planet = bestP; ship.mode = 'orbit'; ship.r = bestP.r + RING_PAD; ship.ang = -Math.PI / 2; ship.dir = 1; ship.flyT = 0;
    placeOrbit();
    lastLeft = null; combo = 0; state = 'playing';
    el.gameover.classList.add('hidden'); el.hud.classList.remove('hidden');
    updateHud();
  }

  // ---------- Input ----------
  function onTap() { audio(); if (state === 'playing') release(); }
  canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); onTap(); }, { passive: false });
  window.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); onTap(); } });
  el.playBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.restartBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.continueBtn.addEventListener('click', function (e) { e.stopPropagation(); reviveContinue(); });
  el.homeBtn.addEventListener('click', function (e) { e.stopPropagation(); state = 'menu'; el.gameover.classList.add('hidden'); el.start.classList.remove('hidden'); el.startBest.textContent = best; });
  el.muteBtn.addEventListener('click', function (e) { e.stopPropagation(); muted = !muted; localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); el.muteBtn.textContent = muted ? '🔇' : '🔊'; if (!muted) beep(660, 0.1, 'triangle', 0.1); });

  // ---------- Update ----------
  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (captureFlash > 0) captureFlash = Math.max(0, captureFlash - dt);
    for (var i = particles.length - 1; i >= 0; i--) { var p = particles[i]; p.t += dt; if (p.t >= p.life) { particles.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.97; p.vy *= 0.97; }
    for (var j = pops.length - 1; j >= 0; j--) { var pu = pops[j]; pu.t += dt; pu.y -= 26 * dt; if (pu.t >= pu.life) pops.splice(j, 1); }

    if (state === 'dying') { ship.x += ship.vx * dt; ship.y += ship.vy * dt; ship.vy += 120 * dt; return; }
    if (state !== 'playing') return;

    if (ship.mode === 'orbit') {
      var p = ship.planet;
      var w = targetSpeed / ship.r;
      ship.ang += ship.dir * w * dt;
      placeOrbit();
      collectGems();
    } else {
      // flying: integrate gravity
      var g = gravityAt(ship.x, ship.y, null);
      ship.vx += g.ax * dt; ship.vy += g.ay * dt;
      ship.x += ship.vx * dt; ship.y += ship.vy * dt;
      ship.flyT += dt;
      collectGems();
      tryCapture();
      if (ship.flyT > MAX_FLY) { die(); return; }
    }

    // height / camera
    if (ship.y < bestY) bestY = ship.y;
    cam.x += (ship.x - cam.x) * Math.min(1, dt * 4);
    var camYTarget = ship.y - H * 0.18;
    if (camYTarget < cam.y) cam.y += (camYTarget - cam.y) * Math.min(1, dt * 5);

    // death: fell below view, or drifted too far sideways
    var sy = ship.y - cam.y + H / 2;
    var sx = ship.x - cam.x + W / 2;
    if (sy > H + 70 || sx < -90 || sx > W + 90) { die(); return; }

    generateAhead();
    // cull planets well below
    while (planets.length > 60 && planets[0].y > cam.y + H * 1.2) planets.shift();
    updateHud();
  }

  function collectGems() {
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i]; if (!p.gems.length) continue;
      for (var k = 0; k < p.gems.length; k++) {
        var gm = p.gems[k]; if (gm.got) continue;
        var gx = p.x + Math.cos(gm.ang) * gm.rad, gy = p.y + Math.sin(gm.ang) * gm.rad;
        var dx = ship.x - gx, dy = ship.y - gy;
        if (dx * dx + dy * dy < 22 * 22) {
          gm.got = true; gemScore += 5 + combo;
          spawnParticles(gx, gy, '#ffd66b', 10, 2.5); sGem(); addPop('+' + (5 + combo), '#ffd66b');
        }
      }
    }
  }

  // ---------- Trajectory preview ----------
  function predictPath() {
    if (ship.mode !== 'orbit') return null;
    var p = ship.planet;
    var rx = Math.cos(ship.ang), ry = Math.sin(ship.ang);
    var tx = -ry * ship.dir, ty = rx * ship.dir;
    var x = ship.x, y = ship.y, vx = tx * targetSpeed, vy = ty * targetSpeed;
    var pts = [{ x: x, y: y }];
    var h = 1 / 60;
    for (var s = 0; s < 110; s++) {
      var g = gravityAt(x, y, null);
      vx += g.ax * h; vy += g.ay * h; x += vx * h; y += vy * h;
      if (s % 2 === 0) pts.push({ x: x, y: y });
      // stop if it would capture another planet (the one we leave is skipped,
      // matching the real lastLeft rule)
      for (var i = 0; i < planets.length; i++) {
        var q = planets[i]; if (q === p) continue;
        var dx = x - q.x, dy = y - q.y; var dd = Math.sqrt(dx * dx + dy * dy);
        if (dd <= q.r + RING_PAD) { pts.push({ x: x, y: y, hit: q }); return pts; }
      }
      if (y - cam.y + H / 2 > H + 40) break;
    }
    return pts;
  }

  // ---------- Render ----------
  function worldToScreen(x, y, ox, oy) { return { x: x - cam.x + W / 2 + ox, y: y - cam.y + H / 2 + oy }; }

  function drawBackground(ox, oy) {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0c1e'); bg.addColorStop(0.6, '#05060f'); bg.addColorStop(1, '#03040a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var sx = (s.x * W - cam.x * 0.15 * s.z) % W; if (sx < 0) sx += W;
      var sy = (s.y * H - cam.y * 0.15 * s.z) % H; if (sy < 0) sy += H;
      ctx.globalAlpha = 0.3 + s.z * 0.5; ctx.fillStyle = '#bcd8ff';
      ctx.beginPath(); ctx.arc(sx + ox * 0.3, sy + oy * 0.3, s.r * s.z, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    var shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
    drawBackground(shx, shy);

    // gravity range glow + planets
    for (var i = 0; i < planets.length; i++) {
      var p = planets[i];
      var c = worldToScreen(p.x, p.y, shx, shy);
      if (c.y < -120 || c.y > H + 120) continue;
      // capture ring
      ctx.beginPath(); ctx.arc(c.x, c.y, p.r + RING_PAD, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(120,180,255,0.18)'; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.stroke(); ctx.setLineDash([]);
      // body
      var grd = ctx.createRadialGradient(c.x - p.r * 0.3, c.y - p.r * 0.3, p.r * 0.2, c.x, c.y, p.r);
      grd.addColorStop(0, hsl(p.hue, 70)); grd.addColorStop(1, hsl(p.hue, 34));
      ctx.fillStyle = grd; ctx.shadowColor = hsl(p.hue, 60); ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(c.x, c.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      // gems
      for (var k = 0; k < p.gems.length; k++) {
        var gm = p.gems[k]; if (gm.got) continue;
        var gx = p.x + Math.cos(gm.ang) * gm.rad, gy = p.y + Math.sin(gm.ang) * gm.rad;
        var gc = worldToScreen(gx, gy, shx, shy);
        ctx.save(); ctx.translate(gc.x, gc.y); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffd66b'; ctx.shadowColor = '#ffd66b'; ctx.shadowBlur = 12;
        ctx.fillRect(-6, -6, 12, 12); ctx.restore(); ctx.shadowBlur = 0;
      }
    }

    // trajectory preview
    if (state === 'playing' && ship.mode === 'orbit') {
      var path = predictPath();
      if (path && path.length > 1) {
        ctx.beginPath();
        for (var n = 0; n < path.length; n++) {
          var sp = worldToScreen(path[n].x, path[n].y, shx, shy);
          if (n === 0) ctx.moveTo(sp.x, sp.y); else ctx.lineTo(sp.x, sp.y);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([3, 8]); ctx.stroke(); ctx.setLineDash([]);
        var last = path[path.length - 1];
        if (last.hit) { var hc = worldToScreen(last.x, last.y, shx, shy); ctx.beginPath(); ctx.arc(hc.x, hc.y, 7, 0, Math.PI * 2); ctx.fillStyle = '#7CFFB2'; ctx.fill(); }
      }
    }

    // orbit ring of current planet
    if (state === 'playing' && ship.mode === 'orbit') {
      var pc = worldToScreen(ship.planet.x, ship.planet.y, shx, shy);
      ctx.beginPath(); ctx.arc(pc.x, pc.y, ship.r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(92,240,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // ship
    if (state !== 'menu') {
      var s = worldToScreen(ship.x, ship.y, shx, shy);
      var ang = ship.mode === 'orbit' ? ship.ang + ship.dir * Math.PI / 2 : Math.atan2(ship.vy, ship.vx);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(ang + Math.PI / 2);
      ctx.shadowColor = '#5cf0ff'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#eaffff'; ctx.beginPath();
      ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.shadowBlur = 0;
    }

    // particles
    for (var pi = 0; pi < particles.length; pi++) {
      var pt = particles[pi]; var f = 1 - pt.t / pt.life; var sc = worldToScreen(pt.x, pt.y, shx, shy);
      ctx.globalAlpha = f; ctx.fillStyle = pt.color; ctx.beginPath(); ctx.arc(sc.x, sc.y, pt.r * f + 0.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // pops
    for (var qi = 0; qi < pops.length; qi++) {
      var pp = pops[qi]; var psc = worldToScreen(pp.x, pp.y, shx, shy);
      ctx.globalAlpha = 1 - pp.t / pp.life; ctx.fillStyle = pp.color; ctx.font = '800 22px -apple-system, Segoe UI, Roboto, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(pp.text, psc.x, psc.y);
    }
    ctx.globalAlpha = 1;

    if (captureFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (captureFlash * 0.4) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  var last = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(0.033, (now - last) / 1000); last = now;
    update(dt); render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if (window.Ads) Ads.init();
  document.addEventListener('visibilitychange', function () { if (document.hidden && actx) actx.suspend(); });
})();
