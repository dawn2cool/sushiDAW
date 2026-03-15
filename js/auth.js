/*
  auth.js — SushiDAW authentication client
  Manages the JWT token, current user state, and redirects.
*/

const Auth = (() => {
  const API = window.SUSHIDAW_API || 'http://localhost:8080';
  const TOKEN_KEY = 'sushidaw_token';
  const USER_KEY  = 'sushidaw_user';

  let _user = null;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getUser() {
    if (_user) return _user;
    try { _user = JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { _user = null; }
    return _user;
  }

  function isLoggedIn() {
    return !!getToken() && !!getUser();
  }

  function saveSession(data) {
    _user = { userId: data.userId, username: data.username, producerTag: data.producerTag };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(_user));
  }

  function logout() {
    _user = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = 'login.html';
  }

  // Authenticated fetch wrapper
  async function apiFetch(path, opts = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, { ...opts, headers });
    if (res.status === 401) { logout(); return null; }
    return res;
  }

  async function register(username, password) {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    saveSession(data);
    return data;
  }

  async function login(username, password) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    saveSession(data);
    return data;
  }

  async function updateProducerTag(tag) {
    const res = await apiFetch('/api/auth/tag', {
      method: 'PUT',
      body: JSON.stringify({ producerTag: tag })
    });
    if (!res || !res.ok) throw new Error('Failed to update tag');
    _user.producerTag = tag;
    localStorage.setItem(USER_KEY, JSON.stringify(_user));
    return tag;
  }

  // Guard: call on index.html load — redirects to login if not authed
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  return { getToken, getUser, isLoggedIn, logout, login, register, updateProducerTag, requireAuth, apiFetch };
})();