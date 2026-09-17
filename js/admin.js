'use strict';

let adminItems = [];
let adminProfile = null;
let itemPendingDeletion = null;

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

function parseRequiredPrice(value) {
  const result = parseOptionalPrice(value);

  if (!result.valid) {
    return result;
  }

  if (result.price === null) {
    return {
      valid: false,
      message: 'يرجى إدخال سعر صحيح.'
    };
  }

  return result;
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

function revokePreviewUrl(imageElement) {
  if (imageElement?.dataset?.objectUrl) {
    URL.revokeObjectURL(imageElement.dataset.objectUrl);
    delete imageElement.dataset.objectUrl;
  }
}

function clearAddImagePreview() {
  const elements = getAdminElements();

  revokePreviewUrl(elements.addPreviewImage);

  if (elements.addPreviewImage) {
    elements.addPreviewImage.removeAttribute('src');
  }

  if (elements.addPreviewText) {
    elements.addPreviewText.textContent = '';
  }

  if (elements.addPreviewWrap) {
    elements.addPreviewWrap.classList.remove('is-visible');
  }
}

function showAddImagePreview(file) {
  const elements = getAdminElements();

  clearAddImagePreview();

  if (!file) {
    return;
  }

  const imageUrl = URL.createObjectURL(file);

  if (elements.addPreviewImage) {
    elements.addPreviewImage.src = imageUrl;
    elements.addPreviewImage.dataset.objectUrl = imageUrl;
  }

  if (elements.addPreviewText) {
    elements.addPreviewText.textContent = `${file.name} — ${(file.size / 1024 / 1024).toFixed(2)} MB`;
  }

  if (elements.addPreviewWrap) {
    elements.addPreviewWrap.classList.add('is-visible');
  }
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

function createAdminRow(item) {
  const row = document.createElement('tr');

  const imageCell = document.createElement('td');
  imageCell.className = 'cell-image';
  imageCell.appendChild(createItemImageElement(item));

  const nameCell = document.createElement('td');
  const nameText = document.createElement('span');
  nameText.className = 'item-name';
  nameText.textContent = item.name;
  nameCell.appendChild(nameText);

  const priceCell = createAdminPriceCell(item);

  const dateCell = document.createElement('td');
  dateCell.className = 'cell-date';
  dateCell.textContent = formatDate(item.created_at);

  const actionsCell = document.createElement('td');
  actionsCell.className = 'cell-actions';

  const actions = document.createElement('div');
  actions.className = 'actions-row';

  if (item.price === null || item.price === undefined) {
    const setPriceButton = document.createElement('button');
    setPriceButton.className = 'table-action table-action-price';
    setPriceButton.type = 'button';
    setPriceButton.textContent = 'وضع سعر';
    setPriceButton.addEventListener('click', () => openSetPriceRow(item.id));
    actions.appendChild(setPriceButton);
  }

  const editButton = document.createElement('button');
  editButton.className = 'table-action table-action-edit';
  editButton.type = 'button';
  editButton.textContent = 'تعديل';
  editButton.addEventListener('click', () => openEditRow(item.id));

  const deleteImageButton = document.createElement('button');
  deleteImageButton.className = 'table-action table-action-image';
  deleteImageButton.type = 'button';
  deleteImageButton.textContent = 'حذف الصورة';
  deleteImageButton.disabled = !item.image_path;
  deleteImageButton.title = item.image_path
    ? 'حذف صورة الصنف فقط'
    : 'لا توجد صورة لهذا الصنف';
  deleteImageButton.addEventListener('click', () => handleDeleteImage(item.id));

  const deleteButton = document.createElement('button');
  deleteButton.className = 'table-action table-action-delete';
  deleteButton.type = 'button';
  deleteButton.textContent = 'حذف';
  deleteButton.addEventListener('click', () => openDeleteModal(item.id));

  actions.append(editButton, deleteImageButton, deleteButton);
  actionsCell.appendChild(actions);

  row.append(imageCell, nameCell, priceCell, dateCell, actionsCell);

  return row;
}

function createSetPriceRow(item) {
  const setPriceRow = document.createElement('tr');
  setPriceRow.className = 'edit-row';

  const cell = document.createElement('td');
  cell.colSpan = 5;

  const form = document.createElement('form');
  form.className = 'set-price-form';
  form.noValidate = true;

  const title = document.createElement('strong');
  title.className = 'set-price-title';
  title.textContent = `وضع سعر للصنف: ${item.name}`;

  const priceInput = document.createElement('input');
  priceInput.className = 'set-price-input';
  priceInput.type = 'number';
  priceInput.min = '0';
  priceInput.max = '9999999999.99';
  priceInput.step = '0.01';
  priceInput.inputMode = 'decimal';
  priceInput.placeholder = 'مثال: 1.50';
  priceInput.required = true;
  priceInput.setAttribute('aria-label', `سعر الصنف ${item.name}`);

  const saveButton = document.createElement('button');
  saveButton.className = 'button button-primary';
  saveButton.type = 'submit';
  saveButton.textContent = 'حفظ السعر';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'button button-secondary';
  cancelButton.type = 'button';
  cancelButton.textContent = 'إلغاء';
  cancelButton.addEventListener('click', renderAdminItems);

  const message = document.createElement('p');
  message.className = 'form-message';
  message.setAttribute('role', 'alert');
  message.setAttribute('aria-live', 'polite');

  form.append(title, priceInput, saveButton, cancelButton, message);

  form.addEventListener('submit', (event) => {
    handleSetPriceSubmit(event, item.id, priceInput, message, saveButton);
  });

  cell.appendChild(form);
  setPriceRow.appendChild(cell);

  return setPriceRow;
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
  cancelButton.addEventListener('click', renderAdminItems);

  actions.append(saveButton, cancelButton);

  form.append(nameGroup, priceGroup, imageGroup, message, actions);
  form.addEventListener('submit', (event) => {
    handleEditItemSubmit(event, item.id, imageInput, nameInput, priceInput, message, saveButton);
  });

  cell.appendChild(form);
  editRow.appendChild(cell);

  return editRow;
}

function renderAdminItems(openRow = null) {
  const elements = getAdminElements();

  if (!elements.searchInput || !elements.tableBody || !elements.count || !elements.empty) {
    return;
  }

  const matchingItems = filterItemsBySearch(adminItems, elements.searchInput.value);

  elements.tableBody.replaceChildren();

  matchingItems.forEach((item) => {
    elements.tableBody.appendChild(createAdminRow(item));

    if (openRow?.type === 'price' && item.id === openRow.itemId) {
      elements.tableBody.appendChild(createSetPriceRow(item));
    }

    if (openRow?.type === 'edit' && item.id === openRow.itemId) {
      elements.tableBody.appendChild(createEditRow(item));
    }
  });

  elements.count.textContent = `عدد الأصناف: ${matchingItems.length}`;
  elements.empty.hidden = matchingItems.length !== 0;
}

function openSetPriceRow(itemId) {
  renderAdminItems({ type: 'price', itemId });

  window.setTimeout(() => {
    const input = document.querySelector('.set-price-input');
    input?.focus();
  }, 0);
}

function openEditRow(itemId) {
  renderAdminItems({ type: 'edit', itemId });

  window.setTimeout(() => {
    const editInput = document.querySelector(`#edit-name-${CSS.escape(itemId)}`);
    editInput?.focus();
  }, 0);
}

async function loadAdminItems() {
  const elements = getAdminElements();
  setMessage(elements.listMessage);

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .select('id, name, price, image_path, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) {
      throw error;
    }

    adminItems = Array.isArray(data) ? data : [];
    renderAdminItems();
  } catch (error) {
    console.error('Failed to load admin items:', error);
    setMessage(
      elements.listMessage,
      'تعذر تحميل الأصناف حالياً. حدّث الصفحة وحاول مرة أخرى.',
      'error'
    );
  } finally {
    if (elements.loading) {
      elements.loading.hidden = true;
    }

    if (elements.content) {
      elements.content.hidden = false;
    }
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

    adminItems.push(data);
    adminItems.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name, 'ar'));

    elements.addForm.reset();
    clearAddImagePreview();

    if (validation.price === null) {
      setMessage(
        elements.addMessage,
        'تمت إضافة الصنف بدون سعر. سيظهر في لوحة الإدارة فقط إلى أن تضع له سعراً.',
        'success'
      );
    } else {
      setMessage(elements.addMessage, 'تمت إضافة الصنف بنجاح.', 'success');
    }

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

async function handleSetPriceSubmit(event, itemId, priceInput, messageElement, saveButton) {
  event.preventDefault();

  const itemIndex = adminItems.findIndex((item) => item.id === itemId);

  if (itemIndex === -1) {
    setMessage(messageElement, 'لم يتم العثور على الصنف. حدّث الصفحة.', 'error');
    return;
  }

  const priceResult = parseRequiredPrice(priceInput.value);

  if (!priceResult.valid) {
    setMessage(messageElement, priceResult.message, 'error');
    return;
  }

  setMessage(messageElement);
  setButtonLoading(saveButton, true, 'جارٍ حفظ السعر...');

  try {
    const { data, error } = await supabaseClient
      .from('items')
      .update({
        price: priceResult.price,
        updated_by: adminProfile.id
      })
      .eq('id', itemId)
      .select('id, name, price, image_path, created_at, updated_at')
      .single();

    if (error) {
      throw error;
    }

    adminItems[itemIndex] = data;
    adminItems.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name, 'ar'));
    renderAdminItems();
    setMessage(
      getAdminElements().listMessage,
      'تم حفظ السعر. سيظهر الصنف في صفحة الأسعار بعد تحديثها.',
      'success'
    );
  } catch (error) {
    console.error('Failed to set price:', error);
    setMessage(messageElement, 'تعذر حفظ السعر. حاول مرة أخرى.', 'error');
  } finally {
    setButtonLoading(saveButton, false);
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
    setMessage(messageElement, 'لم يتم العثور على الصنف. حدّث الصفحة.', 'error');
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
    adminItems.sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name, 'ar'));

    if (newImagePath && previousItem.image_path) {
      try {
        await deleteItemImage(previousItem.image_path);
      } catch (cleanupError) {
        console.error('Failed to remove old image:', cleanupError);
      }
    }

    renderAdminItems();

    if (data.price === null) {
      setMessage(
        getAdminElements().listMessage,
        'تم حفظ التعديل. الصنف غير مسعّر ولن يظهر في صفحة الأسعار حتى تضع له سعراً.',
        'success'
      );
    } else {
      setMessage(getAdminElements().listMessage, 'تم حفظ التعديل بنجاح.', 'success');
    }
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

  const confirmed = window.confirm(`هل أنت متأكد من حذف صورة الصنف: ${item.name}؟`);

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
      console.error('Database image reference removed but storage cleanup failed:', storageError);
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

  elements.searchInput?.addEventListener('input', () => renderAdminItems());

  elements.cancelDeleteButton?.addEventListener('click', closeDeleteModal);
  elements.confirmDeleteButton?.addEventListener('click', handleConfirmDeleteItem);

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
  adminProfile = await requireAdmin();

  if (!adminProfile) {
    return;
  }

  const elements = getAdminElements();

  if (elements.email) {
    elements.email.textContent = adminProfile.email || 'مدير النظام';
  }

  bindAdminEvents();
  await loadAdminItems();
}

document.addEventListener('DOMContentLoaded', initializeAdminPage);
