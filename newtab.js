// Get today's date as a string (YYYY-MM-DD)
function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Get art index for today (deterministic based on date)
function getDailyArtIndex() {
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const diff = today - startOfYear;
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return dayOfYear % artList.length;
}

// Validate image URL
function validateImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = url;
  });
}

// Apply artwork to wallpaper
function applyArtwork(art) {
  const wallpaperEl = document.getElementById('wallpaper');
  const blurEl = document.getElementById('wallpaper-blur');
  wallpaperEl.style.backgroundImage = `url('${art.url}')`;
  blurEl.style.backgroundImage = `url('${art.url}')`;

  document.getElementById('art-title').textContent = art.title;
  document.getElementById('art-artist').textContent = art.artist;
}

// Get today's saved art index from localStorage
function getTodaySavedArtIndex() {
  const stored = localStorage.getItem('todayArt');
  if (!stored) return null;

  const data = JSON.parse(stored);
  if (data.date !== getTodayString()) return null;

  return data.artIndex;
}

// Save art index for today
function saveTodayArtIndex(artIndex) {
  const data = {
    date: getTodayString(),
    artIndex: artIndex
  };
  localStorage.setItem('todayArt', JSON.stringify(data));
}

// Set wallpaper with validation
async function setWallpaper() {
  // Check for pinned art first, then saved selection, then daily
  const pinnedArt = getPinnedArt();
  if (pinnedArt !== null) {
    currentArtIndex = pinnedArt.artIndex;
  } else {
    const savedIndex = getTodaySavedArtIndex();
    currentArtIndex = savedIndex !== null ? savedIndex : getDailyArtIndex();
  }

  let art = getCurrentArt();
  let attempts = 0;

  while (attempts < artList.length) {
    try {
      await validateImage(art.url);
      applyArtwork(art);
      return;
    } catch (error) {
      console.warn(`Failed to load: ${art.title}`, error);
      currentArtIndex = (currentArtIndex + 1) % artList.length;
      art = getCurrentArt();
      attempts++;
    }
  }

  // All images failed
  document.getElementById('art-title').textContent = 'No artwork available';
  document.getElementById('art-artist').textContent = '';
}

// Time tracking using localStorage
function initTimeTracking() {
  const today = getTodayString();
  const stored = localStorage.getItem('timeTracking');
  let data = stored ? JSON.parse(stored) : {};

  // Reset if it's a new day
  if (data.date !== today) {
    data = {
      date: today,
      timeSpent: 0, // in seconds
      lastActive: Date.now()
    };
  }

  localStorage.setItem('timeTracking', JSON.stringify(data));
  return data;
}

// Update time spent
function updateTimeSpent() {
  const stored = localStorage.getItem('timeTracking');
  let data = stored ? JSON.parse(stored) : initTimeTracking();
  const today = getTodayString();

  // Reset if it's a new day
  if (data.date !== today) {
    data = initTimeTracking();
  }

  const now = Date.now();
  const elapsed = Math.floor((now - data.lastActive) / 1000);

  // Only count if less than 5 seconds since last update (tab is active)
  if (elapsed < 5) {
    data.timeSpent += elapsed;
  }

  data.lastActive = now;
  localStorage.setItem('timeTracking', JSON.stringify(data));
}

// Track current art index
let currentArtIndex = null;

// Track background size mode
let bgSizeMode = localStorage.getItem('bgSizeMode') || 'contain';

// Pin functionality
function getPinnedArt() {
  const stored = localStorage.getItem('pinnedArt');
  if (!stored) return null;
  return JSON.parse(stored);
}

function savePinnedArt(artIndex) {
  localStorage.setItem('pinnedArt', JSON.stringify({ artIndex }));
}

function clearPinnedArt() {
  localStorage.removeItem('pinnedArt');
}

function isPinned() {
  return getPinnedArt() !== null;
}

function togglePin() {
  const pinBtn = document.getElementById('pin-btn');

  if (isPinned()) {
    clearPinnedArt();
    pinBtn.classList.remove('pinned');
    pinBtn.title = 'Pin this artwork';
  } else {
    savePinnedArt(currentArtIndex);
    pinBtn.classList.add('pinned');
    pinBtn.title = 'Unpin artwork';
  }
}

function updatePinButton() {
  const pinBtn = document.getElementById('pin-btn');
  if (isPinned()) {
    pinBtn.classList.add('pinned');
    pinBtn.title = 'Unpin artwork';
  } else {
    pinBtn.classList.remove('pinned');
    pinBtn.title = 'Pin this artwork';
  }
}

// Shuffle list management
function getShuffleList() {
  const stored = localStorage.getItem('shuffleList');
  if (!stored) return null;

  const data = JSON.parse(stored);
  if (data.date !== getTodayString()) return null;

  return data.remaining;
}

function saveShuffleList(remaining) {
  const data = {
    date: getTodayString(),
    remaining: remaining
  };
  localStorage.setItem('shuffleList', JSON.stringify(data));
}

function initShuffleList() {
  let remaining = getShuffleList();
  if (!remaining || remaining.length === 0) {
    // Create new list with all indices except current
    remaining = artList.map((_, i) => i).filter(i => i !== currentArtIndex);
    saveShuffleList(remaining);
  }
  return remaining;
}

function getNextShuffleIndex() {
  let remaining = initShuffleList();

  if (remaining.length === 0) {
    // All images seen, reset list
    remaining = artList.map((_, i) => i).filter(i => i !== currentArtIndex);
  }

  // Pick random from remaining
  const randomIdx = Math.floor(Math.random() * remaining.length);
  const nextArtIndex = remaining[randomIdx];

  // Remove from list
  remaining.splice(randomIdx, 1);
  saveShuffleList(remaining);

  return nextArtIndex;
}

// Toggle background size (cover/contain)
function toggleBackgroundSize() {
  bgSizeMode = bgSizeMode === 'cover' ? 'contain' : 'cover';
  localStorage.setItem('bgSizeMode', bgSizeMode);
  applyBackgroundSize();
}

// Apply saved background size
function applyBackgroundSize() {
  const wallpaperEl = document.getElementById('wallpaper');
  const blurEl = document.getElementById('wallpaper-blur');

  wallpaperEl.style.backgroundSize = bgSizeMode;

  if (bgSizeMode === 'contain') {
    blurEl.classList.add('active');
    wallpaperEl.classList.add('contain-mode');
  } else {
    blurEl.classList.remove('active');
    wallpaperEl.classList.remove('contain-mode');
  }
}

// Get current art
function getCurrentArt() {
  return artList[currentArtIndex];
}

// Shuffle to random artwork
async function shuffleArtwork() {
  let attempts = 0;

  while (attempts < artList.length) {
    const newIndex = getNextShuffleIndex();
    currentArtIndex = newIndex;
    const art = getCurrentArt();

    try {
      await validateImage(art.url);
      applyArtwork(art);
      saveTodayArtIndex(currentArtIndex);
      return;
    } catch (error) {
      console.warn(`Failed to load: ${art.title}`, error);
      attempts++;
    }
  }
}

// Download current artwork
function downloadArtwork() {
  const art = getCurrentArt();

  const link = document.createElement('a');
  link.href = art.url;
  link.download = `${art.title} - ${art.artist}.jpg`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Initialize
function init() {
  setWallpaper();
  applyBackgroundSize();
  initTimeTracking();

  // Update time tracking every second
  setInterval(updateTimeSpent, 1000);

  // Update pin button state
  updatePinButton();

  // Action buttons
  document.getElementById('heart-btn').addEventListener('click', () => {
    window.open('https://parallax.kr', '_blank');
  });
  document.getElementById('pin-btn').addEventListener('click', togglePin);
  document.getElementById('fit-btn').addEventListener('click', toggleBackgroundSize);
  document.getElementById('shuffle-btn').addEventListener('click', shuffleArtwork);
  document.getElementById('download-btn').addEventListener('click', downloadArtwork);
}

// Run when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
