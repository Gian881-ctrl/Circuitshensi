'use strict';

const playButton = document.getElementById('play-video');
playButton.hidden = false;
playButton.addEventListener('click', () => {
  const player = document.createElement('iframe');
  player.className = 'tiktok-player';
  player.src = 'https://www.tiktok.com/player/v1/7626704309354351892?autoplay=1&loop=0';
  player.title = 'Bench video from Circuit Senshi on TikTok';
  player.allow = 'autoplay; fullscreen';
  player.referrerPolicy = 'strict-origin';
  player.width = '360';
  player.height = '640';
  document.getElementById('bench-video').replaceChildren(player);
  player.focus();
}, { once: true });
