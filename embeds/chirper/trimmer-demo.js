function formatChirperTime(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const mins = Math.floor(total / 60);
  const secs = String(total % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

function initChirperTrimmer(root) {
  if (!root || root.dataset.bound === 'true') return () => {};
  root.dataset.bound = 'true';

  const duration = 24;
  const wave = root.querySelector('[data-chirper-wave]');
  const selection = root.querySelector('[data-chirper-selection]');
  const rangeLabel = root.querySelector('[data-chirper-range]');
  const playButton = root.querySelector('[data-chirper-play]');
  const playIcon = root.querySelector('[data-chirper-play-icon]');
  const exportButton = root.querySelector('[data-chirper-export]');
  const startHandle = root.querySelector('[data-chirper-handle="start"]');
  const endHandle = root.querySelector('[data-chirper-handle="end"]');

  let start = 0.18;
  let end = 0.76;
  let activeHandle = null;
  let playing = false;
  let playTimer = 0;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const render = () => {
    selection.style.left = `${start * 100}%`;
    selection.style.width = `${(end - start) * 100}%`;
    startHandle.style.left = `${start * 100}%`;
    endHandle.style.left = `${end * 100}%`;
    rangeLabel.textContent = `${formatChirperTime(start * duration)} – ${formatChirperTime(end * duration)}`;
  };

  const ratioFromEvent = (event) => {
    const rect = wave.getBoundingClientRect();
    return clamp((event.clientX - rect.left) / rect.width, 0, 1);
  };

  const onPointerMove = (event) => {
    if (!activeHandle) return;
    const ratio = ratioFromEvent(event);
    if (activeHandle === 'start') {
      start = clamp(ratio, 0, end - 0.05);
    } else {
      end = clamp(ratio, start + 0.05, 1);
    }
    render();
  };

  const stopDrag = () => {
    if (!activeHandle) return;
    startHandle.classList.remove('is-dragging');
    endHandle.classList.remove('is-dragging');
    activeHandle = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
  };

  const startDrag = (handle, event) => {
    event.preventDefault();
    activeHandle = handle;
    startHandle.classList.toggle('is-dragging', handle === 'start');
    endHandle.classList.toggle('is-dragging', handle === 'end');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const onPlay = () => {
    playing = !playing;
    playButton.classList.toggle('is-playing', playing);
    playIcon.textContent = playing ? '❚❚' : '▶';
    window.clearTimeout(playTimer);
    if (playing) {
      const ms = Math.max(600, (end - start) * duration * 1000 * 0.35);
      playTimer = window.setTimeout(() => {
        playing = false;
        playButton.classList.remove('is-playing');
        playIcon.textContent = '▶';
      }, ms);
    }
  };

  const onExport = () => {
    exportButton.classList.add('is-done');
    exportButton.textContent = 'Clip ready';
    window.setTimeout(() => {
      exportButton.classList.remove('is-done');
      exportButton.textContent = 'Export clip';
    }, 1400);
  };

  startHandle.addEventListener('pointerdown', (event) => startDrag('start', event));
  endHandle.addEventListener('pointerdown', (event) => startDrag('end', event));
  playButton.addEventListener('click', onPlay);
  exportButton.addEventListener('click', onExport);
  render();

  return () => {
    stopDrag();
    window.clearTimeout(playTimer);
    startHandle.replaceWith(startHandle.cloneNode(true));
    endHandle.replaceWith(endHandle.cloneNode(true));
    playButton.replaceWith(playButton.cloneNode(true));
    exportButton.replaceWith(exportButton.cloneNode(true));
  };
}

function initProjectEmbeds() {
  return [...document.querySelectorAll('[data-chirper-trimmer]')].map((root) =>
    initChirperTrimmer(root),
  );
}

window.__projectEmbedCleanups = window.__projectEmbedCleanups || [];

function bootProjectEmbeds() {
  window.__projectEmbedCleanups.forEach((stop) => stop?.());
  window.__projectEmbedCleanups = initProjectEmbeds();
}

window.bootProjectEmbeds = bootProjectEmbeds;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootProjectEmbeds, { once: true });
} else {
  bootProjectEmbeds();
}
