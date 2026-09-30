(() => {
  const page = document.querySelector('.videos-page');
  if (!page) return;

  let activeButton = null;

  function setExpanded(button, expanded) {
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', `${expanded ? 'Close video' : 'View'}: ${button.dataset.videoTitle}`);
    button.querySelector('.video-view-label').textContent = expanded ? 'Close video' : 'View';
    button.querySelector('.video-view-icon').textContent = expanded ? '×' : '▶\uFE0E';
  }

  function closePlayer() {
    if (!activeButton) return;
    const container = document.getElementById(activeButton.getAttribute('aria-controls'));
    // Remove the iframe so playback and background work stop immediately.
    container.replaceChildren();
    container.hidden = true;
    setExpanded(activeButton, false);
    activeButton = null;
  }

  page.querySelectorAll('.video-view').forEach(button => {
    button.addEventListener('click', () => {
      const wasOpen = activeButton === button;
      closePlayer();
      if (wasOpen) return;

      const container = document.getElementById(button.getAttribute('aria-controls'));
      const player = document.createElement('iframe');
      player.title = button.dataset.videoTitle;
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      player.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      player.allowFullscreen = true;
      player.src = button.dataset.videoSrc;
      container.hidden = false;
      container.append(player);
      setExpanded(button, true);
      activeButton = button;
    });
    // Direct video links remain usable when JavaScript is unavailable.
    button.hidden = false;
  });
})();
