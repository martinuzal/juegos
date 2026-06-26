/*
 * Ads wrapper — Neon Zigzag
 * -------------------------------------------------------------
 * Uses the Capacitor community AdMob plugin when running inside the
 * native app (Android / iOS). When running in a plain browser (dev /
 * web build) it falls back to a lightweight simulated "ad" so the game
 * flow can be tested without the native SDK.
 *
 * IMPORTANT (before publishing):
 *   1. Replace the TEST ad unit ids below with your real AdMob ids.
 *   2. Keep `useTestAds: true` until your app is approved, then flip it.
 *   3. See README.md -> "Monetización" for the full setup.
 */
(function () {
  'use strict';

  // ---- CONFIG: replace with your real AdMob ids before release ----
  var CONFIG = {
    useTestAds: false, // <-- set to false for production
    appId: {
      // From AdMob console. Also goes in AndroidManifest / Info.plist.
      android: 'ca-app-pub-4525467942010959~3427606080',
      ios:     'ca-app-pub-4525467942010959~8524441552'
    },
    // Google's official TEST ad unit ids (safe to ship while testing):
    test: {
      interstitial: { android: 'ca-app-pub-3940256099942544/1033173712',
                      ios:     'ca-app-pub-3940256099942544/4411468910' },
      rewarded:     { android: 'ca-app-pub-3940256099942544/5224354917',
                      ios:     'ca-app-pub-3940256099942544/1712485313' }
    },
    // YOUR real ad unit ids (used when useTestAds === false):
    prod: {
      interstitial: { android: 'ca-app-pub-4525467942010959/3411715676',
                      ios:     'ca-app-pub-4525467942010959/4200229336' },
      rewarded:     { android: 'ca-app-pub-4525467942010959/1574065996',
                      ios:     'ca-app-pub-4525467942010959/6906283724' }
    }
  };

  function platform() {
    var cap = window.Capacitor;
    if (cap && typeof cap.getPlatform === 'function') return cap.getPlatform();
    return 'web';
  }

  function isNative() {
    var cap = window.Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  }

  function adUnit(kind) {
    var set = CONFIG.useTestAds ? CONFIG.test : CONFIG.prod;
    var p = platform();
    return (set[kind] && set[kind][p]) || set[kind].android;
  }

  function AdMobPlugin() {
    var p = window.Capacitor && window.Capacitor.Plugins;
    return p && p.AdMob ? p.AdMob : null;
  }

  var ready = false;

  async function init() {
    var AdMob = AdMobPlugin();
    if (!isNative() || !AdMob) {
      ready = true; // web fallback
      return;
    }
    try {
      await AdMob.initialize({
        initializeForTesting: CONFIG.useTestAds,
        requestTrackingAuthorization: true
      });
      ready = true;
      // Pre-load so the first ad is instant.
      prepareInterstitial();
      prepareRewarded();
    } catch (e) {
      console.warn('[ads] init failed, using fallback', e);
      ready = true;
    }
  }

  async function prepareInterstitial() {
    var AdMob = AdMobPlugin();
    if (!isNative() || !AdMob) return;
    try {
      await AdMob.prepareInterstitial({ adId: adUnit('interstitial') });
    } catch (e) { /* will retry on show */ }
  }

  async function prepareRewarded() {
    var AdMob = AdMobPlugin();
    if (!isNative() || !AdMob) return;
    try {
      await AdMob.prepareRewardVideoAd({ adId: adUnit('rewarded') });
    } catch (e) { /* will retry on show */ }
  }

  // Simulated full-screen ad for the web/dev fallback.
  function simulateAd(rewarded) {
    return new Promise(function (resolve) {
      var ov = document.createElement('div');
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;background:#000;color:#fff;font-family:sans-serif;text-align:center;gap:14px';
      var secs = 3;
      ov.innerHTML = '<div style="font-size:12px;letter-spacing:3px;opacity:.5">ANUNCIO (SIMULADO)</div>' +
        '<div style="font-size:24px;font-weight:800">Tu anuncio aquí</div>' +
        '<div id="adcount" style="font-size:14px;opacity:.7">Cierra en ' + secs + 's…</div>';
      document.body.appendChild(ov);
      var t = setInterval(function () {
        secs--;
        var c = ov.querySelector('#adcount');
        if (c) c.textContent = secs > 0 ? ('Cierra en ' + secs + 's…') : 'Cerrando…';
        if (secs <= 0) {
          clearInterval(t);
          ov.remove();
          resolve(rewarded ? true : undefined);
        }
      }, 700);
    });
  }

  // Show interstitial. Resolves when dismissed. Never throws.
  async function showInterstitial() {
    var AdMob = AdMobPlugin();
    if (!isNative() || !AdMob) return simulateAd(false);
    try {
      await AdMob.showInterstitial();
      prepareInterstitial(); // preload next
    } catch (e) {
      console.warn('[ads] interstitial failed', e);
    }
  }

  // Show rewarded. Resolves true if the user earned the reward.
  async function showRewarded() {
    var AdMob = AdMobPlugin();
    if (!isNative() || !AdMob) return simulateAd(true);
    return new Promise(function (resolve) {
      var earned = false;
      var done = function (val) { resolve(val); };
      try {
        // Listen once for the reward event.
        var sub = AdMob.addListener('onRewardedVideoAdReward', function () { earned = true; });
        AdMob.addListener('onRewardedVideoAdClosed', function () {
          if (sub && sub.remove) sub.remove();
          prepareRewarded();
          done(earned);
        });
        AdMob.showRewardVideoAd().catch(function () { done(false); });
      } catch (e) {
        console.warn('[ads] rewarded failed', e);
        done(false);
      }
    });
  }

  window.Ads = {
    init: init,
    showInterstitial: showInterstitial,
    showRewarded: showRewarded,
    get ready() { return ready; }
  };
})();
