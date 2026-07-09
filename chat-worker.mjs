const ALLOWED_ORIGINS = ['https://chat.yyc2.cc.cd', 'https://chat1.yyc2.dpdns.org']

const jsonHeadersBase = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
}

// Full chat page (Chinese) with client-side logic that uses the Worker APIs and credentials: 'include'
const chatPage = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LetsChat</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(135deg, #eff6ff, #f8fafc); }
      main { width: min(100% - 2rem, 64rem); margin: 0 auto; padding: 2rem 0; }
      h1 { margin: 0 0 1rem; text-align: center; }
      .layout { display: grid; grid-template-columns: minmax(0, 1fr) 16rem; gap: 1rem; align-items: start; }
      .panel, .login-card { border: 1px solid #cbd5e1; border-radius: 1rem; background: rgba(255, 255, 255, 0.92); box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12); overflow: hidden; }
      .login-card { max-width: 28rem; margin: 0 auto; padding: 1.25rem; }
      .login-card h2, .sidebar h2 { margin: 0 0 0.75rem; }
      .field { display: grid; gap: 0.35rem; margin-bottom: 0.75rem; }
      label { font-weight: 700; }
      #messages { height: 30rem; overflow-y: auto; padding: 1rem; }
      .message { padding: 0.75rem; margin-bottom: 0.75rem; border-radius: 0.75rem; background: #f1f5f9; overflow-wrap: anywhere; }
      .message strong { color: #1d4ed8; }
      .message time { display: block; margin-top: 0.25rem; color: #64748b; font-size: 0.8rem; }
      .empty, .error, .hint { padding: 1rem; color: #64748b; }
      .error { color: #b91c1c; background: #fee2e2; }
      .topbar { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 0.85rem 1rem; border-bottom: 1px solid #e2e8f0; background: #fff; }
      .topbar strong { color: #1d4ed8; }
      form.chat-form { display: flex; gap: 0.5rem; padding: 1rem; border-top: 1px solid #e2e8f0; background: #ffffff; }
      input { width: 100%; min-width: 0; border: 1px solid #cbd5e1; border-radius: 0.75rem; padding: 0.75rem; font: inherit; }
      button { border: 0; border-radius: 0.75rem; padding: 0.75rem 1rem; background: #2563eb; color: #ffffff; font: inherit; font-weight: 700; cursor: pointer; }
      button.secondary { background: #64748b; }
      button:disabled { cursor: not-allowed; opacity: 0.65; }
      .sidebar { padding: 1rem; }
      #online-users { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.5rem; }
      #online-users li { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.65rem; border-radius: 999px; background: #ecfeff; color: #155e75; font-weight: 700; }
      .dot { width: 0.65rem; height: 0.65rem; border-radius: 999px; background: #22c55e; box-shadow: 0 0 0 3px #dcfce7; }
      [hidden] { display: none !important; }
      @media (max-width: 760px) { .layout { grid-template-columns: 1fr; } form.chat-form { flex-direction: column; } }
      /* animations */
      @keyframes slideUpFade { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      .message { transform-origin: left top; animation: slideUpFade 220ms cubic-bezier(.2,.8,.2,1) both }
    </style>
  </head>
  <body>
    <main>
      <h1>LetsChat</h1>
      <section id="login" class="login-card" aria-label="Account login">
        <h2>账号登录 / 注册</h2>
        <p class="hint">输入用户名和密码，支持注册新账户。</p>
        <form id="auth-form">
          <div class="field"><label for="username">用户名</label><input id="username" name="username" maxlength="50" autocomplete="username" placeholder="例如：张三" required /></div>
          <div class="field"><label for="password">密码</label><input id="password" name="password" type="password" maxlength="200" autocomplete="current-password" placeholder="密码（至少8位）" required /></div>
          <div style="display:flex;gap:.5rem"><button id="login-btn" type="button">登录</button><button id="register-btn" type="button" class="secondary">注册</button></div>
          <p id="auth-error" class="error" hidden></p>
        </form>
      </section>
      <section id="room" class="layout" hidden>
        <section class="panel" aria-label="Chat room">
          <div class="topbar"><span>当前用户 <strong id="current-user"></strong></span><button id="logout" class="secondary" type="button">退出登录</button></div>
          <div id="status" class="empty">正在加载消息...</div>
          <div id="messages" hidden></div>
          <form id="form" class="chat-form">
            <input id="message" name="message" maxlength="500" autocomplete="off" placeholder="输入消息..." required />
            <button id="send" type="submit">发送</button>
          </form>
        </section>
        <aside class="panel sidebar" aria-label="Online users"><h2>在线用户</h2><ul id="online-users"><li><span class="dot"></span>加载中...</li></ul></aside>
      </section>
    </main>
    <script>
      const status = document.querySelector('#status'), messages = document.querySelector('#messages'), form = document.querySelector('#form'), input = document.querySelector('#message'), send = document.querySelector('#send'), onlineUsers = document.querySelector('#online-users')
      const loginSection = document.querySelector('#login'), room = document.querySelector('#room'), authForm = document.querySelector('#auth-form'), usernameInput = document.querySelector('#username'), passwordInput = document.querySelector('#password'), currentUser = document.querySelector('#current-user'), authError = document.querySelector('#auth-error'), logoutBtn = document.querySelector('#logout')
      let heartbeatTimer, refreshTimer

      const escapeHtml = (value) => value.replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
      const showError = (el, message) => { el.hidden = false; el.textContent = message }
      const hideError = (el) => { el.hidden = true; el.textContent = '' }

      const render = (items) => {
        if (!items || items.length === 0) { status.hidden = false; status.className = 'empty'; status.textContent = '还没有消息，快来打个招呼吧！'; messages.hidden = true; return }
        status.hidden = true; messages.hidden = false
        messages.innerHTML = items.map(m => '<div class="message"><strong>' + escapeHtml(m.user) + '</strong>: ' + escapeHtml(m.content) + (m.created_at ? '<time>' + new Date(m.created_at).toLocaleString() + '</time>' : '') + '</div>').join('')
      }
      const renderUsers = (items) => { onlineUsers.innerHTML = items.length ? items.map((item) => '<li><span class="dot"></span>' + escapeHtml(item.user) + '</li>').join('') : '<li>暂无在线用户</li>' }

      const api = async (path, options = {}) => {
        options.credentials = 'include'
        const response = await fetch(path, options)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || '请求失败')
        }
        return response.json()
      }

      const loadMessages = async () => { try { render(await api('/api/messages')) } catch (error) { showError(status, error.message) } }
      const loadUsers = async () => { try { renderUsers(await api('/api/users/online')) } catch { renderUsers([]) } }

      const heartbeat = async () => { try { await api('/api/presence', { method: 'POST' }) } catch (e) { /* ignore */ } }

      const enterRoomUI = (name) => {
        currentUser.textContent = name
        loginSection.hidden = true
        room.hidden = false
        heartbeat()
        heartbeatTimer = setInterval(heartbeat, 30 * 1000)
        refreshTimer = setInterval(() => { loadMessages(); loadUsers() }, 5000)
        loadMessages(); loadUsers()
      }

      // Try to detect existing session
      (async () => {
        try {
          const who = await api('/api/whoami')
          if (who && who.user) { enterRoomUI(who.user); return }
        } catch (e) {}
        usernameInput.focus()
      })()

      authForm.addEventListener('submit', (e) => e.preventDefault())

      document.querySelector('#login-btn').addEventListener('click', async () => {
        hideError(authError)
        const username = usernameInput.value.trim()
        const password = passwordInput.value
        if (!username || !password) { showError(authError, '用户名和密码为必填'); return }
        try {
          const resp = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ username, password }) })
          const payload = await resp.json()
          if (!resp.ok) { showError(authError, payload.error || '登录失败'); return }
          enterRoomUI(payload.user)
        } catch (err) { showError(authError, err.message) }
      })

      document.querySelector('#register-btn').addEventListener('click', async () => {
        hideError(authError)
        const username = usernameInput.value.trim()
        const password = passwordInput.value
        if (!username || !password) { showError(authError, '用户名和密码为必填'); return }
        try {
          const resp = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
          const payload = await resp.json()
          if (!resp.ok) { showError(authError, payload.error || '注册失败'); return }
          alert('注册成功，请登录')
        } catch (err) { showError(authError, err.message) }
      })

      logoutBtn.addEventListener('click', async () => {
        clearInterval(heartbeatTimer); clearInterval(refreshTimer)
        try { await fetch('/api/presence', { method: 'DELETE', credentials: 'include' }) } catch (e) {}
        currentUser.textContent = ''
        loginSection.hidden = false
        room.hidden = true
      })

      form.addEventListener('submit', async (event) => {
        event.preventDefault(); const content = input.value.trim(); if (!content) return; send.disabled = true
        try {
          await api('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
          input.value = ''
          await loadMessages()
        } catch (err) { alert(err.message) } finally { send.disabled = false }
      })
    </script>
  </body>
</html>`

const ONLINE_WINDOW_MS = 60 * 1000

const SESSION_COOKIE = 'letschat_session'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7
const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000
const PASSWORD_ITERATIONS = 210000
const PASSWORD_SALT_BYTES = 16
const PASSWORD_KEY_BYTES = 32
const MAX_FAILED = 5
const LOCK_DURATION_MS = 15 * 60 * 1000

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes))

const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))

const timingSafeEqual = (left, right) => {
  if (left.byteLength !== right.byteLength) return false
  let diff = 0
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index]
  }
  return diff === 0
}

const derivePasswordKey = async (password, salt, iterations = PASSWORD_ITERATIONS) => {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    PASSWORD_KEY_BYTES * 8,
  )
  return new Uint8Array(bits)
}

const hashPassword = async (password) => {
  const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES))
  const key = await derivePasswordKey(password, salt)
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(key)}`
}

const verifyPassword = async (password, storedHash) => {
  if (typeof storedHash !== 'string') return false
  const [algorithm, iterationsRaw, saltRaw, keyRaw] = storedHash.split('$')
  const iterations = Number(iterationsRaw)
  if (algorithm !== 'pbkdf2-sha256' || !Number.isSafeInteger(iterations) || iterations <= 0 || !saltRaw || !keyRaw) {
    return false
  }

  try {
    const expected = base64ToBytes(keyRaw)
    const actual = await derivePasswordKey(password, base64ToBytes(saltRaw), iterations)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

const generateSessionToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const getCookie = (request, name) => {
  const cookie = request.headers.get('cookie') || ''
  const prefix = `${name}=`
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || null
}

const getSession = async (request, env) => {
  const token = getCookie(request, SESSION_COOKIE)
  if (!token) return null

  const { results } = await env.DB.prepare('SELECT user, expires_at FROM sessions WHERE session_token = ? LIMIT 1').bind(token).all()
  const session = results && results[0]
  if (!session) return null

  if (session.expires_at <= Date.now()) {
    await env.DB.prepare('DELETE FROM online_users WHERE session_token = ?').bind(token).run()
    await env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(token).run()
    return null
  }

  return { token, user: session.user, expires_at: session.expires_at }
}


const normalizeUser = (value) => (typeof value === 'string' ? value.trim() : '')

const readJsonBody = async (request) => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeadersBase,
  })

const validateDatabase = (env) => {
  if (!env.DB) {
    return json({ error: 'D1 database binding "DB" is not configured.' }, 500)
  }
  return null
}

const getMessages = async (env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const { results } = await env.DB.prepare(
    'SELECT id, user, content, created_at FROM messages ORDER BY created_at DESC LIMIT 50',
  ).all()

  return json(results)
}

const createMessage = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const body = await readJsonBody(request)
  if (!body) return json({ error: 'Request body must be valid JSON.' }, 400)

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) {
    return json({ error: 'Content required.' }, 400)
  }

  if (content.length > 500) {
    return json({ error: 'Content too long.' }, 400)
  }

  const session = await getSession(request, env)
  if (!session) return json({ error: 'Not authenticated' }, 401)

  const createdAt = Date.now()
  const result = await env.DB.prepare('INSERT INTO messages (session_token, user, content, created_at) VALUES (?, ?, ?, ?)')
    .bind(session.token, session.user, content, createdAt)
    .run()

  return json(
    {
      id: result.meta.last_row_id,
      user: session.user,
      content,
      created_at: createdAt,
    },
    201,
  )
}

const touchPresence = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const session = await getSession(request, env)
  if (!session) return json({ error: 'Not authenticated' }, 401)

  const lastSeen = Date.now()
  await env.DB.prepare(
    'INSERT INTO online_users (session_token, user, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_token) DO UPDATE SET last_seen = excluded.last_seen, user = excluded.user',
  )
    .bind(session.token, session.user, lastSeen)
    .run()

  return json({ user: session.user, last_seen: lastSeen })
}

const removePresence = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const token = getCookie(request, SESSION_COOKIE)
  if (!token) return json({ ok: true })

  await env.DB.prepare('DELETE FROM online_users WHERE session_token = ?').bind(token).run()
  await env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(token).run()

  const headers = { ...jsonHeadersBase }
  headers['Set-Cookie'] = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}

const getOnlineUsers = async (env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const cutoff = Date.now() - ONLINE_WINDOW_MS
  await env.DB.prepare('DELETE FROM online_users WHERE last_seen < ?').bind(cutoff).run()
  const { results } = await env.DB.prepare(
    'SELECT user, last_seen FROM online_users WHERE last_seen >= ? ORDER BY user COLLATE NOCASE ASC',
  )
    .bind(cutoff)
    .all()

  return json(results)
}

// auth endpoints
const register = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const body = await readJsonBody(request)
  if (!body) return json({ error: '请求体必须为 JSON', code: 'INVALID_JSON' }, 400)
  const username = normalizeUser(body.username)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username) return json({ error: '用户名不能为空', code: 'USERNAME_REQUIRED', field: 'username' }, 400)
  if (username.length > 50) return json({ error: '用户名不能超过 50 字符', code: 'USERNAME_TOO_LONG', field: 'username' }, 400)
  if (!password || password.length < 8) return json({ error: '密码至少 8 字符', code: 'PASSWORD_TOO_SHORT', field: 'password' }, 400)

  try {
    const now = Date.now()
    const hash = await hashPassword(password)
    await env.DB.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').bind(username, hash, now).run()
    return json({ ok: true, user: username }, 201)
  } catch (err) {
    if (err && /UNIQUE|constraint/i.test(err.message)) {
      return json({ error: '用户名已存在', code: 'USERNAME_TAKEN', field: 'username' }, 409)
    }
    return json({ error: '注册失败', code: 'REGISTER_FAILED', detail: String(err && err.message) }, 500)
  }
}

const login = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const body = await readJsonBody(request)
  if (!body) return json({ error: '请求体必须为 JSON', code: 'INVALID_JSON' }, 400)
  const username = normalizeUser(body.username)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return json({ error: '用户名和密码均为必填项', code: 'CREDENTIALS_REQUIRED' }, 400)

  const { results } = await env.DB.prepare('SELECT id, username, password_hash, failed_login_attempts, locked_until FROM users WHERE username = ? LIMIT 1').bind(username).all()
  if (!results || results.length === 0) return json({ error: '用户不存在', code: 'USER_NOT_FOUND', field: 'username' }, 401)
  const userRow = results[0]
  const now = Date.now()
  if (userRow.locked_until && userRow.locked_until > now) return json({ error: '账户被暂时锁定，请稍后重试', code: 'ACCOUNT_LOCKED', retry_after_ms: userRow.locked_until - now }, 403)

  const ok = await verifyPassword(password, userRow.password_hash)
  if (!ok) {
    const attempts = (userRow.failed_login_attempts || 0) + 1
    const lockedUntil = attempts >= MAX_FAILED ? now + LOCK_DURATION_MS : null
    await env.DB.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').bind(attempts, lockedUntil, userRow.id).run()
    return json({ error: '密码错误', code: 'INVALID_PASSWORD', attempts, locked_until: lockedUntil }, 401)
  }

  await env.DB.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').bind(userRow.id).run()
  const token = generateSessionToken()
  const expiresAt = Date.now() + SESSION_TTL_MS
  await env.DB.prepare('INSERT INTO sessions (session_token, user, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(token, userRow.username, Date.now(), expiresAt).run()
  await env.DB.prepare('INSERT INTO online_users (session_token, user, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_token) DO UPDATE SET last_seen = excluded.last_seen, user = excluded.user').bind(token, userRow.username, Date.now()).run()

  const headers = { ...jsonHeadersBase }
  headers['Access-Control-Allow-Origin'] = 'https://chat.yyc2.cc.cd'
  headers['Access-Control-Allow-Credentials'] = 'true'
  headers['Set-Cookie'] = `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`
  return new Response(JSON.stringify({ ok: true, user: userRow.username }), { status: 200, headers })
}

const whoami = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ ok: false }, 200)
  return json({ ok: true, user: session.user }, 200)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      const headers = { ...jsonHeadersBase }
      const origin = request.headers.get('Origin')
      if (origin && !ALLOWED_ORIGINS.includes(origin)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers })
      headers['Access-Control-Allow-Origin'] = origin || ALLOWED_ORIGINS[0]
      headers['Access-Control-Allow-Credentials'] = 'true'
      return new Response(null, { status: 204, headers })
    }

    if (url.pathname === '/') {
      return new Response(chatPage, { headers: pageHeaders })
    }

    if (url.pathname === '/api/messages' && request.method === 'GET') return getMessages(env)
    if (url.pathname === '/api/messages' && request.method === 'POST') return createMessage(request, env)
    if (url.pathname === '/api/presence' && request.method === 'POST') return touchPresence(request, env)
    if (url.pathname === '/api/presence' && request.method === 'DELETE') return removePresence(request, env)
    if (url.pathname === '/api/users/online' && request.method === 'GET') return getOnlineUsers(env)
    if (url.pathname === '/api/register' && request.method === 'POST') return register(request, env)
    if (url.pathname === '/api/login' && request.method === 'POST') return login(request, env)
    if (url.pathname === '/api/whoami' && request.method === 'GET') return whoami(request, env)

    return json({ error: 'Not found' }, 404)
  },
}
