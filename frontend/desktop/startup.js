const form = document.getElementById('setup');
const loading = document.getElementById('loading');
const heading = document.getElementById('title');
const error = document.getElementById('error');
window.electronAPI.setupState().then(state => {
  form.hidden = !state.needsSetup;
  loading.hidden = state.needsSetup;
  if (state.needsSetup) heading.textContent = 'Welcome to your store';
}).catch(() => { heading.textContent = 'Please reopen Aurora POS'; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  const password = document.getElementById('password').value;
  if (password !== document.getElementById('confirm').value) {
    error.textContent = 'The passwords do not match.';
    return;
  }
  const button = document.getElementById('submit');
  button.disabled = true;
  try {
    await window.electronAPI.setupStore(password);
    document.getElementById('password').value = '';
    document.getElementById('confirm').value = '';
    form.hidden = true;
    loading.hidden = false;
    heading.textContent = 'Preparing your store';
  } catch (failure) { error.textContent = failure.message; button.disabled = false; }
});
