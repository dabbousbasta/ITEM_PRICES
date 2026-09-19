'use strict';

let allItems = [];
let currentViewerProfile = null;

let viewerSortKey = 'name';
let viewerSortDirection = 'asc';

let viewerSuggestionItems = [];
let viewerActiveSuggestionIndex = -1;

const SEARCH_HISTORY_STORAGE_KEY = 'item_prices_search_history';
const LAST_SEARCH_STORAGE_KEY = 'item_prices_last_search';
const MAX_SEARCH_HISTORY_ITEMS = 7;
const MAX_VIEWER_SEARCH_SUGGESTIONS = 8;

function getSavedSearchHistory() {
  try {
    const savedHistory = localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);

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
      .slice(0, MAX_SEARCH_HISTORY_ITEMS);
  } catch (error) {
    console.error('Failed to read search history:', error);
    return [];
  }
}

function saveSearchHistory(searchHistory) {
  try {
    localStorage.setItem(
      SEARCH_HISTORY_STORAGE_KEY,
      JSON.stringify(searchHistory.slice(0, MAX_SEARCH_HISTORY_ITEMS))
    );
  } catch (error) {
    console.error('Failed to save search history:', error);
  }
}

function getLastSearchValue() {
  try {
    return String(
      localStorage.getItem(LAST_SEARCH_STORAGE_KEY) || ''
    ).trim();
  } catch (error) {
    console.error('Failed to read last search:', error);
    return '';
  }
}

function saveLastSearchValue(searchValue) {
  try {
    const normalizedSearchValue = String(searchValue || '').trim();

    if (normalizedSearchValue) {
      localStorage.setItem(
        LAST_SEARCH_STORAGE_KEY,
        normalizedSearchValue
      );
    } else {
      localStorage.removeItem(LAST_SEARCH_STORAGE_KEY);
    }
  } catch (error) {
    console.error('Failed to save last search:', error);
  }
}

function addSearchToHistory(searchValue) {
  const normalizedSearchValue = String(searchValue || '').trim();

  if (!normalizedSearchValue) {
    return;
  }

  const history = getSavedSearchHistory();

  const updatedHistory = [
    normalizedSearchValue,
    ...history.filter(
      (savedSearchValue) => savedSearchValue !== normalizedSearchValue
    )
  ].slice(0, MAX_SEARCH_HISTORY_ITEMS);

  saveSearchHistory(updatedHistory);
  renderSearchHistory();
}

function clearSearchHistory() {
  try {
    localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    localStorage.removeItem(LAST_SEARCH_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear search history:', error);
  }

  renderSearchHistory();
}

function useSearchHistoryItem(searchValue) {
  const searchInput = document.querySelector('#items-search');

  if (!searchInput) {
    return;
  }

  searchInput.value = searchValue;
  saveLastSearchValue(searchValue);
  addSearchToHistory(searchValue);
  closeViewerSuggestions();
  renderViewerItems();
  searchInput.focus();
}

function renderSearchHistory() {
  const historyContainer = document.querySelector('#search-history');
  const historyList = document.querySelector('#search-history-list');

  if (!historyContainer || !historyList) {
    return;
  }

  const history = getSavedSearchHistory();

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
      useSearchHistoryItem(searchValue);
    });

    historyList.appendChild(historyButton);
  });
}

function compareViewerItems(firstItem, secondItem) {
  if (viewerSortKey === 'price') {
    const firstPrice = Number(firstItem.price);
    const secondPrice = Number(secondItem.price);

    return viewerSortDirection === 'asc'
      ? firstPrice - secondPrice
      : secondPrice - firstPrice;
  }

  const result = String(firstItem.name || '').localeCompare(
    String(secondItem.name || ''),
    'ar',
    {
      numeric: true,
      sensitivity: 'base'
    }
  );

  return viewerSortDirection === 'asc' ? result : -result;
}

function getSortedViewerItems(items) {
  return [...items].sort(compareViewerItems);
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
  const matchRanges = [];

  searchWords.forEach((word) => {
    const startIndex = normalizedName.indexOf(word);

    if (startIndex !== -1) {
      matchRanges.push({
        start: startIndex,
        end: startIndex + word.length
      });
    }
  });

  if (matchRanges.length === 0) {
    container.textContent = name;
    return container;
  }

  matchRanges.sort(
    (firstRange, secondRange) => firstRange.start - secondRange.start
  );

  const mergedRanges = [];

  matchRanges.forEach((range) => {
    const previousRange = mergedRanges[mergedRanges.length - 1];

    if (!previousRange || range.start > previousRange.end) {
      mergedRanges.push({ ...range });
      return;
    }

    previousRange.end = Math.max(previousRange.end, range.end);
  });

  let currentIndex = 0;

  mergedRanges.forEach((range) => {
    if (range.start > currentIndex) {
      container.appendChild(
        document.createTextNode(name.slice(currentIndex, range.start))
      );
    }

    const highlight = document.createElement('mark');
    highlight.className = 'search-highlight';
    highlight.textContent = name.slice(range.start, range.end);
    container.appendChild(highlight);

    currentIndex = range.end;
  });

  if (currentIndex < name.length) {
    container.appendChild(document.createTextNode(name.slice(currentIndex)));
  }

  return container;
}
function updateViewerClearSearchButton() {
  const searchInput = document.querySelector('#items-search');
  const clearButton = document.querySelector('#clear-viewer-search');

  if (!searchInput || !clearButton) {
    return;
  }

  clearButton.hidden = searchInput.value.trim() === '';
}

function clearViewerSearch() {
  const searchInput = document.querySelector('#items-search');

  if (!searchInput) {
    return;
  }

  searchInput.value = '';
  saveLastSearchValue('');
  closeViewerSuggestions();
  updateViewerClearSearchButton();
  renderViewerItems();
  searchInput.focus();
}
function closeViewerSuggestions() {
  const searchInput = document.querySelector('#items-search');
  const suggestionsElement = document.querySelector('#viewer-suggestions');

  viewerSuggestionItems = [];
  viewerActiveSuggestionIndex = -1;

  if (suggestionsElement) {
    suggestionsElement.replaceChildren();
    suggestionsElement.hidden = true;
  }

  searchInput?.setAttribute('aria-expanded', 'false');
  searchInput?.removeAttribute('aria-activedescendant');
}

function selectViewerSuggestion(item) {
  const searchInput = document.querySelector('#items-search');

  if (!searchInput) {
    return;
  }

  searchInput.value = item.name;
  saveLastSearchValue(item.name);
  addSearchToHistory(item.name);
  closeViewerSuggestions();
  renderViewerItems();
  searchInput.focus();
}

function renderViewerSuggestions() {
  const searchInput = document.querySelector('#items-search');
  const suggestionsElement = document.querySelector('#viewer-suggestions');

  if (!searchInput || !suggestionsElement) {
    return;
  }

  const searchValue = searchInput.value.trim();

  if (!searchValue) {
    closeViewerSuggestions();
    return;
  }

  viewerSuggestionItems = filterItemsBySearch(allItems, searchValue)
    .slice(0, MAX_VIEWER_SEARCH_SUGGESTIONS);

  viewerActiveSuggestionIndex = -1;
  suggestionsElement.replaceChildren();

  if (viewerSuggestionItems.length === 0) {
    suggestionsElement.hidden = true;
    searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  viewerSuggestionItems.forEach((item, index) => {
    const suggestion = document.createElement('button');

    suggestion.id = `viewer-suggestion-${index}`;
    suggestion.className = 'search-suggestion';
    suggestion.type = 'button';
    suggestion.setAttribute('role', 'option');
    suggestion.setAttribute('aria-selected', 'false');
    suggestion.appendChild(createHighlightedItemName(item.name, searchValue));

    suggestion.addEventListener('mousedown', (event) => {
      event.preventDefault();
      selectViewerSuggestion(item);
    });

    suggestionsElement.appendChild(suggestion);
  });

  suggestionsElement.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

function updateViewerActiveSuggestion() {
  const searchInput = document.querySelector('#items-search');
  const suggestionsElement = document.querySelector('#viewer-suggestions');

  if (!searchInput || !suggestionsElement) {
    return;
  }

  const options = suggestionsElement.querySelectorAll('.search-suggestion');

  options.forEach((option, index) => {
    const isActive = index === viewerActiveSuggestionIndex;

    option.classList.toggle('is-active', isActive);
    option.setAttribute('aria-selected', isActive ? 'true' : 'false');

    if (isActive) {
      searchInput.setAttribute('aria-activedescendant', option.id);
      option.scrollIntoView({ block: 'nearest' });
    }
  });

  if (viewerActiveSuggestionIndex === -1) {
    searchInput.removeAttribute('aria-activedescendant');
  }
}

function handleViewerSearchKeydown(event) {
  const suggestionsElement = document.querySelector('#viewer-suggestions');
  const listIsOpen = suggestionsElement && !suggestionsElement.hidden;

  if (!listIsOpen || viewerSuggestionItems.length === 0) {
    if (event.key === 'Enter') {
      addSearchToHistory(event.currentTarget.value);
    }

    if (event.key === 'Escape') {
      closeViewerSuggestions();
    }

    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();

    viewerActiveSuggestionIndex =
      (viewerActiveSuggestionIndex + 1) % viewerSuggestionItems.length;

    updateViewerActiveSuggestion();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();

    viewerActiveSuggestionIndex =
      (viewerActiveSuggestionIndex - 1 + viewerSuggestionItems.length)
      % viewerSuggestionItems.length;

    updateViewerActiveSuggestion();
    return;
  }

  if (event.key === 'Enter' && viewerActiveSuggestionIndex >= 0) {
    event.preventDefault();
    selectViewerSuggestion(
      viewerSuggestionItems[viewerActiveSuggestionIndex]
    );
    return;
  }

  if (event.key === 'Enter') {
    addSearchToHistory(event.currentTarget.value);
    closeViewerSuggestions();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeViewerSuggestions();
  }
}

function createViewerRow(item, searchValue) {
  const row = document.createElement('tr');

  const imageCell = document.createElement('td');
  imageCell.className = 'cell-image';
  imageCell.appendChild(createItemImageElement(item));

  const nameCell = document.createElement('td');
  nameCell.appendChild(createHighlightedItemName(item.name, searchValue));

  const priceCell = document.createElement('td');
  priceCell.className = 'cell-price';
  priceCell.textContent = formatPrice(item.price);

  row.append(imageCell, nameCell, priceCell);

  return row;
}

function updateViewerSortHeaders() {
  const headers = {
    name: document.querySelector('#viewer-sort-name'),
    price: document.querySelector('#viewer-sort-price')
  };

  Object.entries(headers).forEach(([key, header]) => {
    if (!header) {
      return;
    }

    const isActive = key === viewerSortKey;
    const icon = header.querySelector('.sort-icon');

    header.setAttribute(
      'aria-sort',
      isActive
        ? (viewerSortDirection === 'asc' ? 'ascending' : 'descending')
        : 'none'
    );

    if (icon) {
      icon.textContent = isActive
        ? (viewerSortDirection === 'asc' ? '▲' : '▼')
        : '↕';
    }
  });
}

function changeViewerSort(sortKey) {
  if (viewerSortKey === sortKey) {
    viewerSortDirection = viewerSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    viewerSortKey = sortKey;
    viewerSortDirection = 'asc';
  }

  renderViewerItems();
}

function renderViewerItems() {
  const searchInput = document.querySelector('#items-search');
  const tableBody = document.querySelector('#items-table-body');
  const itemsCount = document.querySelector('#items-count');
  const itemsEmpty = document.querySelector('#items-empty');

  if (!searchInput || !tableBody || !itemsCount || !itemsEmpty) {
    return;
  }

  const searchValue = searchInput.value;
  const matchingItems = filterItemsBySearch(allItems, searchValue);
  const sortedItems = getSortedViewerItems(matchingItems);

  tableBody.replaceChildren();

  sortedItems.forEach((item) => {
    tableBody.appendChild(createViewerRow(item, searchValue));
  });

  itemsCount.textContent = `عدد الأصناف المسعّرة: ${sortedItems.length}`;
  itemsEmpty.hidden = sortedItems.length !== 0;

  updateViewerSortHeaders();
}

async function loadViewerItems() {
  const loadingElement = document.querySelector('#items-loading');
  const contentElement = document.querySelector('#items-content');
  const messageElement = document.querySelector('#viewer-message');

  setMessage(messageElement);

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .select('id, name, price, image_path, created_at, updated_at')
      .not('price', 'is', null)
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    allItems = Array.isArray(data) ? data : [];
    renderViewerItems();
  } catch (error) {
    console.error('Failed to load items:', error);

    setMessage(
      messageElement,
      'تعذر تحميل الأصناف حالياً. تأكد من اتصال الإنترنت ثم حدّث الصفحة.',
      'error'
    );
  } finally {
    if (loadingElement) {
      loadingElement.hidden = true;
    }

    if (contentElement) {
      contentElement.hidden = false;
    }
  }
}

function showViewerProfile(profile) {
  const emailElement = document.querySelector('#viewer-email');
  const roleElement = document.querySelector('#viewer-role');
  const adminLink = document.querySelector('#admin-link');

  if (emailElement) {
    emailElement.textContent = profile.email || 'مستخدم مسجل';
  }

  if (roleElement) {
    roleElement.textContent = profile.role === 'admin'
      ? 'نوع الحساب: Admin'
      : 'نوع الحساب: Viewer';
  }

  if (adminLink) {
    adminLink.hidden = profile.role !== 'admin';
  }
}

function bindViewerEvents() {
  const logoutButton = document.querySelector('#logout-button');
  const searchInput = document.querySelector('#items-search');
  const clearSearchHistoryButton = document.querySelector(
    '#clear-search-history'
  );
    const clearViewerSearchButton = document.querySelector(
    '#clear-viewer-search'
  );
  const sortButtons = document.querySelectorAll('[data-sort-key]');

  logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;

    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error('Failed to sign out:', error);
      logoutButton.disabled = false;
      window.alert('تعذر تسجيل الخروج حالياً. حاول مرة أخرى.');
    }
  });

  searchInput?.addEventListener('input', () => {
    const searchValue = searchInput.value;

    saveLastSearchValue(searchValue);
    updateViewerClearSearchButton();
    renderViewerItems();
    renderViewerSuggestions();
  });

  searchInput?.addEventListener('change', () => {
    addSearchToHistory(searchInput.value);
  });

  searchInput?.addEventListener('keydown', handleViewerSearchKeydown);

  searchInput?.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      renderViewerSuggestions();
    }
  });

  searchInput?.addEventListener('blur', () => {
    addSearchToHistory(searchInput.value);

    window.setTimeout(closeViewerSuggestions, 150);
  });

  clearSearchHistoryButton?.addEventListener('click', () => {
    clearSearchHistory();
  });
    clearViewerSearchButton?.addEventListener('click', () => {
    clearViewerSearch();
  });

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      changeViewerSort(button.dataset.sortKey);
    });
  });
}

async function initializeViewerPage() {
  const user = await requireAuthenticatedUser();

  if (!user) {
    return;
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    await supabaseClient.auth.signOut();
    window.location.replace('login.html');
    return;
  }

  currentViewerProfile = profile;
  showViewerProfile(currentViewerProfile);

  const searchInput = document.querySelector('#items-search');

  if (searchInput) {
    searchInput.value = getLastSearchValue();
  }

  bindViewerEvents();
  updateViewerClearSearchButton();
  renderSearchHistory();

  await loadViewerItems();
}

document.addEventListener('DOMContentLoaded', initializeViewerPage);
