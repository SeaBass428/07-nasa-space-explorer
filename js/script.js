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

const apiKey = 'tjjKCCwmdtjRDCFngjhtWcj9zRbzghBGKBqgJj7L';
const apiUrl = 'https://api.nasa.gov/planetary/apod';

button.addEventListener('click', async () => {
  const startDate = startInput.value;
  const endDate = endInput.value;

  if (!startDate || !endDate || startDate > endDate) {
    gallery.textContent = 'Choose a valid date range.';
    return;
  }

  const parameters = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    api_key: apiKey
  });

  gallery.textContent = 'Loading images...';

  try {
    const response = await fetch(`${apiUrl}?${parameters}`);
    const images = await response.json();

    if (!response.ok) {
      const message = images.error?.message || `NASA could not return images (${response.status}).`;
      throw new Error(message);
    }

    if (!Array.isArray(images)) {
      throw new Error('NASA returned an unexpected response. Please try again.');
    }

    if (images.length === 0) {
      gallery.textContent = 'No APOD images were found for that date range.';
      return;
    }

    displayImages(images);
  } catch (error) {
    gallery.textContent = error instanceof Error
      ? error.message
      : 'Unable to load APOD images. Please try again.';
  }
});

function displayImages(images) {
  gallery.replaceChildren();

  images.forEach((imageData) => {
    const item = document.createElement('div');
    item.className = 'gallery-item';

    if (imageData.media_type === 'image') {
      const image = document.createElement('img');
      image.src = imageData.url;
      image.alt = imageData.title;
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
    description.textContent = imageData.explanation;
    item.appendChild(description);

    gallery.appendChild(item);
  });
}
