'use strict';

const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

function normalizeArabicText(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ـ/g, '')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ');
}

function getSearchWords(searchValue) {
  return normalizeArabicText(searchValue)
    .split(' ')
    .filter(Boolean);
}

function itemMatchesSearch(itemName, searchValue) {
  const searchWords = getSearchWords(searchValue);

  if (searchWords.length === 0) {
    return true;
  }

  const normalizedItemName = normalizeArabicText(itemName);

  return searchWords.every((word) => normalizedItemName.includes(word));
}

function filterItemsBySearch(items, searchValue) {
  return items.filter((item) => itemMatchesSearch(item.name, searchValue));
}

function formatPrice(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return '—';
  }

  return `${numberValue.toFixed(2)} $`;
}

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('ar-LB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function getPublicImageUrl(imagePath) {
  if (!imagePath) {
    return null;
  }

  const { data } = supabaseClient.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(imagePath);

  return data?.publicUrl || null;
}

function createImagePlaceholder(label = 'بدون صورة') {
  const placeholder = document.createElement('div');

  placeholder.className = 'item-image-placeholder';
  placeholder.setAttribute('role', 'img');
  placeholder.setAttribute('aria-label', label);

  const icon = document.createElement('span');
  icon.className = 'item-image-placeholder-icon';
  icon.textContent = '◫';

  const text = document.createElement('span');
  text.className = 'item-image-placeholder-text';
  text.textContent = label;

  placeholder.append(icon, text);

  return placeholder;
}

function createItemImageElement(item) {
  const imageUrl = getPublicImageUrl(item.image_path);

  if (!imageUrl) {
    return createImagePlaceholder();
  }

  const image = document.createElement('img');

  image.className = 'item-image';
  image.src = imageUrl;
  image.alt = item.name ? `صورة ${item.name}` : 'صورة الصنف';
  image.width = 64;
  image.height = 64;
  image.loading = 'lazy';
  image.decoding = 'async';

  image.addEventListener(
    'error',
    () => {
      image.replaceWith(createImagePlaceholder('الصورة غير متاحة'));
    },
    { once: true }
  );

  return image;
}

function validateImageFile(file) {
  if (!file) {
    return {
      valid: true,
      message: ''
    };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return {
      valid: false,
      message: 'صيغة الصورة غير مدعومة. اختر JPG أو PNG أو WEBP.'
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      message: 'الصورة كبيرة جداً. يرجى اختيار صورة أصغر من 2MB.'
    };
  }

  return {
    valid: true,
    message: ''
  };
}

function createStorageImagePath(file) {
  const extensionFromName = String(file.name)
    .split('.')
    .pop()
    .toLowerCase();

  const extensionByType = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const extension = extensionByType[file.type] || extensionFromName || 'jpg';

  return `items/${crypto.randomUUID()}.${extension}`;
}

function setMessage(element, message = '', type = '') {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.className = 'form-message';

  if (type) {
    element.classList.add(`form-message-${type}`);
  }
}

function setButtonLoading(button, isLoading, loadingText = 'جارٍ الحفظ...') {
  if (!button) {
    return;
  }

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
    return;
  }

  button.disabled = false;
  button.textContent = button.dataset.originalText || button.textContent;
}

function createCell(text = '') {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}