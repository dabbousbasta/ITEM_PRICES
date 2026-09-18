'use strict';

let adminItems = [];
let adminProfile = null;
let itemPendingDeletion = null;
let adminSortKey = 'name';
let adminSortDirection = 'asc';
let adminSearchTimer = null;

const INITIAL_ITEMS_LIMIT = 50;
const SEARCH_RESULTS_LIMIT = 100;

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

  if (!textValue) {
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

function compareAdminItems(a, b) {
  if (adminSortKey === 'price') {
    const aHasPrice = a.price !== null && a.price !== undefined;
    const bHasPrice = b.price !== null && b.price !== undefined;

    if (!aHasPrice && !bHasPrice) {
      return 0;
    }

    if (!aHasPrice) {
      return 1;
    }

    if (!bHasPrice) {
      return -1;
    }

    return adminSortDirection === 'asc'
      ? Number(a.price) - Number(b.price)
      : Number(b.price) - Number(a.price);
  }

  if (adminSortKey === 'updated_at') {
    const aTime = new Date(a.updated_at || 0).getTime();
    const bTime = new Date(b.updated_at || 0).getTime();

    return adminSortDirection === 'asc'
      ? aTime - bTime
      : bTime - aTime;
  }

  const result = String(a.name || '').localeCompare(
    String(b.name || ''),
    'ar',
    {
      numeric: true,
      sensitivity: 'base'
    }
  );

  return adminSortDirection === 'asc' ? result : -result;
}

function createHighlightedName(itemName, searchValue) {
  const container = document.createElement('span');
  container.className = 'item-name';

  const name = String(itemName ?? '');
  const words = getSearchWords(searchValue);

  if (!words.length) {
    container.textContent = name;
    return container;
  }

  const normalizedName = normalizeArabicText(name);
  const ranges = [];

  words.forEach((word) => {
    const start = normalizedName.indexOf(word);

    if (start !== -1) {
      ranges.push({
        start,
        end: start + word.length
      });
    }
  });

  if (!ranges.length) {
    container.textContent = name;
    return container;
  }

  ranges.sort((a, b) => a.start - b.start);

  const merged = [];

  ranges.forEach((range) => {
    const previous = merged[merged.length - 1];

    if (!previous || range.start > previous.end) {
      merged.push({ ...range });
      return;
    }

    previous.end = Math.max(previous.end, range.end);
  });

  let position = 0;

  merged.forEach((range) => {
    if (range.start > position) {
      container.appendChild(
        document.createTextNode(name.slice(position, range.start))
      );
    }

    const mark = document.createElement('mark');
    mark.className = 'search-highlight';
    mark.textContent = name.slice(range.start, range.end);
    container.appendChild(mark);

    position = range.end;
  });

  if (position < name.length) {
    container.appendChild(document.createTextNode(name.slice(position)));
  }

  return container;
}

function createPriceCell(item) {
  const cell = document.createElement('td');
  cell.className = 'cell-price';

  if (item.price === null || item.price === undefined) {
    const missing = document.createElement('span');
    missing.className = 'price-missing';
    missing.textContent = 'غير مسعّر';
    cell.appendChild(missing);
  } else {
    cell.textContent = formatPrice(item.price);
  }

  return cell;
}

function createActionButton(className, label, title, onClick, disabled = false) {
  const button = document.createElement('button');

  button.className = `table-action ${className}`;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = title;
  button.disabled = disabled;
  button.addEventListener('click', onClick);

  return button;
}

function createAdminRow(item, searchValue) {
  const row = document.createElement('tr');

  const imageCell = document.createElement('td');
  imageCell.className = 'cell-image';
  imageCell.appendChild(createItemImageElement(item));

  const nameCell = document.createElement('td');
  nameCell.appendChild(createHighlightedName(item.name, searchValue));

  const dateCell = document.createElement('td');
  dateCell.className = 'cell-date';
  dateCell.textContent = formatDate(item.updated_at);

  const actionsCell = document.createElement('td');
  actionsCell.className = 'cell-actions';

  const actions = document.createElement('div');
  actions.className = 'actions-row';

  actions.append(
    createActionButton(
      'table-action-edit',
      'تعديل الصنف',
      'تعديل الاسم أو السعر أو الصورة',
      () => openEditRow(item.id)
    ),
    createActionButton(
      'table-action-image',
      'حذف الصورة',
      item.image_path ? 'حذف صورة الصنف' : 'لا توجد صورة لهذا الصنف',
      () => handleDeleteImage(item.id),
      !item.image_path
    ),
    createActionButton(
      'table-action-delete',
      'حذف الصنف',
      'حذف الصنف',
      () => openDeleteModal(item.id)
    )
  );

  actionsCell.appendChild(actions);

  row.append(
    imageCell,
    nameCell,
    createPriceCell(item),
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
  nameInput.value = item.name;
  nameInput.required = true;

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
      nameInput,
      priceInput,
      imageInput,
      message,
      saveButton
    );
  });

  cell.appendChild(form);
  editRow.appendChild(cell);

  return editRow;
}

function updateSortHeaders() {
  const headers = {
    name: document.querySelector('#admin-sort-name'),
    price: document.querySelector('#admin-sort-price'),
    updated_at: document.querySelector('#admin-sort-updated-at')
  };

  Object.entries(headers).forEach(([key, header]) => {
    if (!header) {
      return;
    }

    const active = key === adminSortKey;
    const icon = header.querySelector('.sort-icon');

    header.setAttribute(
      'aria-sort',
      active
        ? (adminSortDirection === 'asc' ? 'ascending' : 'descending')
        : 'none'
    );

    if (icon) {
      icon.textContent = active
        ? (adminSortDirection === 'asc' ? '▲' : '▼')
        : '↕';
    }
  });
}

function renderAdminItems(editItemId = null) {
  const elements = getAdminElements();

  if (!elements.tableBody || !elements.count || !elements.empty) {
    return;
  }

  const searchValue = elements.searchInput?.value || '';
  const sortedItems = [...adminItems].sort(compareAdminItems);

  elements.tableBody.replaceChildren();

  sortedItems.forEach((item) => {
    elements.tableBody.appendChild(createAdminRow(item, searchValue));

    if (item.id === editItemId) {
      elements.tableBody.appendChild(createEditRow(item));
    }
  });

  elements.count.textContent = `عدد النتائج: ${sortedItems.length}`;
  elements.empty.hidden = sortedItems.length !== 0;

  updateSortHeaders();
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
    document.querySelector(`#edit-name-${CSS.escape(itemId)}`)?.focus();
  }, 0);
}

function hideAdminLoading() {
  const elements = getAdminElements();

  elements.loading?.setAttribute('hidden', '');
  elements.content?.removeAttribute('hidden');
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
    console.error('Initial admin loading error:', error);

    setMessage(
      elements.listMessage,
      'تعذر تحميل الأصناف حالياً. تأكد من الإنترنت ثم حدّث الصفحة.',
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
  } catch (error) {
    console.error('Admin search error:', error);

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

  clearTimeout(adminSearchTimer);

  adminSearchTimer = window.setTimeout(() => {
    if (searchValue) {
      searchAdminItems(searchValue);
    } else {
      loadInitialAdminItems();
    }
  }, 250);
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

function clearAddImagePreview() {
  const elements = getAdminElements();

  if (elements.addPreviewImage?.dataset?.objectUrl) {
    URL.revokeObjectURL(elements.addPreviewImage.dataset.objectUrl);
    delete elements.addPreviewImage.dataset.objectUrl;
  }

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
    console.error('Add item error:', error);

    if (uploadedImagePath) {
      try {
        await deleteItemImage(uploadedImagePath);
      } catch (cleanupError) {
        console.error('Unused image cleanup error:', cleanupError);
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
  nameInput,
  priceInput,
  imageInput,
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

  if (!validation.valid) {
    setMessage(messageElement, validation.message, 'error');
    return;
  }

  const file = imageInput.files?.[0] || null;
  const imageValidation = validateImageFile(file);

  if (!imageValidation.valid) {
    setMessage(messageElement, imageValidation.message, 'error');
    return;
  }

  setButtonLoading(saveButton, true, 'جارٍ حفظ التعديل...');

  let newImagePath = null;

  try {
    if (file) {
      newImagePath = await uploadItemImage(file);
    }

    const updateData = {
      name: validation.name,
      price: validation.price,
      updated_by: adminProfile.id
    };

    if (newImagePath) {
      updateData.image_path = newImagePath;
    }

    const { data, error } = await supabaseClient
      .from('items')
      .update(updateData)
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
        console.error('Old image cleanup error:', cleanupError);
      }
    }

    renderAdminItems();

    setMessage(
      getAdminElements().listMessage,
      'تم حفظ التعديل بنجاح.',
      'success'
    );
  } catch (error) {
    console.error('Edit item error:', error);

    if (newImagePath) {
      try {
        await deleteItemImage(newImagePath);
      } catch (cleanupError) {
        console.error('New image cleanup error:', cleanupError);
      }
    }

    setMessage(
      messageElement,
      'تعذر حفظ التعديل. حاول مرة أخرى.',
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
        console.error('Image deletion error:', imageError);

        setMessage(
          elements.listMessage,
          'تم حذف الصنف، لكن تعذر حذف ملف الصورة القديم من Storage.',
          'warning'
        );
      }
    }
  } catch (error) {
    console.error('Delete item error:', error);

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
      console.error('Storage image deletion error:', storageError);

      setMessage(
        elements.listMessage,
        'تمت إزالة الصورة من الصنف، لكن تعذر حذف ملفها القديم من Storage.',
        'warning'
      );
    }
  } catch (error) {
    console.error('Delete image error:', error);

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

  sortButtons.forEach((button) => {
    button.addEventListener('click', () => {
      changeAdminSort(button.dataset.sortKey);
    });
  });

  elements.cancelDeleteButton?.addEventListener('click', closeDeleteModal);
  elements.confirmDeleteButton?.addEventListener('click', handleConfirmDeleteItem);

  elements.deleteBackdrop?.addEventListener('click', (event) => {
    if (event.target === elements.deleteBackdrop) {
      closeDeleteModal();
    }
  });

  elements.logoutButton?.addEventListener('click', async () => {
    elements.logoutButton.disabled = true;

    try {
      await signOutCurrentUser();
    } catch (error) {
      console.error('Sign out error:', error);
      elements.logoutButton.disabled = false;
      window.alert('تعذر تسجيل الخروج حالياً. حاول مرة أخرى.');
    }
  });
}

async function initializeAdminPage() {
  const elements = getAdminElements();

  bindAdminEvents();

  window.setTimeout(hideAdminLoading, 1000);

  adminProfile = await requireAdmin();

  if (!adminProfile) {
    return;
  }

  if (elements.email) {
    elements.email.textContent = adminProfile.email || 'مدير النظام';
  }

  await loadInitialAdminItems();
}

document.addEventListener('DOMContentLoaded', initializeAdminPage);
