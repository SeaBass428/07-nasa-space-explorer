// Find our date picker inputs on the page
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Call the setupDateInputs function from dateRange.js
// This sets up the date pickers to:
// - Default to a range of 9 days (from 9 days ago to today)
// - Restrict dates to NASA's image archive (starting from 1995)
setupDateInputs(startInput, endInput);
const button = document.querySelector('.filters button');
const gallery = document.getElementById('gallery');
const modal = document.getElementById('imageModal');
const modalBody = document.querySelector('.modal-body');
const modalCloseButton = document.querySelector('.modal-close');
const spaceFactText = document.getElementById('spaceFactText');

const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const imageLimit = 9;
const maxLookbackDays = 30;
const spaceFacts = [
  'Sunlight takes about 8 minutes and 20 seconds to reach Earth.',
  'A day on Venus is longer than its year: Venus takes about 243 Earth days to rotate once, but about 225 Earth days to orbit the Sun.',
  'Jupiter is the largest planet in our solar system.',
  'The Moon is slowly moving away from Earth by about 3.8 centimeters each year.',
  'Olympus Mons on Mars is the largest known volcano in the solar system.'
];

showRandomSpaceFact();

modalCloseButton.addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) {
    closeModal();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
    closeModal();
  }
});

function showRandomSpaceFact() {
  // Choose one of the stored facts each time the page loads.
  const randomIndex = Math.floor(Math.random() * spaceFacts.length);
  spaceFactText.textContent = spaceFacts[randomIndex];
}

function openModal(imageData) {
  modalBody.replaceChildren();
  modalBody.appendChild(createMediaPreview(imageData));

  const title = document.createElement('h2');
  title.textContent = imageData.title;
  modalBody.appendChild(title);

  const description = document.createElement('p');
  addExplanationContent(description, imageData.explanation || 'No description available.');
  modalBody.appendChild(description);

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function createMediaPreview(mediaData) {
  const preview = document.createElement('img');
  preview.className = 'media-preview';
  preview.alt = mediaData.alt || mediaData.title;

  if (mediaData.media_type === 'image') {
    preview.src = mediaData.hdurl || mediaData.url;
    return preview;
  }

  if (mediaData.media_type === 'video') {
    const videoUrl = new URL(mediaData.url);
    const embedUrl = getVideoEmbedUrl(videoUrl);

    if (embedUrl) {
      const iframe = document.createElement('iframe');
      iframe.className = 'media-preview';
      iframe.src = embedUrl;
      iframe.title = `Video: ${mediaData.title}`;
      iframe.allow = 'fullscreen; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.loading = 'lazy';
      return iframe;
    }

    if (/\.(mp4|webm|ogg)$/i.test(videoUrl.pathname)) {
      const video = document.createElement('video');
      video.className = 'media-preview';
      video.src = videoUrl.href;
      video.controls = true;
      video.preload = 'metadata';
      video.playsInline = true;
      return video;
    }

    if (mediaData.thumbnail_url) {
      preview.src = mediaData.thumbnail_url;
      const link = document.createElement('a');
      link.href = videoUrl.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Watch video: ${mediaData.title}`);
      link.appendChild(preview);
      return link;
    }

    const link = document.createElement('a');
    link.href = videoUrl.href;
    link.textContent = 'Watch this APOD video';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  const link = document.createElement('a');
  link.href = mediaData.url;
  link.textContent = 'View APOD media';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function getVideoEmbedUrl(videoUrl) {
  if (videoUrl.protocol !== 'https:') {
    return null;
  }

  const host = videoUrl.hostname.toLowerCase();
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be'].includes(host)) {
    const videoId = host === 'youtu.be'
      ? videoUrl.pathname.slice(1)
      : videoUrl.searchParams.get('v') || videoUrl.pathname.split('/').filter(Boolean).pop();

    return videoId && /^[\w-]+$/.test(videoId)
      ? `https://www.youtube-nocookie.com/embed/${videoId}`
      : null;
  }

  if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
    const videoId = videoUrl.pathname.split('/').filter(Boolean).pop();
    return videoId && /^\d+$/.test(videoId)
      ? `https://player.vimeo.com/video/${videoId}`
      : null;
  }

  return null;
}

function closeModal() {
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

button.addEventListener('click', async () => {
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate || !endDate || startDate > endDate) {
    gallery.textContent = 'Choose a valid date range.';
    return;
  }

  gallery.textContent = 'Loading images...';

  try {
    let searchStartDate = startDate;
    let daysLookedBack = 0;
    let images = await fetchImages(searchStartDate, endDate);

    // Extend the search when the selected range has fewer than nine images.
    while (
      images.length < imageLimit
      && daysLookedBack < maxLookbackDays
      && searchStartDate > earliestDate
    ) {
      const previousDate = new Date(`${searchStartDate}T00:00:00Z`);
      previousDate.setUTCDate(previousDate.getUTCDate() - 1);
      searchStartDate = previousDate.toISOString().split('T')[0];
      daysLookedBack += 1;
      images = await fetchImages(searchStartDate, endDate);
    }

    if (images.length === 0) {
      gallery.textContent = 'No APOD images were found for that date range.';
      return;
    }

    displayImages(images.slice(0, imageLimit));
  } catch (error) {
    gallery.textContent = error instanceof Error
      ? error.message
      : 'Unable to load APOD images. Please try again.';
  }
});

async function fetchImages(startDate, endDate) {
  const parameters = new URLSearchParams({
    date_from: startDate.slice(2).replaceAll('-', ''),
    date_to: endDate.slice(2).replaceAll('-', ''),
    per_page: '100'
  });
  const images = [];
  let page = 1;

  while (true) {
    parameters.set('page', String(page));
    const response = await fetch(`${apiUrl}?${parameters}`);
    const pageImages = await response.json();

    if (!response.ok) {
      const message = pageImages.message || `NASA could not return images (${response.status}).`;
      throw new Error(message);
    }

    if (!Array.isArray(pageImages)) {
      throw new Error('NASA returned an unexpected response. Please try again.');
    }

    images.push(...pageImages);

    const totalPages = Number(response.headers.get('X-WP-TotalPages'));
    if (pageImages.length < 100 || (totalPages > 0 && page >= totalPages)) {
      break;
    }

    page += 1;
  }

  return images;
}

function displayImages(images) {
  gallery.replaceChildren();

  images.forEach((imageData) => {
    const item = document.createElement('article');
    item.className = 'gallery-item';
    item.appendChild(createMediaPreview(imageData));

    const title = document.createElement('p');
    title.className = 'gallery-item-title';
    title.textContent = imageData.title;
    item.appendChild(title);

    const detailsButton = document.createElement('button');
    detailsButton.className = 'details-button';
    detailsButton.type = 'button';
    detailsButton.textContent = 'Details';
    detailsButton.addEventListener('click', () => openModal(imageData));
    item.appendChild(detailsButton);

    gallery.appendChild(item);
  });
}

function addExplanationContent(description, explanation) {
  const parsedExplanation = new DOMParser().parseFromString(explanation, 'text/html');
  // Rebuild the explanation with only safe formatting and HTTPS links.
  const safeTags = new Set(['a', 'br', 'em', 'strong']);
  const blockedTags = new Set(['iframe', 'object', 'script', 'style']);

  function copySafeContent(source, destination) {
    source.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        destination.appendChild(document.createTextNode(node.textContent));
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const tagName = node.tagName.toLowerCase();
      if (blockedTags.has(tagName)) {
        return;
      }

      if (!safeTags.has(tagName)) {
        copySafeContent(node, destination);
        return;
      }

      const safeElement = document.createElement(tagName);
      if (tagName === 'a') {
        const href = node.getAttribute('href');
        if (href && /^https:\/\//i.test(href)) {
          const linkUrl = document.createElement('a');
          linkUrl.href = href;
          if (linkUrl.protocol === 'https:' && linkUrl.hostname) {
            safeElement.href = linkUrl.href;
            safeElement.target = '_blank';
            safeElement.rel = 'noopener noreferrer';
          }
        }
      }

      copySafeContent(node, safeElement);
      if (tagName !== 'a' || safeElement.href) {
        destination.appendChild(safeElement);
      } else {
        copySafeContent(node, destination);
      }
    });
  }

  copySafeContent(parsedExplanation.body, description);
}
