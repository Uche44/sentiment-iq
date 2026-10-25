(function () {
  const form = document.getElementById('login-form');
  if (!form) return;

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const submitButton = document.getElementById('login-button');
  const formError = document.getElementById('form-error');
  const toggleButton = document.getElementById('toggle-password');
  const buttonMarkup = submitButton.innerHTML;

  function setFieldError(name, message) {
    const errorEl = document.getElementById(name + '-error');
    const input = document.getElementById(name);
    const field = input ? input.closest('.field') : null;

    if (errorEl) errorEl.textContent = message || '';
    if (field) field.classList.toggle('has-error', Boolean(message));
  }

  function validate() {
    let valid = true;

    if (!usernameInput.value.trim()) {
      setFieldError('username', 'Username is required');
      valid = false;
    } else {
      setFieldError('username', '');
    }

    if (!passwordInput.value) {
      setFieldError('password', 'Password is required');
      valid = false;
    } else {
      setFieldError('password', '');
    }

    return valid;
  }

  usernameInput.addEventListener('input', function () {
    setFieldError('username', '');
  });
  passwordInput.addEventListener('input', function () {
    setFieldError('password', '');
  });

  if (toggleButton) {
    toggleButton.addEventListener('click', function () {
      const showing = passwordInput.type === 'text';
      passwordInput.type = showing ? 'password' : 'text';
      toggleButton.textContent = showing ? 'Show' : 'Hide';
      toggleButton.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    formError.textContent = '';

    if (!validate()) return;

    submitButton.disabled = true;
    submitButton.textContent = 'Signing in…';

    try {
      await window.API.post('/api/auth/login', {
        username: usernameInput.value.trim(),
        password: passwordInput.value,
      });
      window.location.assign('/dashboard');
    } catch (error) {
      const message =
        error.status === 0
          ? error.message
          : (error.body && error.body.error) || 'Unable to sign in right now';
      formError.textContent = message;
      submitButton.disabled = false;
      submitButton.innerHTML = buttonMarkup;
    }
  });
})();
