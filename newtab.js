// Get today's date as a string (YYYY-MM-DD)
function getTodayString() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

// Strip HTML tags and clean text
function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

// Extract clean title from metadata
function extractTitle(metadata, pageTitle) {
  // Try ObjectName first
  if (metadata.ObjectName?.value) {
    const cleaned = stripHtml(metadata.ObjectName.value);
    if (cleaned && cleaned.length > 0) return cleaned;
  }

  // Try to extract from page title (remove "File:" prefix and extension)
  if (pageTitle) {
    const title = pageTitle
      .replace(/^File:/, '')
      .replace(/\.(jpg|jpeg|png|gif|svg|tif|tiff)$/i, '')
      .replace(/_/g, ' ')
      .replace(/ - .+$/, '') // Remove artist suffix
      .trim();
    if (title) return title.substring(0, 100);
  }

  return 'Unknown Title';
}

// Extract clean artist from metadata
function extractArtist(metadata) {
  if (metadata.Artist?.value) {
    const cleaned = stripHtml(metadata.Artist.value);
    if (cleaned && cleaned.length > 0) {
      // Remove common prefixes and clean up
      return cleaned
        .replace(/^by\s+/i, '')
        .replace(/\s*\([^)]*\)\s*/g, ' ')
        .trim()
        .substring(0, 100);
    }
  }
  return 'Unknown Artist';
}

// Wikimedia API - fetch artwork from featured paintings
async function fetchArtworkFromWikimedia() {
  const categories = [
    'Featured_pictures_of_paintings',
    'Featured_pictures_of_portraits',
    'Quality_images_of_paintings',
    'Impressionist_paintings',
    'Renaissance_paintings',
    'Baroque_paintings'
  ];

  const randomCategory = categories[Math.floor(Math.random() * categories.length)];
  const randomOffset = Math.floor(Math.random() * 100);

  const url = `https://commons.wikimedia.org/w/api.php?` +
    `action=query&generator=categorymembers&gcmtype=file&gcmtitle=Category:${randomCategory}` +
    `&gcmlimit=10&gcmoffset=${randomOffset}` +
    `&prop=imageinfo&iiprop=url|extmetadata` +
    `&iiurlwidth=1920&format=json&origin=*`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.query || !data.query.pages) {
      return null;
    }

    const pages = Object.values(data.query.pages);
    const validPages = pages.filter(page =>
      page.imageinfo &&
      page.imageinfo[0] &&
      page.imageinfo[0].thumburl
    );

    if (validPages.length === 0) return null;

    const randomPage = validPages[Math.floor(Math.random() * validPages.length)];
    const imageInfo = randomPage.imageinfo[0];
    const metadata = imageInfo.extmetadata || {};

    return {
      url: imageInfo.thumburl || imageInfo.url,
      title: extractTitle(metadata, randomPage.title),
      artist: extractArtist(metadata)
    };
  } catch (error) {
    console.error('Failed to fetch from Wikimedia:', error);
    return null;
  }
}

// Image cache management
const CACHE_SIZE = 10;

function getImageCache() {
  const stored = localStorage.getItem('imageCache');
  if (!stored) return [];
  return JSON.parse(stored);
}

function saveImageCache(cache) {
  localStorage.setItem('imageCache', JSON.stringify(cache));
}

// Preload image for faster display
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = url;
  });
}

// Fill cache to maintain CACHE_SIZE images
async function fillCache() {
  let cache = getImageCache();

  while (cache.length < CACHE_SIZE) {
    const artwork = await fetchArtworkFromWikimedia();
    if (artwork) {
      // Check for duplicates
      const isDuplicate = cache.some(item => item.url === artwork.url);
      if (!isDuplicate) {
        try {
          await preloadImage(artwork.url);
          cache.push(artwork);
          saveImageCache(cache);
        } catch (e) {
          console.warn('Failed to preload:', artwork.title);
        }
      }
    }
  }

  return cache;
}

// Initialize cache in background
async function initCache() {
  let cache = getImageCache();

  // If cache is empty, fetch initial images
  if (cache.length === 0) {
    await fillCache();
  } else {
    // Fill cache in background if not full
    fillCache();
  }

  return getImageCache();
}

// Get current artwork from cache
function getCurrentArtwork() {
  const stored = localStorage.getItem('currentArtwork');
  if (!stored) return null;
  return JSON.parse(stored);
}

function saveCurrentArtwork(artwork) {
  localStorage.setItem('currentArtwork', JSON.stringify(artwork));
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

// Track background size mode
let bgSizeMode = localStorage.getItem('bgSizeMode') || 'contain';

// Pin functionality
function getPinnedArt() {
  const stored = localStorage.getItem('pinnedArt');
  if (!stored) return null;
  return JSON.parse(stored);
}

function savePinnedArt(artwork) {
  localStorage.setItem('pinnedArt', JSON.stringify(artwork));
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
    const current = getCurrentArtwork();
    if (current) {
      savePinnedArt(current);
      pinBtn.classList.add('pinned');
      pinBtn.title = 'Unpin artwork';
    }
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

// Set wallpaper
async function setWallpaper() {
  // Check for pinned art first
  const pinnedArt = getPinnedArt();
  if (pinnedArt) {
    applyArtwork(pinnedArt);
    return;
  }

  // Check for current artwork
  let current = getCurrentArtwork();

  if (current) {
    applyArtwork(current);
  } else {
    // Get from cache or fetch new
    let cache = getImageCache();

    if (cache.length > 0) {
      current = cache[0];
      applyArtwork(current);
      saveCurrentArtwork(current);
    } else {
      // Show loading state
      document.getElementById('art-title').textContent = 'Loading artwork...';
      document.getElementById('art-artist').textContent = '';

      // Fetch and display
      await fillCache();
      cache = getImageCache();

      if (cache.length > 0) {
        current = cache[0];
        applyArtwork(current);
        saveCurrentArtwork(current);
      } else {
        document.getElementById('art-title').textContent = 'No artwork available';
        document.getElementById('art-artist').textContent = '';
      }
    }
  }
}

// Shuffle to next artwork
async function shuffleArtwork() {
  // Clear pin if shuffling
  if (isPinned()) {
    clearPinnedArt();
    updatePinButton();
  }

  let cache = getImageCache();
  const current = getCurrentArtwork();

  // Remove current from cache
  if (current) {
    cache = cache.filter(item => item.url !== current.url);
    saveImageCache(cache);
  }

  // Get next from cache
  if (cache.length > 0) {
    const next = cache[0];
    applyArtwork(next);
    saveCurrentArtwork(next);
  } else {
    document.getElementById('art-title').textContent = 'Loading...';
    document.getElementById('art-artist').textContent = '';
  }

  // Fill cache in background
  fillCache();
}

// Download current artwork
function downloadArtwork() {
  const art = getCurrentArtwork();
  if (!art) return;

  const link = document.createElement('a');
  link.href = art.url;
  link.download = `${art.title} - ${art.artist}.jpg`;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Time tracking using localStorage
function initTimeTracking() {
  const today = getTodayString();
  const stored = localStorage.getItem('timeTracking');
  let data = stored ? JSON.parse(stored) : {};

  if (data.date !== today) {
    data = {
      date: today,
      timeSpent: 0,
      lastActive: Date.now()
    };
  }

  localStorage.setItem('timeTracking', JSON.stringify(data));
  return data;
}

function updateTimeSpent() {
  const stored = localStorage.getItem('timeTracking');
  let data = stored ? JSON.parse(stored) : initTimeTracking();
  const today = getTodayString();

  if (data.date !== today) {
    data = initTimeTracking();
  }

  const now = Date.now();
  const elapsed = Math.floor((now - data.lastActive) / 1000);

  if (elapsed < 5) {
    data.timeSpent += elapsed;
  }

  data.lastActive = now;
  localStorage.setItem('timeTracking', JSON.stringify(data));
}

// Initialize
async function init() {
  // Set wallpaper immediately from cache
  await setWallpaper();
  applyBackgroundSize();
  initTimeTracking();

  // Update time tracking every second
  setInterval(updateTimeSpent, 1000);

  // Update pin button state
  updatePinButton();

  // Initialize cache in background
  initCache();

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
