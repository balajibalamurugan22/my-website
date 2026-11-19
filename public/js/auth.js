/**
 * LIFEGENIE - Client Authentication Service
 * Manages user sessions, tokens, and navigation guard.
 */

const LIFEGENIE_AUTH = {
  TOKEN_KEY: 'lifegenie_token',
  USER_KEY: 'lifegenie_user',

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY) || null;
  },

  getUser() {
    try {
      const raw = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  setSession(user, token, remember = true) {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(this.TOKEN_KEY, token);
    storage.setItem(this.USER_KEY, JSON.stringify(user));

    // Clear the other storage to prevent desync
    if (remember) {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_KEY);
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
  },

  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
  },

  isAuthenticated() {
    return Boolean(this.getToken() && this.getUser());
  },

  getStorageKey(baseKey) {
    const user = this.getUser();
    if (user && (user.id || user.email)) {
      const cleanId = (user.id || user.email).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      return `${baseKey}_${cleanId}`;
    }
    return baseKey;
  },

  async login(email, password, remember = true) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Login failed.');
    }
    this.setSession(data.user, data.token, remember);
    return data;
  },

  async register(name, email, password) {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Registration failed.');
    }
    this.setSession(data.user, data.token, true);
    return data;
  },

  async guestLogin() {
    const response = await fetch('/api/auth/guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Guest sign-in failed.');
    }
    this.setSession(data.user, data.token, false);
    return data;
  },

  async logout() {
    const token = this.getToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (e) {
        console.warn('Logout API error:', e);
      }
    }
    this.clearSession();
    window.location.href = 'login.html';
  },

  async verifyServerSession() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated && data.user) {
          // Sync stored user with server state
          const remember = Boolean(localStorage.getItem(this.TOKEN_KEY));
          this.setSession(data.user, token, remember);
          return true;
        }
      }
    } catch (e) {
      console.warn('Session verification error:', e);
    }
    // If invalid token, clear
    this.clearSession();
    return false;
  },

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  requireGuest() {
    if (this.isAuthenticated()) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }
};

window.LIFEGENIE_AUTH = LIFEGENIE_AUTH;

