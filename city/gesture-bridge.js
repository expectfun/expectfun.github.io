(function () {
  'use strict';

  var isInFrame = false;
  try {
    isInFrame = window.top && window.top !== window;
  } catch (_) {
    isInFrame = true;
  }
  if (!isInFrame) return;

  function filename() {
    try {
      var path = window.location.pathname || '';
      var parts = path.split('/');
      return (parts[parts.length - 1] || '').toLowerCase();
    } catch (_) {
      return '';
    }
  }

  function sceneInfo() {
    var file = filename();
    var map = {
      'hub.html': { scene: 'hub', env: 'outdoor' },
      'street.html': { scene: 'street', env: 'outdoor' },
      'entry.html': { scene: 'entry', env: 'outdoor' },
      'station.html': { scene: 'station', env: 'outdoor' },

      'game.html': { scene: 'game', env: 'indoor' },
      'arcade.html': { scene: 'arcade', env: 'indoor' },
      'library.html': { scene: 'library', env: 'indoor' },
      'terminal.html': { scene: 'terminal', env: 'indoor' },
      'tablet.html': { scene: 'tablet', env: 'indoor' },
      'daemon.html': { scene: 'daemon', env: 'indoor' },
      'rooftop.html': { scene: 'rooftop', env: 'outdoor' },
      'workshop.html': { scene: 'workshop', env: 'indoor' },
      'hotel.html': { scene: 'hotel', env: 'outdoor' },
      'lobby.html': { scene: 'lobby', env: 'indoor' }
    };
    return map[file] || { scene: file || 'unknown', env: 'outdoor' };
  }

  function sendScene() {
    try {
      var info = sceneInfo();
      var file = filename();
      window.parent.postMessage({ type: 'city:scene', scene: info.scene, env: info.env, file: file || 'index.html' }, '*');
    } catch (_) {}
  }

  var sent = false;
  function send() {
    if (sent) return;
    sent = true;
    try {
      window.parent.postMessage({ type: 'city:gesture' }, '*');
    } catch (_) {}
    window.removeEventListener('pointerdown', onAny, true);
    window.removeEventListener('keydown', onKey, true);
  }

  function onAny() { send(); }
  function onKey(e) {
    if (!e) return;
    var k = e.key;
    if (k === 'Tab' || k === 'Shift' || k === 'Meta' || k === 'Alt' || k === 'Control') return;
    send();
  }

  window.addEventListener('pointerdown', onAny, true);
  window.addEventListener('keydown', onKey, true);
  sendScene();

  var spotRaf = 0;
  var spotLastX = 0;
  var spotLastY = 0;
  function sendSpotPosition(x, y) {
    try {
      window.parent.postMessage({ type: 'city-spot-move', x: x, y: y }, '*');
    } catch (_) {}
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    spotLastX = e.clientX;
    spotLastY = e.clientY;
    if (spotRaf) return;
    spotRaf = window.requestAnimationFrame(function () {
      spotRaf = 0;
      sendSpotPosition(spotLastX, spotLastY);
    });
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true });
})();
