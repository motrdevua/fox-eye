// 1. Показ повідомлень (Toast)
export function showCopyToast(text) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.innerText = text;
  toast.className = 'toast-notification modal-success';
  toast.style.display = 'block';

  // Плавне зникнення через 2 секунди
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
      toast.style.opacity = '1';
    }, 300);
  }, 2000);
}

// 2. Модальне вікно Alert
export function customAlert(text) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-alert');
    const content = modal.querySelector('.modal-content');
    document.getElementById('modal-alert-text').innerText = text;
    content.classList.add('modal-error');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    const btn = document.getElementById('modal-alert-ok');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.onclick = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        content.classList.remove('modal-error');
        resolve();
      }, 100);
    };
  });
}

// 3. Модальне вікно Prompt (Потрібне для сканера висот)
export function customPrompt(text, defaultValue) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-prompt');
    const input = document.getElementById('modal-prompt-input');
    const content = modal.querySelector('.modal-content');

    content.classList.add('modal-success');
    document.getElementById('modal-prompt-text').innerText = text;
    input.value = defaultValue;

    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
      input.focus();
    }, 10);

    const closePrompt = (result) => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        resolve(result);
      }, 100);
    };

    const okBtn = document.getElementById('modal-prompt-ok');
    const cancelBtn = document.getElementById('modal-prompt-cancel');
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);

    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.onclick = () => closePrompt(input.value);
    newCancel.onclick = () => closePrompt(null);

    input.onkeydown = (e) => {
      if (e.key === 'Enter') closePrompt(input.value);
      if (e.key === 'Escape') closePrompt(null);
    };
  });
}

// 4. Маска введення для MGRS (форматує текст як 36U VV 12345 67890)
export function handleMgrsMask(e) {
  if (e.inputType === 'deleteContentBackward') return;
  const input = e.target;
  let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Додаємо пробіли після 3-го та 6-го символів
  if (val.length > 3) val = val.substring(0, 3) + ' ' + val.substring(3);
  if (val.length > 6) val = val.substring(0, 6) + ' ' + val.substring(6);

  input.value = val;
}

// 5. Оновлення плейсхолдера при перемиканні радіо-кнопок
export function updatePlaceholder() {
  const input = document.getElementById('search-input');
  const typeEl = document.querySelector('input[name="search-type"]:checked');
  if (!input || !typeEl) return;

  const isCity = typeEl.value === 'city';
  input.value = '';
  input.placeholder = isCity ? 'ВВЕДІТЬ НАЗВУ' : '36U VV 12345 67890';

  // Якщо вибрано MGRS, вішаємо маску, якщо ні - знімаємо
  input.oninput = isCity ? null : handleMgrsMask;
}
