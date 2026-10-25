(function () {
  async function request(path, options) {
    const settings = Object.assign({ credentials: 'same-origin' }, options || {});
    settings.headers = Object.assign({ Accept: 'application/json' }, settings.headers || {});
    if (settings.body && !settings.headers['Content-Type']) {
      settings.headers['Content-Type'] = 'application/json';
    }

    let response;
    try {
      response = await fetch(path, settings);
    } catch (networkError) {
      const error = new Error('Network error — please check your connection');
      error.status = 0;
      throw error;
    }

    let body = null;
    try {
      body = await response.json();
    } catch (parseError) {
      // Non-JSON response: body stays null.
    }

    if (!response.ok) {
      const error = new Error((body && body.error) || `Request failed (${response.status})`);
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  window.API = {
    request,
    get: function (path) {
      return request(path);
    },
    post: function (path, data) {
      return request(path, { method: 'POST', body: JSON.stringify(data || {}) });
    },
  };
})();
