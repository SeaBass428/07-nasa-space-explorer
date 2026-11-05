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

const apiUrl = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic';
const imageLimit = 9;
const maxLookbackDays = 30;

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
    const item = document.createElement('div');
    item.className = 'gallery-item';

    if (imageData.media_type === 'image') {
      const image = document.createElement('img');
      image.src = imageData.hdurl;
      image.alt = imageData.alt || imageData.title;
      item.appendChild(image);
    } else {
      const link = document.createElement('a');
      link.href = imageData.url;
      link.textContent = 'View APOD media';
      item.appendChild(link);
    }

    const title = document.createElement('p');
    title.textContent = imageData.title;
    item.appendChild(title);

    const description = document.createElement('p');
    addExplanationContent(description, imageData.explanation);
    item.appendChild(description);

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
