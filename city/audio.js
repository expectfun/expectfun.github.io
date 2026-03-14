/**
 * City background: "Neon Drift" — dark ambient cyberpunk track.
 * Procedural only (Web Audio API), no external assets.
 */
(function () {
  'use strict';

  var isInFrame = false;
  try {
    isInFrame = window.top && window.top !== window;
  } catch (_) {
    isInFrame = true;
  }
  if (isInFrame) return;

  var TRACK_NAME = 'Neon Drift';
  var enabled = false;
  try {
    if (localStorage.getItem('city-music-enabled') === 'on') enabled = true;
  } catch (_) {}
  var volume = 0.38;
  var shouldBeAudible = true;
  var FADE_IN_MS = 1200;
  var FADE_OUT_MS = 2000;

  var audioContext = null;
  var masterGain = null;
  var armed = false;
  var started = false;
  var fadeOutTimeout = 0;

  var droneNodes = [];
  var padNodes = [];
  var reverbNode = null;

  function now() {
    return audioContext ? audioContext.currentTime : 0;
  }

  function setMaster(target, ms) {
    if (!masterGain) return;
    var t = now();
    var seconds = Math.max(0, (ms || 0) / 1000);
    try {
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterGain.gain.value, t);
      masterGain.gain.linearRampToValueAtTime(target, t + seconds);
    } catch (_) {
      masterGain.gain.value = target;
    }
  }

  function createReverbBuffer(ctx, lengthSeconds, decay) {
    var sampleRate = ctx.sampleRate;
    var length = Math.floor(sampleRate * lengthSeconds);
    var buffer = ctx.createBuffer(2, length, sampleRate);
    var L = buffer.getChannelData(0);
    var R = buffer.getChannelData(1);
    for (var i = 0; i < length; i++) {
      var t = i / sampleRate;
      var d = Math.exp(-t / decay);
      L[i] = (Math.random() * 2 - 1) * d;
      R[i] = (Math.random() * 2 - 1) * d;
    }
    return buffer;
  }

  function createNoiseBuffer(ctx, seconds) {
    var frames = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1);
    return buffer;
  }

  function initAudioGraph() {
    if (audioContext && masterGain) return true;

    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;

    audioContext = new Ctor({ latencyHint: 'playback' });

    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.0;

    var comp = audioContext.createDynamicsCompressor();
    comp.threshold.value = -24;
    comp.knee.value = 20;
    comp.ratio.value = 3;
    comp.attack.value = 0.02;
    comp.release.value = 0.3;

    masterGain.connect(comp);
    comp.connect(audioContext.destination);

    var revBuffer = createReverbBuffer(audioContext, 1.8, 0.42);
    reverbNode = audioContext.createConvolver();
    reverbNode.buffer = revBuffer;

    var revGain = audioContext.createGain();
    revGain.gain.value = 0.38;
    reverbNode.connect(revGain);
    revGain.connect(masterGain);

    var dryGain = audioContext.createGain();
    dryGain.gain.value = 0.72;
    dryGain.connect(masterGain);

    // ——— Bass drone (low, slow movement) ———
    var bassFreq = 55;
    var osc1 = audioContext.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = bassFreq;

    var osc2 = audioContext.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = bassFreq * 1.002;

    var bassLfo = audioContext.createOscillator();
    bassLfo.type = 'sine';
    bassLfo.frequency.value = 0.04;
    var bassLfoGain = audioContext.createGain();
    bassLfoGain.gain.value = 2.8;
    bassLfo.connect(bassLfoGain);
    bassLfoGain.connect(osc1.frequency);
    bassLfoGain.connect(osc2.frequency);

    var bassGain = audioContext.createGain();
    bassGain.gain.value = 0.12;
    osc1.connect(bassGain);
    osc2.connect(bassGain);
    bassGain.connect(dryGain);
    bassGain.connect(reverbNode);

    droneNodes.push(osc1, osc2, bassLfo);

    // ——— Mid drone (pad) ———
    var midFreq = 110;
    var mid1 = audioContext.createOscillator();
    mid1.type = 'sine';
    mid1.frequency.value = midFreq;
    var mid2 = audioContext.createOscillator();
    mid2.type = 'triangle';
    mid2.frequency.value = midFreq * 1.497;

    var midLfo = audioContext.createOscillator();
    midLfo.type = 'sine';
    midLfo.frequency.value = 0.027;
    var midLfoGain = audioContext.createGain();
    midLfoGain.gain.value = 1.5;
    midLfo.connect(midLfoGain);
    midLfoGain.connect(mid1.detune);
    midLfoGain.connect(mid2.detune);

    var midGain = audioContext.createGain();
    midGain.gain.value = 0.055;
    mid1.connect(midGain);
    mid2.connect(midGain);
    midGain.connect(dryGain);
    midGain.connect(reverbNode);

    droneNodes.push(mid1, mid2, midLfo);

    // ——— High pad (filtered noise, very subtle) ———
    var noiseSrc = audioContext.createBufferSource();
    noiseSrc.buffer = createNoiseBuffer(audioContext, 4);
    noiseSrc.loop = true;

    var noiseLp = audioContext.createBiquadFilter();
    noiseLp.type = 'lowpass';
    noiseLp.frequency.value = 420;
    noiseLp.Q.value = 0.3;

    var noiseLfo = audioContext.createOscillator();
    noiseLfo.type = 'sine';
    noiseLfo.frequency.value = 0.06;
    var noiseLfoGain = audioContext.createGain();
    noiseLfoGain.gain.value = 80;
    noiseLfo.connect(noiseLfoGain);
    noiseLfoGain.connect(noiseLp.frequency);

    var noiseGain = audioContext.createGain();
    noiseGain.gain.value = 0.018;
    noiseSrc.connect(noiseLp);
    noiseLp.connect(noiseGain);
    noiseGain.connect(reverbNode);

    padNodes.push(noiseSrc, noiseLfo);

    // ——— Sparse high tone (cyberpunk "bleep") ———
    var bleepInterval = 0;
    function scheduleBleep() {
      if (!audioContext || !masterGain || !enabled || !shouldBeAudible) return;
      bleepInterval = window.setTimeout(function () {
        var osc = audioContext.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880 + Math.random() * 440, audioContext.currentTime);
        var g = audioContext.createGain();
        g.gain.setValueAtTime(0, audioContext.currentTime);
        g.gain.linearRampToValueAtTime(0.022, audioContext.currentTime + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.6);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.65);
        scheduleBleep();
      }, 4200 + Math.random() * 5000);
    }

    window.__CITY_BLEEP_SCHEDULER__ = function () {
      if (bleepInterval) window.clearTimeout(bleepInterval);
      bleepInterval = 0;
      if (enabled && shouldBeAudible && audioContext) scheduleBleep();
    };

    return true;
  }

  function startNodesIfNeeded() {
    if (!audioContext || started) return;
    var i;
    for (i = 0; i < droneNodes.length; i++) droneNodes[i].start();
    for (i = 0; i < padNodes.length; i++) padNodes[i].start();
    started = true;
    if (window.__CITY_BLEEP_SCHEDULER__) window.__CITY_BLEEP_SCHEDULER__();
  }

  function clearFadeOutTimeout() {
    if (!fadeOutTimeout) return;
    window.clearTimeout(fadeOutTimeout);
    fadeOutTimeout = 0;
  }

  function fadeOutAndSuspend(ms) {
    if (!audioContext) return;
    clearFadeOutTimeout();
    setMaster(0.0, ms);
    fadeOutTimeout = window.setTimeout(function () {
      fadeOutTimeout = 0;
      if (enabled && shouldBeAudible) return;
      if (window.__CITY_BLEEP_SCHEDULER__) window.__CITY_BLEEP_SCHEDULER__();
      try {
        if (audioContext && audioContext.state === 'running') audioContext.suspend();
      } catch (_) {}
    }, Math.max(0, ms) + 200);
  }

  function startTrack() {
    if (!enabled) return;
    if (!shouldBeAudible) return;
    if (!initAudioGraph()) return;
    startNodesIfNeeded();

    function afterResume() {
      masterGain.gain.setValueAtTime(0.08, now());
      setMaster(volume, FADE_IN_MS);
      if (window.__CITY_BLEEP_SCHEDULER__) window.__CITY_BLEEP_SCHEDULER__();
    }

    try {
      if (audioContext.state === 'suspended') {
        var p = audioContext.resume();
        if (p && typeof p.then === 'function') {
          p.then(afterResume).catch(afterResume);
          return;
        }
      }
    } catch (_) {}
    afterResume();
  }

  function applyAudibleState() {
    if (!audioContext) return;
    if (!enabled || !shouldBeAudible) {
      fadeOutAndSuspend(FADE_OUT_MS);
      return;
    }
    clearFadeOutTimeout();
    try {
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(function () {
          setMaster(volume, FADE_IN_MS);
          if (window.__CITY_BLEEP_SCHEDULER__) window.__CITY_BLEEP_SCHEDULER__();
        }).catch(function () {});
        return;
      }
    } catch (_) {}
    setMaster(volume, FADE_IN_MS);
    if (window.__CITY_BLEEP_SCHEDULER__) window.__CITY_BLEEP_SCHEDULER__();
  }

  function stopTrack() {
    clearFadeOutTimeout();
    setMaster(0.0, 400);
    if (window.__CITY_BLEEP_SCHEDULER__) window.__CITY_BLEEP_SCHEDULER__();
    if (!audioContext) return;
    window.setTimeout(function () {
      try {
        if (audioContext && audioContext.state === 'running') audioContext.suspend();
      } catch (_) {}
    }, 500);
  }

  function armAutostart() {
    if (armed) return;
    armed = true;

    function disarm() {
      window.removeEventListener('pointerdown', onAny, true);
      window.removeEventListener('keydown', onKey, true);
      armed = false;
    }

    function onAny() {
      disarm();
      startTrack();
    }

    function onKey(e) {
      if (!e) return;
      var k = e.key;
      if (k === 'Tab' || k === 'Shift' || k === 'Meta' || k === 'Alt' || k === 'Control') return;
      disarm();
      startTrack();
    }

    window.addEventListener('pointerdown', onAny, true);
    window.addEventListener('keydown', onKey, true);
  }

  function onVisibility() {
    if (!audioContext) return;
    if (document.hidden) {
      fadeOutAndSuspend(420);
      return;
    }
    try {
      if (audioContext.state === 'suspended') audioContext.resume();
    } catch (_) {}
    applyAudibleState();
  }

  function tryStartIfUserActivatedSoon() {
    if (!enabled) return;
    try {
      if (navigator.userActivation && navigator.userActivation.hasBeenActive) {
        startTrack();
      }
    } catch (_) {}
  }

  function setEnabled(on) {
    enabled = !!on;
    try {
      localStorage.setItem('city-music-enabled', enabled ? 'on' : 'off');
    } catch (_) {}
    if (enabled) {
      startTrack();
    } else {
      applyAudibleState();
    }
  }

  function getEnabled() {
    return enabled;
  }

  function getTrackName() {
    return TRACK_NAME;
  }

  function init() {
    document.addEventListener('visibilitychange', onVisibility, { passive: true });
    window.addEventListener('message', function (e) {
      try {
        if (!e || !e.data) return;
        if (e.data.type === 'city:gesture') {
          startTrack();
          return;
        }
        if (e.data.type === 'city:scene') {
          applyAudibleState();
        }
      } catch (_) {}
    }, { passive: true });
    armAutostart();
    tryStartIfUserActivatedSoon();
  }

  try {
    window.__CITY_AUDIO_API__ = {
      start: function () { startTrack(); },
      stop: function () { stopTrack(); },
      setEnabled: setEnabled,
      getEnabled: getEnabled,
      getTrackName: getTrackName
    };
  } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
