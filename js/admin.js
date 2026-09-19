'use strict';

let adminItems = [];
let adminProfile = null;
let itemPendingDeletion = null;

let adminSortKey = 'name';
let adminSortDirection = 'asc';

let adminSuggestionItems = [];
let adminActiveSuggestionIndex = -1;
let adminSearchTimer = null;

const INITIAL_ITEMS_LIMIT = 50;
const SEARCH_RESULTS_LIMIT = 100;
const MAX_SEARCH_SUGGESTIONS = 8;

const ADMIN_SEARCH_HISTORY_STORAGE_KEY = 'item_prices_admin_search_history';
const ADMIN_LAST_SEARCH_STORAGE_KEY = 'item_prices_admin_last_search';
const MAX_ADMIN_SEARCH_HISTORY_ITEMS = 7;

function getSavedAdminSearchHistory() {
  try {
    const savedHistory = localStorage.getItem(
      ADMIN_SEARCH_HISTORY_STORAGE_KEY
    );

    if (!savedHistory) {
      return [];
    }

    const parsedHistory = JSON.parse(savedHistory);

    if (!Array.isArray(parsedHistory)) {
      return [];
    }

    return parsedHistory
      .map((searchValue) => String(searchValue).trim())
      .filter(Boolean)
      .slice(0, MAX_ADMIN_SEARCH_HISTORY_ITEMS);
  } catch (error) {
    console.error('Failed to read admin search history:', error);
    return [];
  }
}

function saveAdminSearchHistory(searchHistory) {
  try {
    localStorage.setItem(
      ADMIN_SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(searchHistory.slice(0, MAX_ADMIN_SEARCH_HISTORY_ITEMS))
    );
  } catch (error) {
    console.error('Failed to save admin search history:', error);
  }
}

function getLastAdminSearchValue() {
  try {
    return String(
      localStorage.getItem(ADMIN_LAST_SEARCH_STORAGE_KEY) || ''
    ).trim();
  } catch (error) {
    console.error('Failed to read last admin search:', error);
    return '';
  }
}

function saveLastAdminSearchValue(searchValue) {
  try {
    const normalizedSearchValue = String(searchValue || '').trim();

    if (normalizedSearchValue) {
      localStorage.setItem(
        ADMIN_LAST_SEARCH_STORAGE_KEY,
        normalizedSearchValue
      );
    } else {
      localStorage.removeItem(ADMIN_LAST_SEARCH_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to save last admin search:', error);
  }
}

function addAdminSearchToHistory(searchValue) {
  const normalizedSearchValue = String(searchValue || '').trim();

  if (!normalizedSearchValue) {
    return;
  }

  const history = getSavedAdminSearchHistory();

  const updatedHistory = [
    normalizedSearchValue,
    ...history.filter(
      (savedSearchValue) => savedSearchValue !== normalizedSearchValue
    )
  ].slice(0, MAX_ADMIN_SEARCH_HISTORY_ITEMS);

  saveAdminSearchHistory(updatedHistory);
  renderAdminSearchHistory();
}

function clearAdminSearchHistory() {
  try {
    localStorage.removeItem(ADMIN_SEARCH_HISTORY_STORAGE_KEY);
    localStorage.removeItem(ADMIN_LAST_SEARCH_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear admin search history:', error);
  }

  renderAdminSearchHistory();
}

function useAdminSearchHistoryItem(searchValue) {
  const elements = getAdminElements();

  if (!elements.searchInput) {
    return;
  }

  elements.searchInput.value = searchValue;
  saveLastAdminSearchValue(searchValue);
  addAdminSearchToHistory(searchValue);
  closeAdminSuggestions();
  handleAdminSearchInput();
  elements.searchInput.focus();
}

function renderAdminSearchHistory() {
  const historyContainer = document.querySelector(
    '#admin-search-history'
  );
  const historyList = document.querySelector(
    '#admin-search-history-list'
  );

  if (!historyContainer || !historyList) {
    return;
  }

  const history = getSavedAdminSearchHistory();

  historyList.replaceChildren();
  historyContainer.hidden = history.length === 0;

  history.forEach((searchValue) => {
    const historyButton = document.createElement('button');

    historyButton.className = 'search-history-item';
    historyButton.type = 'button';
    historyButton.textContent = searchValue;
    historyButton.setAttribute(
      'aria-label',
      `البحث مرة أخرى عن: ${searchValue}`
    );

    historyButton.addEventListener('click', () => {
      useAdminSearchHistoryItem(searchValue);
    });

    historyList.appendChild(historyButton);
  });
}

function getAdminElements() {
  return {
    addForm: document.querySelector('#add-item-form'),
    addNameInput: document.querySelector('#add-item-name'),
    addPriceInput: document.querySelector('#add-item-price'),
    addImageInput: document.querySelector('#add-item-image'),
    addPreviewWrap: document.querySelector('#add-image-preview-wrap'),
    addPreviewImage: document.querySelector('#add-image-preview'),
    addPreviewText: document.querySelector('#add-image-preview-text'),
    addMessage: document.querySelector('#add-item-message'),
    addButton: document.querySelector('#add-item-button'),

    searchInput: document.querySelector('#admin-items-search'),
    suggestions: document.querySelector('#admin-suggestions'),

    listMessage: document.querySelector('#admin-list-message'),
    loading: document.querySelector('#admin-items-loading'),
    content: document.querySelector('#admin-items-content'),
    count: document.querySelector('#admin-items-count'),
    tableBody: document.querySelector('#admin-items-table-body'),
    empty: document.querySelector('#admin-items-empty'),

    email: document.querySelector('#admin-email'),
    logoutButton: document.querySelector('#logout-button'),

    deleteBackdrop: document.querySelector('#delete-modal-backdrop'),
    deleteText: document.querySelector('#delete-modal-text'),
    confirmDeleteButton: document.querySelector('#confirm-delete-button'),
    cancelDeleteButton: document.querySelector('#cancel-delete-button')
  };
}

function parseOptionalPrice(value) {
  const textValue = String(value ?? '').trim().replace(',', '.');

  if (textValue === '') {
    return {
      valid: true,
      price: null
    };
  }

  const price = Number(textValue);

  if (!Number.isFinite(price) || price < 0 || price > 9999999999.99) {
    return {
      valid: false,
      message: 'يرجى إدخال سعر صحيح أكبر من أو يساوي صفر، أو اتركه فارغاً للصنف غير المسعّر.'
    };
  }

  return {
    valid: true,
    price: Math.round((price + Number.EPSILON) * 100) / 100
  };
}

function validateItemData(nameValue, priceValue) {
  const name = String(nameValue ?? '').trim();

  if (!name) {
    return {
      valid: false,
      message: 'يرجى إدخال اسم الصنف.'
    };
  }

  if (name.length > 200) {
    return {
      valid: false,
      message: 'اسم الصنف طويل جداً. الحد الأقصى هو 200 حرف.'
    };
  }

  const priceResult = parseOptionalPrice(priceValue);

  if (!priceResult.valid) {
    return priceResult;
  }

  return {
    valid: true,
    name,
    price: priceResult.price
  };
}

function compareAdminItems(firstItem, secondItem) {
  if (adminSortKey === 'price') {
    const firstHasPrice = firstItem.price !== null && firstItem.price !== undefined;
    const secondHasPrice = secondItem.price !== null && secondItem.price !== undefined;

    if (!firstHasPrice && !secondHasPrice) {
      return 0;
    }

    if (!firstHasPrice) {
      return 1;
    }

    if (!secondHasPrice) {
      return -1;
    }

    const firstPrice = Number(firstItem.price);
    const secondPrice = Number(secondItem.price);

    return adminSortDirection === 'asc'
      ? firstPrice - secondPrice
      : secondPrice - firstPrice;
  }

  if (adminSortKey === 'updated_at') {
    const firstTime = new Date(firstItem.updated_at || 0).getTime();
    const secondTime = new Date(secondItem.updated_at || 0).getTime();

    return adminSortDirection === 'asc'
      ? firstTime - secondTime
      : secondTime - firstTime;
  }

  const result = String(firstItem.name || '').localeCompare(
    String(secondItem.name || ''),
    'ar',
    {
      numeric: true,
      sensitivity: 'base'
    }
  );

  return adminSortDirection === 'asc' ? result : -result;
}

function getSortedAdminItems(items) {
  return [...items].sort(compareAdminItems);
}

function createHighlightedItemName(itemName, searchValue) {
  const container = document.createElement('span');
  container.className = 'item-name';

  const name = String(itemName ?? '');
  const searchWords = getSearchWords(searchValue);

  if (searchWords.length === 0) {
    container.textContent = name;
    return container;
  }

  const normalizedName = normalizeArabicText(name);
  const ranges = [];

  searchWords.forEach((word) => {
    const start = normalizedName.indexOf(word);

    if (start !== -1) {
      ranges.push({
        start,
        end: start + word.length
      });
    }
  });

  if (ranges.length === 0) {
    container.textContent = name;
    return container;
  }

  ranges.sort((firstRange, secondRange) => firstRange.start - secondRange.start);

  const mergedRanges = [];

  ranges.forEach((range) => {
    const previous = mergedRanges[mergedRanges.length - 1];

    if (!previous || range.start > previous.end) {
      mergedRanges.push({ ...range });
      return;
    }

    previous.end = Math.max(previous.end, range.end);
  });

  let currentIndex = 0;

  mergedRanges.forEach((range) => {
    if (range.start > currentIndex) {
      container.appendChild(
        document.createTextNode(name.slice(currentIndex, range.start))
      );
    }

    const highlightedText = document.createElement('mark');
    highlightedText.className = 'search-highlight';
    highlightedText.textContent = name.slice(range.start, range.end);

    container.appendChild(highlightedText);

    currentIndex = range.end;
  });

  if (currentIndex < name.length) {
    container.appendChild(document.createTextNode(name.slice(currentIndex)));
  }

  return container;
}

function createAdminPriceCell(item) {
  const priceCell = document.createElement('td');
  priceCell.className = 'cell-price';

  if (item.price === null || item.price === undefined) {
    const status = document.createElement('span');
    status.className = 'price-missing';
    status.textContent = 'غير مسعّر';
    priceCell.appendChild(status);

    return priceCell;
  }

  priceCell.textContent = formatPrice(item.price);
  return priceCell;
}

function createActionButton(className, label, title, clickHandler, disabled = false) {
  const button = document.createElement('button');

  button.className = `table-action ${className}`;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', clickHandler);

  return button;
}

function createAdminRow(item, searchValue) {
  const row = document.createElement('tr');

  const imageCell = document.createElement('td');
  imageCell.className = 'cell-image';
  imageCell.appendChild(createItemImageElement(item));

  const nameCell = document.createElement('td');
  nameCell.appendChild(createHighlightedItemName(item.name, searchValue));

  const dateCell = document.createElement('td');
  dateCell.className = 'cell-date';
  dateCell.textContent = formatDate(item.updated_at);

  const actionsCell = document.createElement('td');
  actionsCell.className = 'cell-actions';

  const actions = document.createElement('div');
  actions.className = 'actions-row';

  const editButton = createActionButton(
    'table-action-edit',
    'تعديل الصنف',
    'تعديل الاسم أو السعر أو الصورة',
    () => openEditRow(item.id)
  );

  const deleteImageButton = createActionButton(
    'table-action-image',
    'حذف الصورة',
    item.image_path ? 'حذف صورة الصنف' : 'لا توجد صورة لهذا الصنف',
    () => handleDeleteImage(item.id),
    !item.image_path
  );

  const deleteButton = createActionButton(
    'table-action-delete',
    'حذف الصنف',
    'حذف الصنف',
    () => openDeleteModal(item.id)
  );

  actions.append(editButton, deleteImageButton, deleteButton);
  actionsCell.appendChild(actions);

  row.append(
    imageCell,
    nameCell,
    createAdminPriceCell(item),
    dateCell,
    actionsCell
  );

  return row;
}

function createEditRow(item) {
  const editRow = document.createElement('tr');
  editRow.className = 'edit-row';

  const cell = document.createElement('td');
  cell.colSpan = 5;

  const form = document.createElement('form');
  form.className = 'edit-form';
  form.noValidate = true;

  const nameGroup = document.createElement('div');
  nameGroup.className = 'form-group';

  const nameLabel = document.createElement('label');
  const nameInputId = `edit-name-${item.id}`;
  nameLabel.htmlFor = nameInputId;
  nameLabel.textContent = 'اسم الصنف';

  const nameInput = document.createElement('input');
  nameInput.id = nameInputId;
  nameInput.type = 'text';
  nameInput.maxLength = 200;
  nameInput.required = true;
  nameInput.value = item.name;

  nameGroup.append(nameLabel, nameInput);

  const priceGroup = document.createElement('div');
  priceGroup.className = 'form-group';

  const priceLabel = document.createElement('label');
  const priceInputId = `edit-price-${item.id}`;
  priceLabel.htmlFor = priceInputId;
  priceLabel.textContent = 'السعر (اختياري)';

  const priceInput = document.createElement('input');
  priceInput.id = priceInputId;
  priceInput.type = 'number';
  priceInput.min = '0';
  priceInput.max = '9999999999.99';
  priceInput.step = '0.01';
  priceInput.inputMode = 'decimal';
  priceInput.placeholder = 'اتركه فارغاً إذا كان غير مسعّر';
  priceInput.value = item.price === null || item.price === undefined
    ? ''
    : Number(item.price).toFixed(2);

  priceGroup.append(priceLabel, priceInput);

  const imageGroup = document.createElement('div');
  imageGroup.className = 'form-group';

  const imageLabel = document.createElement('label');
  const imageInputId = `edit-image-${item.id}`;
  imageLabel.htmlFor = imageInputId;
  imageLabel.textContent = item.image_path
    ? 'صورة جديدة (اختيارية)'
    : 'إضافة صورة (اختيارية)';

  const imageInput = document.createElement('input');
  imageInput.id = imageInputId;
  imageInput.className = 'file-input';
  imageInput.type = 'file';
  imageInput.accept = 'image/jpeg,image/png,image/webp';

  imageGroup.append(imageLabel, imageInput);

  const message = document.createElement('p');
  message.className = 'form-message';
  message.setAttribute('role', 'alert');
  message.setAttribute('aria-live', 'polite');

  const actions = document.createElement('div');
  actions.className = 'edit-actions';

  const saveButton = document.createElement('button');
  saveButton.className = 'button button-primary';
  saveButton.type = 'submit';
  saveButton.textContent = 'حفظ التعديل';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'button button-secondary';
  cancelButton.type = 'button';
  cancelButton.textContent = 'إلغاء';
  cancelButton.addEventListener('click', () => renderAdminItems());

  actions.append(saveButton, cancelButton);

  form.append(nameGroup, priceGroup, imageGroup, message, actions);

  form.addEventListener('submit', (event) => {
    handleEditItemSubmit(
      event,
      item.id,
      imageInput,
      nameInput,
      priceInput,
      message,
      saveButton
    );
  });

  cell.appendChild(form);
  editRow.appendChild(cell);

  return editRow;
}

function updateAdminSortHeaders() {
  const headers = {
    name: document.querySelector('#admin-sort-name'),
    price: document.querySelector('#admin-sort-price'),
    updated_at: document.querySelector('#admin-sort-updated-at')
  };

  Object.entries(headers).forEach(([key, header]) => {
    if (!header) {
      return;
    }

    const isActive = key === adminSortKey;
    const icon = header.querySelector('.sort-icon');

    header.setAttribute(
      'aria-sort',
      isActive
        ? (adminSortDirection === 'asc' ? 'ascending' : 'descending')
        : 'none'
    );

    if (icon) {
      icon.textContent = isActive
        ? (adminSortDirection === 'asc' ? '▲' : '▼')
        : '↕';
    }
  });
}
function updateAdminSearchMessage(searchValue, resultsCount) {
  const elements = getAdminElements();
  const normalizedSearchValue = String(searchValue || '').trim();

  if (!normalizedSearchValue) {
    setMessage(elements.listMessage);
    return;
  }

  if (resultsCount === 0) {
    setMessage(
      elements.listMessage,
      `لا توجد أصناف مطابقة لعبارة: ${normalizedSearchValue}`,
      'warning'
    );
    return;
  }

  setMessage(
    elements.listMessage,
    `تم العثور على ${resultsCount} صنفاً مطابقاً لعبارة: ${normalizedSearchValue}`,
    'success'
  );
}
function renderAdminItems(editItemId = null) {
  const elements = getAdminElements();

  if (!elements.tableBody || !elements.count || !elements.empty) {
    return;
  }

  const searchValue = elements.searchInput?.value || '';
  const sortedItems = getSortedAdminItems(adminItems);

  elements.tableBody.replaceChildren();

  sortedItems.forEach((item) => {
    elements.tableBody.appendChild(createAdminRow(item, searchValue));

    if (item.id === editItemId) {
      elements.tableBody.appendChild(createEditRow(item));
    }
  });

   elements.count.textContent = `عدد النتائج: ${sortedItems.length}`;
  elements.empty.hidden = sortedItems.length !== 0;

  updateAdminSearchMessage(searchValue, sortedItems.length);
  updateAdminSortHeaders();
}

function changeAdminSort(sortKey) {
  if (adminSortKey === sortKey) {
    adminSortDirection = adminSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    adminSortKey = sortKey;
    adminSortDirection = 'asc';
  }

  renderAdminItems();
}

function openEditRow(itemId) {
  renderAdminItems(itemId);

  window.setTimeout(() => {
    const input = document.querySelector(`#edit-name-${CSS.escape(itemId)}`);
    input?.focus();
  }, 0);
}
function updateAdminClearSearchButton() {
  const elements = getAdminElements();
  const clearButton = document.querySelector('#clear-admin-search');

  if (!elements.searchInput || !clearButton) {
    return;
  }

  clearButton.hidden = elements.searchInput.value.trim() === '';
}

function clearAdminSearch() {
  const elements = getAdminElements();

  if (!elements.searchInput) {
    return;
  }

  clearTimeout(adminSearchTimer);

  elements.searchInput.value = '';
  saveLastAdminSearchValue('');
  closeAdminSuggestions();
  updateAdminClearSearchButton();
  loadInitialAdminItems();
  elements.searchInput.focus();
}

function closeAdminSuggestions() {
  const elements = getAdminElements();

  adminSuggestionItems = [];
  adminActiveSuggestionIndex = -1;

  if (elements.suggestions) {
    elements.suggestions.replaceChildren();
    elements.suggestions.hidden = true;
  }

  elements.searchInput?.setAttribute('aria-expanded', 'false');
  elements.searchInput?.removeAttribute('aria-activedescendant');
}

function selectAdminSuggestion(item) {
  const elements = getAdminElements();

  if (!elements.searchInput) {
    return;
  }

  // يمنع تنفيذ بحث قديم مؤجل يعيد فتح الاقتراحات
  clearTimeout(adminSearchTimer);

  elements.searchInput.value = item.name;
  saveLastAdminSearchValue(item.name);
  addAdminSearchToHistory(item.name);

  closeAdminSuggestions();

  adminItems = [item];
  renderAdminItems();

  elements.searchInput.focus();
}

function renderAdminSuggestions() {
  const elements = getAdminElements();

  if (!elements.searchInput || !elements.suggestions) {
    return;
  }

  const searchValue = elements.searchInput.value.trim();

  if (!searchValue) {
    closeAdminSuggestions();
    return;
  }

  adminSuggestionItems = adminItems.slice(0, MAX_SEARCH_SUGGESTIONS);
  adminActiveSuggestionIndex = -1;

  elements.suggestions.replaceChildren();

  if (adminSuggestionItems.length === 0) {
    elements.suggestions.hidden = true;
    elements.searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  adminSuggestionItems.forEach((item, index) => {
    const suggestion = document.createElement('button');

    suggestion.id = `admin-suggestion-${index}`;
    suggestion.className = 'search-suggestion';
    suggestion.type = 'button';
    suggestion.setAttribute('role', 'option');
    suggestion.setAttribute('aria-selected', 'false');
    suggestion.appendChild(createHighlightedItemName(item.name, searchValue));

    suggestion.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectAdminSuggestion(item);
    });

    elements.suggestions.appendChild(suggestion);
  });

  elements.suggestions.hidden = false;
  elements.searchInput.setAttribute('aria-expanded', 'true');
}

function updateAdminActiveSuggestion() {
  const elements = getAdminElements();

  if (!elements.searchInput || !elements.suggestions) {
    return;
  }

  const options = elements.suggestions.querySelectorAll('.search-suggestion');

  options.forEach((option, index) => {
    const isActive = index === adminActiveSuggestionIndex;

    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');

    if (isActive) {
      elements.searchInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });

  if (adminActiveSuggestionIndex === -1) {
    elements.searchInput.removeAttribute('aria-activedescendant');
  }
}

function handleAdminSearchKeydown(event) {
  const elements = getAdminElements();
  const listIsOpen = elements.suggestions && !elements.suggestions.hidden;

  if (!listIsOpen || adminSuggestionItems.length === 0) {
    if (event.key === 'Enter') {
      addAdminSearchToHistory(elements.searchInput?.value);
      return;
    }

    if (event.key === 'Escape') {
      closeAdminSuggestions();
    }

    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();

    adminActiveSuggestionIndex =
      (adminActiveSuggestionIndex + 1) % adminSuggestionItems.length;

    updateAdminActiveSuggestion();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();

    adminActiveSuggestionIndex =
      (adminActiveSuggestionIndex - 1 + adminSuggestionItems.length)
      % adminSuggestionItems.length;

    updateAdminActiveSuggestion();
    return;
  }

  if (event.key === 'Enter') {
    event.preventDefault();

    const selectedItem =
      adminActiveSuggestionIndex >= 0
        ? adminSuggestionItems[adminActiveSuggestionIndex]
        : adminSuggestionItems[0];

    selectAdminSuggestion(selectedItem);
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    closeAdminSuggestions();
  }
}

function hideAdminLoading() {
  const elements = getAdminElements();

  if (elements.loading) {
    elements.loading.hidden = true;
  }

  if (elements.content) {
    elements.content.hidden = false;
  }
}

async function loadInitialAdminItems() {
  const elements = getAdminElements();

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .select('id, name, price, image_path, created_at, updated_at')
      .order('name', { ascending: true })
      .range(0, INITIAL_ITEMS_LIMIT - 1);

    if (error) {
      throw error;
    }

    adminItems = Array.isArray(data) ? data : [];
    renderAdminItems();
  } catch (error) {
    console.error('Failed to load initial admin items:', error);

    setMessage(
      elements.listMessage,
      'تعذر تحميل الأصناف حالياً. تأكد من اتصال الإنترنت ثم حدّث الصفحة.',
      'error'
    );
  } finally {
    hideAdminLoading();
  }
}

async function searchAdminItems(searchValue) {
  const elements = getAdminElements();

  try {
    const { data, error } = await supabaseClient.rpc(
      'search_items_by_words',
      {
        search_text: searchValue,
        max_results: SEARCH_RESULTS_LIMIT,
        only_priced: false
      }
    );

    if (error) {
      throw error;
    }

    adminItems = Array.isArray(data) ? data : [];
    renderAdminItems();
    renderAdminSuggestions();
  } catch (error) {
    console.error('Failed to search items:', error);

    setMessage(
      elements.listMessage,
      'تعذر تنفيذ البحث حالياً. حاول مرة أخرى.',
      'error'
    );
  }
}

function handleAdminSearchInput() {
  const elements = getAdminElements();
  const searchValue = elements.searchInput?.value.trim() || '';

  saveLastAdminSearchValue(searchValue);
    updateAdminClearSearchButton();

  clearTimeout(adminSearchTimer);

  adminSearchTimer = window.setTimeout(() => {
    if (!searchValue) {
      closeAdminSuggestions();
      loadInitialAdminItems();
      return;
    }

    searchAdminItems(searchValue);
  }, 250);
}

function revokePreviewUrl(imageElement) {
  if (imageElement?.dataset?.objectUrl) {
    URL.revokeObjectURL(imageElement.dataset.objectUrl);
    delete imageElement.dataset.objectUrl;
  }
}

function clearAddImagePreview() {
  const elements = getAdminElements();

  revokePreviewUrl(elements.addPreviewImage);
  elements.addPreviewImage?.removeAttribute('src');

  if (elements.addPreviewText) {
    elements.addPreviewText.textContent = '';
  }

  elements.addPreviewWrap?.classList.remove('is-visible');
}

function showAddImagePreview(file) {
  const elements = getAdminElements();

  clearAddImagePreview();

  if (!file) {
    return;
  }

  const objectUrl = URL.createObjectURL(file);

  if (elements.addPreviewImage) {
    elements.addPreviewImage.src = objectUrl;
    elements.addPreviewImage.dataset.objectUrl = objectUrl;
  }

  if (elements.addPreviewText) {
    elements.addPreviewText.textContent =
      `${file.name} — ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  elements.addPreviewWrap?.classList.add('is-visible');
}

async function uploadItemImage(file) {
  const imagePath = createStorageImagePath(file);

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .upload(imagePath, file, {
      cacheControl: '31536000',
      contentType: file.type,
      upsert: false
    });

  if (error) {
    throw error;
  }

  return imagePath;
}

async function deleteItemImage(imagePath) {
  if (!imagePath) {
    return;
  }

  const { error } = await supabaseClient.storage
    .from(STORAGE_BUCKET)
    .remove([imagePath]);

  if (error) {
    throw error;
  }
}

async function handleAddItemSubmit(event) {
  event.preventDefault();

  const elements = getAdminElements();
  const validation = validateItemData(
    elements.addNameInput?.value,
    elements.addPriceInput?.value
  );

  setMessage(elements.addMessage);

  if (!validation.valid) {
    setMessage(elements.addMessage, validation.message, 'error');
    return;
  }

  const file = elements.addImageInput?.files?.[0] || null;
  const imageValidation = validateImageFile(file);

  if (!imageValidation.valid) {
    setMessage(elements.addMessage, imageValidation.message, 'error');
    return;
  }

  setButtonLoading(elements.addButton, true, 'جارٍ إضافة الصنف...');

  let uploadedImagePath = null;

  try {
    if (file) {
      uploadedImagePath = await uploadItemImage(file);
    }

    const { data, error } = await supabaseClient
      .from('items')
      .insert({
        name: validation.name,
        price: validation.price,
        image_path: uploadedImagePath,
        created_by: adminProfile.id,
        updated_by: adminProfile.id
      })
      .select('id, name, price, image_path, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    adminItems = [data, ...adminItems];

    elements.addForm.reset();
    clearAddImagePreview();

    setMessage(
      elements.addMessage,
      validation.price === null
        ? 'تمت إضافة الصنف بدون سعر. سيظهر في لوحة الإدارة فقط إلى أن تضع له سعراً.'
        : 'تمت إضافة الصنف بنجاح.',
      'success'
    );

    renderAdminItems();
  } catch (error) {
    console.error('Failed to add item:', error);

    if (uploadedImagePath) {
      try {
        await deleteItemImage(uploadedImagePath);
      } catch (cleanupError) {
        console.error('Failed to remove unused uploaded image:', cleanupError);
      }
    }

    setMessage(
      elements.addMessage,
      'تعذر إضافة الصنف. تأكد من البيانات والاتصال ثم حاول مرة أخرى.',
      'error'
    );
  } finally {
    setButtonLoading(elements.addButton, false);
  }
}

async function handleEditItemSubmit(
  event,
  itemId,
  imageInput,
  nameInput,
  priceInput,
  messageElement,
  saveButton
) {
  event.preventDefault();

  const itemIndex = adminItems.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    setMessage(messageElement, 'لم يتم العثور على الصنف. ابحث عنه من جديد.', 'error');
    return;
  }

  const previousItem = adminItems[itemIndex];
  const validation = validateItemData(nameInput.value, priceInput.value);

  setMessage(messageElement);

  if (!validation.valid) {
    setMessage(messageElement, validation.message, 'error');
    return;
  }

  const newFile = imageInput.files?.[0] || null;
  const imageValidation = validateImageFile(newFile);

  if (!imageValidation.valid) {
    setMessage(messageElement, imageValidation.message, 'error');
    return;
  }

  setButtonLoading(saveButton, true, 'جارٍ حفظ التعديل...');

  let newImagePath = null;

  try {
    if (newFile) {
      newImagePath = await uploadItemImage(newFile);
    }

    const updatePayload = {
      name: validation.name,
      price: validation.price,
      updated_by: adminProfile.id
    };

    if (newImagePath) {
      updatePayload.image_path = newImagePath;
    }

    const { data, error } = await supabaseClient
      .from('items')
      .update(updatePayload)
      .eq('id', itemId)
      .select('id, name, price, image_path, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    adminItems[itemIndex] = data;

    if (newImagePath && previousItem.image_path) {
      try {
        await deleteItemImage(previousItem.image_path);
      } catch (cleanupError) {
        console.error('Failed to remove old image:', cleanupError);
      }
    }

    renderAdminItems();

    setMessage(
      getAdminElements().listMessage,
      data.price === null
        ? 'تم حفظ التعديل. الصنف غير مسعّر ولن يظهر في صفحة الأسعار حتى تضع له سعراً.'
        : 'تم حفظ التعديل بنجاح.',
      'success'
    );
  } catch (error) {
    console.error('Failed to edit item:', error);

    if (newImagePath) {
      try {
        await deleteItemImage(newImagePath);
      } catch (cleanupError) {
        console.error('Failed to remove unused replacement image:', cleanupError);
      }
    }

    setMessage(
      messageElement,
      'تعذر حفظ التعديل. تأكد من البيانات والاتصال ثم حاول مرة أخرى.',
      'error'
    );
  } finally {
    setButtonLoading(saveButton, false);
  }
}

function openDeleteModal(itemId) {
  const item = adminItems.find((currentItem) => currentItem.id === itemId);
  const elements = getAdminElements();

  if (!item || !elements.deleteBackdrop || !elements.deleteText) {
    return;
  }

  itemPendingDeletion = item;
  elements.deleteText.textContent = `هل أنت متأكد من حذف الصنف: ${item.name}؟`;
  elements.deleteBackdrop.classList.add('is-open');
  elements.deleteBackdrop.setAttribute('aria-hidden', 'false');
  elements.confirmDeleteButton?.focus();
}

function closeDeleteModal() {
  const elements = getAdminElements();

  itemPendingDeletion = null;
  elements.deleteBackdrop?.classList.remove('is-open');
  elements.deleteBackdrop?.setAttribute('aria-hidden', 'true');
}

async function handleConfirmDeleteItem() {
  const item = itemPendingDeletion;
  const elements = getAdminElements();

  if (!item) {
    closeDeleteModal();
    return;
  }

  setButtonLoading(elements.confirmDeleteButton, true, 'جارٍ الحذف...');

  try {
    const { error } = await supabaseClient
      .from('items')
      .delete()
      .eq('id', item.id);

    if (error) {
      throw error;
    }

    adminItems = adminItems.filter((currentItem) => currentItem.id !== item.id);

    closeDeleteModal();
    renderAdminItems();

    setMessage(elements.listMessage, 'تم حذف الصنف بنجاح.', 'success');

    if (item.image_path) {
      try {
        await deleteItemImage(item.image_path);
      } catch (imageError) {
        console.error('Item deleted but image cleanup failed:', imageError);

        setMessage(
          elements.listMessage,
          'تم حذف الصنف، لكن تعذر حذف ملف الصورة القديم من Storage.',
          'warning'
        );
      }
    }
  } catch (error) {
    console.error('Failed to delete item:', error);

    setMessage(
      elements.listMessage,
      'تعذر حذف الصنف. حاول مرة أخرى.',
      'error'
    );
  } finally {
    if (itemPendingDeletion) {
      setButtonLoading(elements.confirmDeleteButton, false);
    }
  }
}

async function handleDeleteImage(itemId) {
  const itemIndex = adminItems.findIndex((item) => item.id === itemId);
  const elements = getAdminElements();

  if (itemIndex === -1) {
    return;
  }

  const item = adminItems[itemIndex];

  if (!item.image_path) {
    return;
  }

  const confirmed = window.confirm(
    `هل أنت متأكد من حذف صورة الصنف: ${item.name}؟`
  );

  if (!confirmed) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .update({
        image_path: null,
        updated_by: adminProfile.id
      })
      .eq('id', item.id)
      .select('id, name, price, image_path, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    adminItems[itemIndex] = data;
    renderAdminItems();

    try {
      await deleteItemImage(item.image_path);
      setMessage(elements.listMessage, 'تم حذف الصورة بنجاح.', 'success');
    } catch (storageError) {
      console.error(
        'Database image reference removed but storage cleanup failed:',
        storageError
      );

      setMessage(
        elements.listMessage,
        'تمت إزالة الصورة من الصنف، لكن تعذر حذف ملفها القديم من Storage.',
        'warning'
      );
    }
  } catch (error) {
    console.error('Failed to remove image:', error);

    setMessage(
      elements.listMessage,
      'تعذر حذف الصورة. حاول مرة أخرى.',
      'error'
    );
  }
}

function bindAdminEvents() {
  const elements = getAdminElements();
  const sortButtons = document.querySelectorAll('[data-sort-key]');
  const clearSearchHistoryButton = document.querySelector(
    '#clear-admin-search-history'
  );
    const clearAdminSearchButton = document.querySelector(
    '#clear-admin-search'
  );

  elements.addForm?.addEventListener('submit', handleAddItemSubmit);

  elements.addImageInput?.addEventListener('change', () => {
    const file = elements.addImageInput.files?.[0] || null;
    const validation = validateImageFile(file);

    if (!validation.valid) {
      elements.addImageInput.value = '';
      clearAddImagePreview();
      setMessage(elements.addMessage, validation.message, 'error');
      return;
    }

    setMessage(elements.addMessage);
    showAddImagePreview(file);
  });

  elements.searchInput?.addEventListener('input', handleAdminSearchInput);

  elements.searchInput?.addEventListener('keydown', handleAdminSearchKeydown);

  elements.searchInput?.addEventListener('focus', () => {
    if (elements.searchInput.value.trim()) {
      renderAdminSuggestions();
    }
  });

  elements.searchInput?.addEventListener('blur', () => {
    addAdminSearchToHistory(elements.searchInput?.value);

    window.setTimeout(closeAdminSuggestions, 150);
  });

  clearSearchHistoryButton?.addEventListener('click', () => {
    clearAdminSearchHistory();
  });
    clearAdminSearchButton?.addEventListener('click', () => {
    clearAdminSearch();
  });

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      changeAdminSort(button.dataset.sortKey);
    });
  });

  elements.cancelDeleteButton?.addEventListener('click', closeDeleteModal);

  elements.confirmDeleteButton?.addEventListener(
    'click',
    handleConfirmDeleteItem
  );

  elements.deleteBackdrop?.addEventListener('click', (event) => {
    if (event.target === elements.deleteBackdrop) {
      closeDeleteModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && itemPendingDeletion) {
      closeDeleteModal();
    }
  });

  elements.logoutButton?.addEventListener('click', async () => {
    elements.logoutButton.disabled = true;

    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error('Failed to sign out:', error);
      elements.logoutButton.disabled = false;
      window.alert('تعذر تسجيل الخروج حالياً. حاول مرة أخرى.');
    }
  });
}

async function initializeAdminPage() {
  const elements = getAdminElements();

  bindAdminEvents();

  window.setTimeout(() => {
    hideAdminLoading();
  }, 1200);

  adminProfile = await requireAdmin();

  if (!adminProfile) {
    return;
  }

  if (elements.email) {
    elements.email.textContent = adminProfile.email || 'مدير النظام';
  }

  if (elements.searchInput) {
    elements.searchInput.value = getLastAdminSearchValue();
  }

  renderAdminSearchHistory();
    updateAdminClearSearchButton();

  const savedSearchValue = elements.searchInput?.value.trim() || '';

  if (savedSearchValue) {
    handleAdminSearchInput();
    return;
  }

  await loadInitialAdminItems();
}

document.addEventListener('DOMContentLoaded', initializeAdminPage);
