'use strict';

const motionPreference = matchMedia('(prefers-reduced-motion: no-preference)');

function setupReadingProgress() {
  const header = document.querySelector('.site-header');
  const progress = header.querySelector('.scroll-progress');
  const nativeProgress = CSS.supports('animation-timeline: scroll(root block)');
  const observesOrigin = typeof IntersectionObserver === 'function';
  if (observesOrigin) {
    const elevation = new IntersectionObserver(([entry]) => {
      header.classList.toggle('is-scrolled', !entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, {rootMargin: '8px 0px 0px'});
    elevation.observe(document.querySelector('.page-origin'));
  }
  if (nativeProgress && observesOrigin) return;

  // A scroll timeline handles modern browsers. Batch fallback reads and writes
  // once per frame, including changes in page height when a FAQ opens.
  let pendingFrame = 0;
  function update() {
    pendingFrame = 0;
    const offset = window.scrollY;
    if (!nativeProgress && motionPreference.matches) {
      const page = document.scrollingElement;
      const range = page.scrollHeight - page.clientHeight;
      const fraction = range > 0 ? Math.min(1, Math.max(0, offset / range)) : 0;
      progress.style.transform = 'scaleX(' + fraction + ')';
    }
    if (!observesOrigin) header.classList.toggle('is-scrolled', offset > 8);
  }
  function schedule() {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(update);
  }
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  motionPreference.addEventListener('change', schedule);
  if (!nativeProgress && typeof ResizeObserver === 'function') {
    new ResizeObserver(schedule).observe(document.body);
  }
  update();
}

// Roll pre-rendered numerals inside a fixed rectangle. The accessible text
// always contains the published value, including while the reel is moving.
function rollFigure(figure) {
  const value = figure.textContent.trim();
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 1) return;
  const label = document.createElement('span');
  label.className = 'count-label';
  label.textContent = value;
  const track = document.createElement('span');
  track.className = 'count-track';
  const windowFrame = document.createElement('span');
  windowFrame.className = 'count-window';
  windowFrame.setAttribute('aria-hidden', 'true');
  for (const fraction of [0, .25, .5, .75, 1]) {
    const step = document.createElement('span');
    step.textContent = String(Math.round(amount * fraction));
    track.append(step);
  }
  windowFrame.append(track);
  figure.replaceChildren(label, windowFrame);
  figure.classList.add('is-counting');
  function restore() {
    figure.classList.remove('is-counting');
    figure.textContent = value;
  }
  track.addEventListener('animationend', restore, {once:true});
  track.addEventListener('animationcancel', restore, {once:true});
}

function setupArrivals() {
  if (typeof IntersectionObserver !== 'function') return;
  const approaching = new WeakSet();
  const arrivals = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const item = entry.target;
      if (!entry.isIntersecting && entry.boundingClientRect.top > 0) {
        approaching.add(item);
        continue;
      }
      arrivals.unobserve(item);
      if (!entry.isIntersecting || !motionPreference.matches) continue;
      const figure = item.querySelector('[data-count]');
      if (figure) rollFigure(figure);
      // Keep direct links and restored viewports steady on arrival.
      if (approaching.has(item) && !item.matches(':focus-within')) item.classList.add('is-arriving');
    }
  }, {rootMargin:'0px 0px 8px 0px'});

  document.querySelectorAll('.highlight-card, .section-heading, .service-card, .steps, .local-path, .portfolio-grid > article, .inquiry-copy')
    .forEach(item => arrivals.observe(item));
  function finishArrival(event) {
    if (event.animationName === 'section-arrive') event.target.classList.remove('is-arriving');
  }
  document.addEventListener('animationend', finishArrival);
  document.addEventListener('animationcancel', finishArrival);
}

setupReadingProgress();
setupArrivals();

function setupCardSpotlights(grid) {
  const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) and (forced-colors: none)');
  let card = null;
  let frame = 0;
  let pointerX = 0;
  let pointerY = 0;

  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    card?.classList.remove('has-spotlight');
    card = null;
  }

  function paint() {
    frame = 0;
    const bounds = card.getBoundingClientRect();
    card.style.setProperty('--spot-x', (pointerX - bounds.left) + 'px');
    card.style.setProperty('--spot-y', (pointerY - bounds.top) + 'px');
    card.classList.add('has-spotlight');
  }

  function move(event) {
    const next = event.pointerType === 'touch' ? null : event.target.closest('.service-card');
    if (next !== card) {
      clear();
      card = next;
    }
    if (!card) return;
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (!frame) frame = requestAnimationFrame(paint);
  }

  function sync() {
    clear();
    if (enabled.matches) {
      grid.addEventListener('pointermove', move, { passive: true });
      grid.addEventListener('pointerleave', clear);
      grid.addEventListener('pointercancel', clear);
    } else {
      grid.removeEventListener('pointermove', move);
      grid.removeEventListener('pointerleave', clear);
      grid.removeEventListener('pointercancel', clear);
    }
  }
  sync();
  enabled.addEventListener('change', sync);
}
const serviceGrid = document.querySelector('.service-grid');
if (serviceGrid) setupCardSpotlights(serviceGrid);
