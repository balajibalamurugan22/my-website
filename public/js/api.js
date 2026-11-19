/**
 * LIFEGENIE - API Client Bridge
 * Handles secure communication with the backend server.
 */

// Helper with abort timeout to ensure UI never freezes on loading
async function fetchWithTimeout(resource, options = {}, timeout = 40000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out. Gemini API is taking longer than usual. Please try again.');
    }
    throw error;
  }
}

const API = {
  getApiKey() {
    return localStorage.getItem('lifegenie_gemini_key') || '';
  },

  setApiKey(key) {
    if (key) {
      localStorage.setItem('lifegenie_gemini_key', key.trim());
    } else {
      localStorage.removeItem('lifegenie_gemini_key');
    }
  },

  getActiveModel() {
    const dockModel = document.getElementById('dock-model-select');
    if (dockModel && dockModel.value) return dockModel.value;
    const stored = localStorage.getItem('lifegenie_model');
    if (stored && (stored === 'gemini-3.1-flash-lite' || stored === 'gemini-3-flash-preview')) return stored;
    return 'gemini-3.1-flash-lite';
  },

  getHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const customKey = this.getApiKey();
    if (customKey) {
      headers['x-gemini-api-key'] = customKey;
    }
    if (window.LIFEGENIE_AUTH && window.LIFEGENIE_AUTH.getToken()) {
      headers['Authorization'] = `Bearer ${window.LIFEGENIE_AUTH.getToken()}`;
    }
    return headers;
  },

  async getStatus() {
    try {
      const res = await fetchWithTimeout('/api/status', {
        headers: this.getHeaders()
      }, 5000);
      return await res.json();
    } catch (err) {
      console.error('Failed to get status:', err);
      return { configured: false, error: err.message };
    }
  },

  async validateKey(apiKey, saveToEnv = false) {
    const res = await fetchWithTimeout('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, saveToEnv })
    }, 15000);
    return await res.json();
  },

  async chat(messages, options = {}) {
    const model = options.model || this.getActiveModel();
    const res = await fetchWithTimeout('/api/chat', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        messages,
        model,
        temperature: options.temperature ?? 0.4,
        systemInstruction: options.systemInstruction || localStorage.getItem('lifegenie_system_prompt') || ''
      })
    }, 30000);

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Chat request failed (${res.status})`);
    }
    return data;
  },

  async study(payload) {
    const model = this.getActiveModel();
    const res = await fetchWithTimeout('/api/study', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...payload,
        model
      })
    }, 30000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Study Genie request failed (${res.status})`);
    }
    return data;
  },

  async ideas(payload) {
    const model = this.getActiveModel();
    const res = await fetchWithTimeout('/api/ideas', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...payload,
        model
      })
    }, 30000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Idea Generator request failed (${res.status})`);
    }
    return data;
  },

  async write(payload) {
    const model = this.getActiveModel();
    const res = await fetchWithTimeout('/api/write', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...payload,
        model
      })
    }, 30000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Writing Assistant request failed (${res.status})`);
    }
    return data;
  },

  async breakdownGoal(payload) {
    const model = this.getActiveModel();
    const res = await fetchWithTimeout('/api/goals/breakdown', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        ...payload,
        model
      })
    }, 30000);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Goal breakdown request failed (${res.status})`);
    }
    return data;
  }
};

window.API = API;

