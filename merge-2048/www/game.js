/* =====================================================================
 * MERGE 2048 — swipe-to-merge puzzle
 * ---------------------------------------------------------------------
 * Swipe up/down/left/right to slide all tiles. Equal tiles merge and
 * double. A new tile appears after each move. Reach 2048 (and beyond).
 * Game over when the board is full with no merges left.
 *
 * Vanilla JS + Canvas with slide/merge/spawn animations. Capacitor +
 * AdMob ready (rewarded "continue" clears the lowest tiles).
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
    computeBoard();
  }
  window.addEventListener('resize', resize);

  // ---------- Board geometry ----------
  var N = 4;
  var board = { size: 0, x: 0, y: 0, pad: 0, cell: 0 };
  function computeBoard() {
    var size = Math.min(W * 0.92, H * 0.6, 460);
    board.size = size;
    board.pad = size * 0.028;
    board.cell = (size - board.pad * (N + 1)) / N;
    board.x = (W - size) / 2;
    board.y = Math.max(H * 0.30, (H - size) / 2 + 10);
  }
  function cellPx(r, c) {
    return {
      x: board.x + board.pad + c * (board.cell + board.pad),
      y: board.y + board.pad + r * (board.cell + board.pad)
    };
  }

  // ---------- Persistent ----------
  var BEST_KEY = 'merge2048.best', MUTE_KEY = 'merge2048.mute';
  var best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  var muted = localStorage.getItem(MUTE_KEY) === '1';

  var el = {
    topbar: document.getElementById('topbar'), score: document.getElementById('score'),
    topBest: document.getElementById('topBest'), toast: document.getElementById('toast'),
    start: document.getElementById('start'), startBest: document.getElementById('startBest'),
    gameover: document.getElementById('gameover'), finalScore: document.getElementById('finalScore'),
    newBest: document.getElementById('newBest'), goBest: document.getElementById('goBest'),
    continueBtn: document.getElementById('continueBtn'), restartBtn: document.getElementById('restartBtn'),
    homeBtn: document.getElementById('homeBtn'), playBtn: document.getElementById('playBtn'),
    muteBtn: document.getElementById('muteBtn')
  };
  el.startBest.textContent = best; el.topBest.textContent = best;
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
  function sMove() { beep(280, 0.06, 'sine', 0.08); }
  function sMerge(v) { var n = Math.log2(v); beep(300 + n * 45, 0.09, 'triangle', 0.16); }
  function sDie() { beep(150, 0.45, 'sawtooth', 0.2); }

  // ---------- Tile colors ----------
  var TILE_COLORS = {
    2: ['#1f4a3f', '#2ee6a6'], 4: ['#1f4a52', '#29c7ff'], 8: ['#3a3a72', '#7c8cff'],
    16: ['#52306e', '#b06cff'], 32: ['#6e2f5a', '#ff6cd0'], 64: ['#6e2f37', '#ff6c7c'],
    128: ['#6e5a2f', '#ffcf5c'], 256: ['#6e6a2f', '#ffe14d'], 512: ['#2f6e4a', '#5cff9e'],
    1024: ['#2f5a6e', '#5ccfff'], 2048: ['#6e4f2f', '#ffa83d']
  };
  function tileColors(v) { return TILE_COLORS[v] || ['#5a2f6e', '#d06cff']; }

  // ---------- State ----------
  var state = 'menu';      // menu | playing | over
  var grid = [];           // [r][c] -> tile | null
  var mergingOut = [];     // tiles merged away (animate then drop)
  var tileSeq = 1;
  var score = 0;
  var anim = 0, animating = false, ANIM_DUR = 0.12;
  var deaths = 0, continuesUsed = 0;
  var reached2048 = false;
  var shake = 0;

  function emptyGrid() { var g = []; for (var r = 0; r < N; r++) { g.push([]); for (var c = 0; c < N; c++) g[r].push(null); } return g; }
  function newTile(r, c, value) { return { id: tileSeq++, value: value, r: r, c: c, pr: r, pc: c, merged: false, spawn: true }; }

  function emptyCells() {
    var list = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!grid[r][c]) list.push({ r: r, c: c });
    return list;
  }
  function addRandomTile() {
    var cells = emptyCells(); if (!cells.length) return null;
    var pick = cells[Math.floor(Math.random() * cells.length)];
    var value = Math.random() < 0.9 ? 2 : 4;
    var t = newTile(pick.r, pick.c, value); grid[pick.r][pick.c] = t; return t;
  }

  function reset() {
    grid = emptyGrid(); mergingOut = []; score = 0; reached2048 = false;
    anim = 0; animating = false; shake = 0; continuesUsed = 0;
    addRandomTile(); addRandomTile();
    updateScore();
  }
  function startGame() {
    reset(); state = 'playing';
    el.start.classList.add('hidden'); el.gameover.classList.add('hidden'); el.topbar.classList.remove('hidden');
    beep(660, 0.1, 'triangle', 0.12);
  }
  function updateScore() {
    el.score.textContent = score;
    el.topBest.textContent = Math.max(best, score);
  }

  // ---------- Move logic ----------
  var VEC = { up: { r: -1, c: 0 }, down: { r: 1, c: 0 }, left: { r: 0, c: -1 }, right: { r: 0, c: 1 } };
  function inBounds(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  function traversals(vec) {
    var rs = [], cs = [];
    for (var i = 0; i < N; i++) { rs.push(i); cs.push(i); }
    if (vec.r === 1) rs.reverse();
    if (vec.c === 1) cs.reverse();
    return { rs: rs, cs: cs };
  }
  function farthest(r, c, vec) {
    var pr = r, pc = c, nr = r + vec.r, nc = c + vec.c;
    while (inBounds(nr, nc) && !grid[nr][nc]) { pr = nr; pc = nc; nr += vec.r; nc += vec.c; }
    return { fr: pr, fc: pc, nr: nr, nc: nc };
  }

  function move(dir) {
    if (state !== 'playing' || animating) return;
    var vec = VEC[dir]; var tr = traversals(vec);
    var moved = false; mergingOut = [];
    // reset per-move flags
    for (var r0 = 0; r0 < N; r0++) for (var c0 = 0; c0 < N; c0++) {
      var tt = grid[r0][c0]; if (tt) { tt.pr = tt.r; tt.pc = tt.c; tt.merged = false; tt.spawn = false; }
    }
    var gained = 0, mergedTo2048 = false;
    for (var ri = 0; ri < N; ri++) {
      for (var ci = 0; ci < N; ci++) {
        var r = tr.rs[ri], c = tr.cs[ci];
        var tile = grid[r][c];
        if (!tile) continue;
        var f = farthest(r, c, vec);
        var next = inBounds(f.nr, f.nc) ? grid[f.nr][f.nc] : null;
        if (next && next.value === tile.value && !next.merged) {
          // merge tile into next
          grid[r][c] = null;
          tile.r = f.nr; tile.c = f.nc;       // slide onto target, then vanish
          mergingOut.push(tile);
          next.value *= 2; next.merged = true;
          gained += next.value;
          if (next.value === 2048 && !reached2048) mergedTo2048 = true;
          moved = true;
        } else if (f.fr !== r || f.fc !== c) {
          grid[r][c] = null; grid[f.fr][f.fc] = tile; tile.r = f.fr; tile.c = f.fc;
          moved = true;
        }
      }
    }
    if (!moved) return;
    score += gained;
    if (gained > 0) sMerge(Math.max(4, gained)); else sMove();
    addRandomTile();
    anim = 0; animating = true;
    updateScore();
    if (mergedTo2048) { reached2048 = true; showToast('¡2048! 🎉'); }
    if (!movesAvailable()) {
      // delay game over slightly so the last animation plays
      setTimeout(function () { if (state === 'playing') gameOver(); }, 220);
    }
  }

  function movesAvailable() {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var t = grid[r][c]; if (!t) return true;
      var right = c < N - 1 ? grid[r][c + 1] : null;
      var down = r < N - 1 ? grid[r + 1][c] : null;
      if (right && right.value === t.value) return true;
      if (down && down.value === t.value) return true;
    }
    return false;
  }

  function showToast(text) {
    el.toast.textContent = text; el.toast.classList.remove('hidden');
    el.toast.style.animation = 'none'; void el.toast.offsetWidth; el.toast.style.animation = '';
    clearTimeout(showToast._t); showToast._t = setTimeout(function () { el.toast.classList.add('hidden'); }, 1400);
  }

  // ---------- Game over / continue ----------
  function gameOver() {
    state = 'over'; shake = 10; sDie();
    el.topbar.classList.add('hidden');
    el.finalScore.textContent = score;
    var isBest = score > best;
    if (isBest) { best = score; localStorage.setItem(BEST_KEY, String(best)); }
    el.newBest.classList.toggle('hidden', !isBest);
    el.goBest.textContent = best;
    el.continueBtn.classList.toggle('hidden', !(continuesUsed < 1));
    el.gameover.classList.remove('hidden');
    deaths++;
    if (window.Ads && deaths % 2 === 0) Ads.showInterstitial();
  }
  function continueGame() {
    if (!window.Ads) { doContinue(); return; }
    el.continueBtn.disabled = true;
    Ads.showRewarded().then(function (earned) {
      el.continueBtn.disabled = false; el.continueBtn.classList.add('hidden');
      if (earned) { continuesUsed++; doContinue(); }
    });
  }
  function doContinue() {
    // remove the lowest-value tiles to free up space
    var all = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (grid[r][c]) all.push(grid[r][c]);
    all.sort(function (a, b) { return a.value - b.value; });
    var removeCount = Math.min(4, all.length - 2);
    for (var i = 0; i < removeCount; i++) { var t = all[i]; grid[t.r][t.c] = null; }
    state = 'playing';
    el.gameover.classList.add('hidden'); el.topbar.classList.remove('hidden');
    showToast('+espacio');
    updateScore();
  }

  // ---------- Input: swipe + keys ----------
  var touchStart = null;
  canvas.addEventListener('pointerdown', function (e) { audio(); touchStart = { x: e.clientX, y: e.clientY }; }, { passive: false });
  canvas.addEventListener('pointerup', function (e) {
    if (!touchStart) return;
    var dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    touchStart = null;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return; // too small
    if (ax > ay) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  });
  window.addEventListener('keydown', function (e) {
    var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    if (map[e.code]) { e.preventDefault(); move(map[e.code]); }
  });
  el.playBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.restartBtn.addEventListener('click', function (e) { e.stopPropagation(); startGame(); });
  el.continueBtn.addEventListener('click', function (e) { e.stopPropagation(); continueGame(); });
  el.homeBtn.addEventListener('click', function (e) {
    e.stopPropagation(); state = 'menu';
    el.gameover.classList.add('hidden'); el.start.classList.remove('hidden'); el.startBest.textContent = best;
  });
  el.muteBtn.addEventListener('click', function (e) {
    e.stopPropagation(); muted = !muted; localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    el.muteBtn.textContent = muted ? '🔇' : '🔊'; if (!muted) beep(660, 0.1, 'triangle', 0.1);
  });

  // ---------- Update ----------
  function update(dt) {
    if (shake > 0) shake = Math.max(0, shake - dt * 60);
    if (animating) {
      anim += dt;
      if (anim >= ANIM_DUR) { animating = false; mergingOut = []; }
    }
  }

  // ---------- Render ----------
  function roundRect(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function fontFor(v, cell) {
    var len = ('' + v).length;
    var size = cell * (len <= 2 ? 0.42 : len === 3 ? 0.34 : 0.27);
    return '800 ' + size + 'px -apple-system, Segoe UI, Roboto, sans-serif';
  }
  function drawTile(t, prog) {
    var from = cellPx(t.pr, t.pc), to = cellPx(t.r, t.c);
    var ease = prog * (2 - prog);
    var x = from.x + (to.x - from.x) * ease;
    var y = from.y + (to.y - from.y) * ease;
    var cell = board.cell, scale = 1;
    if (t.spawn) scale = 0.3 + 0.7 * prog;
    else if (t.merged) scale = 1 + 0.18 * Math.sin(Math.min(1, prog) * Math.PI);
    var cw = cell * scale, ch = cell * scale;
    var ox = x + (cell - cw) / 2, oy = y + (cell - ch) / 2;
    var col = tileColors(t.value);
    var g = ctx.createLinearGradient(ox, oy, ox, oy + ch);
    g.addColorStop(0, col[1]); g.addColorStop(1, col[0]);
    ctx.fillStyle = g;
    ctx.shadowColor = col[1]; ctx.shadowBlur = 14;
    roundRect(ox, oy, cw, ch, cell * 0.16); ctx.fill();
    ctx.shadowBlur = 0;
    // number
    ctx.fillStyle = '#ffffff';
    ctx.font = fontFor(t.value, cell * scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('' + t.value, ox + cw / 2, oy + ch / 2 + 1);
  }

  function render() {
    var bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#123329'); bg.addColorStop(0.6, '#0c1f1a'); bg.addColorStop(1, '#08160f');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    var shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
    ctx.save(); ctx.translate(shx, shy);

    // board backing
    roundRect(board.x, board.y, board.size, board.size, board.size * 0.04);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill();
    // empty cells
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
      var p = cellPx(r, c);
      roundRect(p.x, p.y, board.cell, board.cell, board.cell * 0.16);
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
    }

    if (state !== 'menu') {
      var prog = animating ? Math.min(1, anim / ANIM_DUR) : 1;
      // merging-out tiles first (slide under)
      for (var m = 0; m < mergingOut.length; m++) drawTile(mergingOut[m], prog);
      // grid tiles
      for (var rr = 0; rr < N; rr++) for (var cc = 0; cc < N; cc++) {
        var t = grid[rr][cc]; if (t) drawTile(t, prog);
      }
    }
    ctx.restore();
  }

  var last = 0;
  function frame(now) {
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); render(); requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  if (window.Ads) Ads.init();
  document.addEventListener('visibilitychange', function () { if (document.hidden && actx) actx.suspend(); });
})();
