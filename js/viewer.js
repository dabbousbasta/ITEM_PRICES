'use strict';

let allItems = [];
let currentViewerProfile = null;

function createViewerRow(item) {
  const row = document.createElement('tr');

  const imageCell = document.createElement('td');
  imageCell.className = 'cell-image';
  imageCell.appendChild(createItemImageElement(item));

  const nameCell = document.createElement('td');
  const nameText = document.createElement('span');
  nameText.className = 'item-name';
  nameText.textContent = item.name;
  nameCell.appendChild(nameText);

  const priceCell = document.createElement('td');
  priceCell.className = 'cell-price';
  priceCell.textContent = formatPrice(item.price);

  row.append(imageCell, nameCell, priceCell);

  return row;
}

function renderViewerItems() {
  const searchInput = document.querySelector('#items-search');
  const tableBody = document.querySelector('#items-table-body');
  const itemsCount = document.querySelector('#items-count');
  const itemsEmpty = document.querySelector('#items-empty');

  if (!searchInput || !tableBody || !itemsCount || !itemsEmpty) {
    return;
  }

  const matchingItems = filterItemsBySearch(allItems, searchInput.value);

  tableBody.replaceChildren();

  matchingItems.forEach((item) => {
    tableBody.appendChild(createViewerRow(item));
  });

  itemsCount.textContent = `عدد الأصناف المسعّرة: ${matchingItems.length}`;
  itemsEmpty.hidden = matchingItems.length !== 0;
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

  const logoutButton = document.querySelector('#logout-button');
  const searchInput = document.querySelector('#items-search');

  if (logoutButton) {
    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;

      try {
        await signOutCurrentUser();
      } catch (error) {
        console.error('Failed to sign out:', error);
        logoutButton.disabled = false;
        window.alert('تعذر تسجيل الخروج حالياً. حاول مرة أخرى.');
      }
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', renderViewerItems);
  }

  await loadViewerItems();
}

document.addEventListener('DOMContentLoaded', initializeViewerPage);
