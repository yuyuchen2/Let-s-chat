const jsonHeadersBase = {
  'Content-Type': 'application/json; charset=utf-8',
  // 注意：当使用 Cookie 进行身份验证时，Access-Control-Allow-Origin 不能是 '*'.
  // 我们在运行时回显 Origin（并建议限制到可信域）。
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
}

// 中文化页面（精简版）
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
    </style>
  </head>
  <body>
    <main>
      <h1>LetsChat</h1>
      <section id="login" class="login-card" aria-label="Account login">
        <h2>账号登录</h2>
        <p class="hint">选择一个显示名称进入聊天室。</p>
        <form id="login-form">
          <div class="field"><label for="username">用户名</label><input id="username" name="username" maxlength="50" autocomplete="username" placeholder="例如：张三" required /></div>
          <button type="submit">进入聊天</button>
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
      const login = document.querySelector('#login'), room = document.querySelector('#room'), loginForm = document.querySelector('#login-form'), usernameInput = document.querySelector('#username'), currentUser = document.querySelector('#current-user'), logout = document.querySelector('#logout')
      let heartbeatTimer, refreshTimer

      const escapeHtml = (value) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
      const showError = (message) => { status.hidden = false; status.className = 'error'; status.textContent = message }
      const render = (items) => {
        if (!items || items.length === 0) { status.hidden = false; status.className = 'empty'; status.textContent = '还没有消息，快来打个招呼吧！'; messages.hidden = true; return }
        status.hidden = true; messages.hidden = false
        messages.innerHTML = items.map(m => '<div class="message"><strong>' + escapeHtml(m.user) + '</strong>: ' + escapeHtml(m.content) + (m.created_at ? '<time>' + new Date(m.created_at).toLocaleString() + '</time>' : '') + '</div>').join('')
      }
      const renderUsers = (items) => { onlineUsers.innerHTML = items.length ? items.map((item) => '<li><span class="dot"></span>' + escapeHtml(item.user) + '</li>').join('') : '<li>暂无在线用户</li>' }

      const api = async (path, options = {}) => {
        options.credentials = 'include' // 带上 cookie
        const response = await fetch(path, options)
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.error || '请求失败')
        }
        return response.json()
      }

      const loadMessages = async () => { try { render(await api('/api/messages')) } catch (error) { showError(error.message) } }
      const loadUsers = async () => { try { renderUsers(await api('/api/users/online')) } catch { renderUsers([]) } }

      const heartbeat = async () => {
        try { await api('/api/presence', { method: 'POST' }) } catch (e) { /* ignore */ }
      }

      const enterRoom = async (name) => {
        try {
          const resp = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ user: name }) })
          if (!resp.ok) { const p = await resp.json().catch(()=>({error:'登录失败'})); throw new Error(p.error || '登录失败') }
          const data = await resp.json()
          currentUser.textContent = data.user
          login.hidden = true
          room.hidden = false
          // 启动心跳与刷新
          await heartbeat()
          heartbeatTimer = setInterval(heartbeat, 30 * 1000)
          refreshTimer = setInterval(() => { loadMessages(); loadUsers() }, 5000)
          loadMessages(); loadUsers()
        } catch (err) {
          alert(err.message)
        }
      }

      loginForm.addEventListener('submit', (event) => { event.preventDefault(); enterRoom(usernameInput.value.trim()) })

      logout.addEventListener('click', async () => {
        clearInterval(heartbeatTimer); clearInterval(refreshTimer)
        try { await fetch('/api/presence', { method: 'DELETE', credentials: 'include' }) } catch (e) { /* ignore */ }
        // 清除界面
        currentUser.textContent = ''
        login.hidden = false
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

      // 页面加载后尝试探测当前会话（whoami），若存在会话直接进入房间
      (async () => {
        try {
          const who = await api('/api/whoami')
          if (who && who.user) {
            currentUser.textContent = who.user
            login.hidden = true
            room.hidden = false
            heartbeatTimer = setInterval(heartbeat, 30 * 1000)
            refreshTimer = setInterval(() => { loadMessages(); loadUsers() }, 5000)
            await heartbeat()
            loadMessages(); loadUsers()
            return
          }
        } catch (e) {
          // no session
        }
        usernameInput.focus()
      })()
    </script>
  </body>
</html>`

const ONLINE_WINDOW_MS = 60 * 1000

const normalizeUser = (value) => (typeof value === 'string' ? value.trim() : '')

const readJsonBody = async (request) => {
  try {
    return await request.json()
  } catch {
    return null
  }
}

const json = (payload, status = 200, request = null) => {
  const headers = { ...jsonHeadersBase }
  // 回显 Origin（如果存在且可信）。生产中请替换为明确的白名单检查。
  if (request) {
    const origin = request.headers.get('Origin')
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    else headers['Access-Control-Allow-Origin'] = '*'
  } else {
    headers['Access-Control-Allow-Origin'] = '*'
  }
  return new Response(JSON.stringify(payload), { status, headers })
}

const makeHtml = (payload) => new Response(payload, { status: 200, headers: pageHeaders })

const validateDatabase = (env) => {
  if (!env.DB) {
    return json({ error: 'D1 database binding "DB" is not configured.' }, 500)
  }
  return null
}

const generateSessionToken = () => crypto.randomUUID()
const getSessionTokenFromRequest = (request) => {
  const cookie = request.headers.get('cookie') || ''
  for (const pair of cookie.split(';')) {
    const [k, v] = pair.trim().split('=')
    if (k === 'letschat_session' && v) return v
  }
  return null
}

const getSession = async (request, env) => {
  const token = getSessionTokenFromRequest(request)
  if (!token) return null
  const now = Date.now()
  const { results } = await env.DB.prepare('SELECT session_token, user, created_at, expires_at FROM sessions WHERE session_token = ? LIMIT 1').bind(token).all()
  if (!results || results.length === 0) return null
  const session = results[0]
  if (session.expires_at < now) {
    await env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(token).run()
    return null
  }
  return session
}

const makeSetCookieHeader = (token, maxAgeSeconds = 60 * 60 * 24 * 7) => {
  return `letschat_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

// API: 获取当前会话信息
const whoami = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ ok: false }, 200, request)
  return json({ ok: true, user: session.user }, 200, request)
}

const getMessages = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const { results } = await env.DB.prepare('SELECT id, user, content, created_at FROM messages ORDER BY created_at DESC LIMIT 50').all()
  return json(results, 200, request)
}

const createMessage = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ error: '未登录' }, 401, request)
  const body = await readJsonBody(request)
  if (!body) return json({ error: '请求体必须为 JSON.' }, 400, request)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return json({ error: '消息不能为空。' }, 400, request)
  if (content.length > 500) return json({ error: '消息不能超过 500 字符。' }, 400, request)
  const createdAt = Date.now()
  const result = await env.DB.prepare('INSERT INTO messages (session_token, user, content, created_at) VALUES (?, ?, ?, ?)').bind(session.session_token, session.user, content, createdAt).run()
  return json({ id: result.meta.last_row_id, user: session.user, content, created_at: createdAt }, 201, request)
}

const login = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const body = await readJsonBody(request)
  if (!body) return json({ error: '请求体必须为 JSON' }, 400, request)
  const user = normalizeUser(body.user)
  if (!user) return json({ error: '用户名不能为空' }, 400, request)
  if (user.length > 50) return json({ error: '用户名不能超过 50 字符' }, 400, request)
  const token = generateSessionToken()
  const now = Date.now()
  const expiresAt = now + 1000 * 60 * 60 * 24 * 7
  await env.DB.prepare('INSERT INTO sessions (session_token, user, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(token, user, now, expiresAt).run()
  await env.DB.prepare('INSERT INTO online_users (session_token, user, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_token) DO UPDATE SET last_seen = excluded.last_seen, user = excluded.user').bind(token, user, now).run()
  const headers = { ...jsonHeadersBase }
  const origin = request.headers.get('Origin')
  headers['Access-Control-Allow-Origin'] = origin || '*'
  headers['Set-Cookie'] = makeSetCookieHeader(token)
  return new Response(JSON.stringify({ ok: true, user }), { status: 201, headers })
}

const touchPresence = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ error: '未登录' }, 401, request)
  const lastSeen = Date.now()
  await env.DB.prepare('INSERT INTO online_users (session_token, user, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_token) DO UPDATE SET last_seen = excluded.last_seen, user = excluded.user').bind(session.session_token, session.user, lastSeen).run()
  return json({ user: session.user, last_seen: lastSeen }, 200, request)
}

const removePresence = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ ok: true }, 200, request)
  await env.DB.prepare('DELETE FROM online_users WHERE session_token = ?').bind(session.session_token).run()
  await env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(session.session_token).run()
  const headers = { ...jsonHeadersBase }
  const origin = request.headers.get('Origin')
  headers['Access-Control-Allow-Origin'] = origin || '*'
  headers['Set-Cookie'] = 'letschat_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}

const getOnlineUsers = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb
  const cutoff = Date.now() - ONLINE_WINDOW_MS
  await env.DB.prepare('DELETE FROM online_users WHERE last_seen < ?').bind(cutoff).run()
  const { results } = await env.DB.prepare('SELECT user, last_seen FROM online_users WHERE last_seen >= ? ORDER BY user COLLATE NOCASE ASC').bind(cutoff).all()
  return json(results, 200, request)
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      const headers = { ...jsonHeadersBase }
      const origin = request.headers.get('Origin')
      headers['Access-Control-Allow-Origin'] = origin || '*'
      return new Response(null, { status: 204, headers })
    }

    if (url.pathname === '/') {
      return makeHtml(chatPage)
    }

    if (url.pathname === '/api/whoami' && request.method === 'GET') {
      return whoami(request, env)
    }

    if (url.pathname === '/api/messages' && request.method === 'GET') {
      return getMessages(request, env)
    }

    if (url.pathname === '/api/messages' && request.method === 'POST') {
      return createMessage(request, env)
    }

    if (url.pathname === '/api/login' && request.method === 'POST') {
      return login(request, env)
    }

    if (url.pathname === '/api/presence' && request.method === 'POST') {
      return touchPresence(request, env)
    }

    if (url.pathname === '/api/presence' && request.method === 'DELETE') {
      return removePresence(request, env)
    }

    if (url.pathname === '/api/users/online' && request.method === 'GET') {
      return getOnlineUsers(request, env)
    }

    return json({ error: '未找到' }, 404, request)
  },
}
