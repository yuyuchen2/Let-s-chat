const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
}

const chatPage = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LetsChat</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(135deg, #eff6ff, #f8fafc 45%, #ecfeff); color: #0f172a; }
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
        <h2>Account login</h2>
        <p class="hint">Choose a display name to enter the chat room.</p>
        <form id="login-form">
          <div class="field"><label for="username">User name</label><input id="username" name="username" maxlength="50" autocomplete="username" placeholder="e.g. Alice" required /></div>
          <button type="submit">Enter chat</button>
        </form>
      </section>
      <section id="room" class="layout" hidden>
        <section class="panel" aria-label="Chat room">
          <div class="topbar"><span>Signed in as <strong id="current-user"></strong></span><button id="logout" class="secondary" type="button">Logout</button></div>
          <div id="status" class="empty">Loading messages...</div>
          <div id="messages" hidden></div>
          <form id="form" class="chat-form">
            <input id="message" name="message" maxlength="500" autocomplete="off" placeholder="Type a message..." required />
            <button id="send" type="submit">Send</button>
          </form>
        </section>
        <aside class="panel sidebar" aria-label="Online users"><h2>Online users</h2><ul id="online-users"><li><span class="dot"></span>Loading...</li></ul></aside>
      </section>
    </main>
    <script>
      const status = document.querySelector('#status'), messages = document.querySelector('#messages'), form = document.querySelector('#form'), input = document.querySelector('#message'), send = document.querySelector('#send')
      const login = document.querySelector('#login'), room = document.querySelector('#room'), loginForm = document.querySelector('#login-form'), usernameInput = document.querySelector('#username'), currentUser = document.querySelector('#current-user'), logout = document.querySelector('#logout'), onlineUsers = document.querySelector('#online-users')
      let user = localStorage.getItem('letschat:user') || ''
      let heartbeatTimer, refreshTimer
      const escapeHtml = (value) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
      const showError = (message) => { status.hidden = false; status.className = 'error'; status.textContent = message }
      const render = (items) => { status.hidden = items.length > 0; status.className = 'empty'; status.textContent = 'No messages yet. Start the conversation!'; messages.hidden = false; messages.innerHTML = items.length ? items.map((item) => '<article class="message"><strong>' + escapeHtml(item.user) + '</strong>: ' + escapeHtml(item.content) + '<time>' + new Date(item.created_at).toLocaleString() + '</time></article>').join('') : '<p class="empty">No messages yet. Start the conversation!</p>' }
      const renderUsers = (items) => { onlineUsers.innerHTML = items.length ? items.map((item) => '<li><span class="dot"></span>' + escapeHtml(item.user) + '</li>').join('') : '<li>No one online</li>' }
      const api = async (path, options) => { const response = await fetch(path, options); if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'Request failed') } return response.json().catch(() => null) }
      const loadMessages = async () => { try { render(await api('/api/messages')) } catch (error) { showError(error.message) } }
      const loadUsers = async () => { try { renderUsers(await api('/api/users/online')) } catch { renderUsers([]) } }
      const heartbeat = async () => { if (!user) return; try { await api('/api/presence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) }); await loadUsers() } catch (error) { showError(error.message) } }
      const enterRoom = async (name) => { user = name.trim(); if (!user) return; localStorage.setItem('letschat:user', user); currentUser.textContent = user; login.hidden = true; room.hidden = false; await heartbeat(); await loadMessages(); clearInterval(heartbeatTimer); clearInterval(refreshTimer); heartbeatTimer = setInterval(heartbeat, 25000); refreshTimer = setInterval(() => { loadMessages(); loadUsers() }, 10000); input.focus() }
      loginForm.addEventListener('submit', (event) => { event.preventDefault(); enterRoom(usernameInput.value) })
      logout.addEventListener('click', async () => { clearInterval(heartbeatTimer); clearInterval(refreshTimer); if (user) await fetch('/api/presence', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user }) }).catch(() => {}); user = ''; localStorage.removeItem('letschat:user'); room.hidden = true; login.hidden = false; usernameInput.focus() })
      form.addEventListener('submit', async (event) => { event.preventDefault(); const content = input.value.trim(); if (!content || !user) return; send.disabled = true; try { await api('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, content }) }); input.value = ''; await loadMessages(); await heartbeat() } catch (error) { showError(error.message) } finally { send.disabled = false; input.focus() } })
      if (user) enterRoom(user); else usernameInput.focus()
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

const json = (payload, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
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

  const user = normalizeUser(body.user)
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!user || !content) {
    return json({ error: 'Both user and content are required.' }, 400)
  }

  if (user.length > 50 || content.length > 500) {
    return json({ error: 'User must be 50 characters or fewer and content must be 500 characters or fewer.' }, 400)
  }

  const createdAt = Date.now()
  const result = await env.DB.prepare('INSERT INTO messages (user, content, created_at) VALUES (?, ?, ?)')
    .bind(user, content, createdAt)
    .run()

  return json(
    {
      id: result.meta.last_row_id,
      user,
      content,
      created_at: createdAt,
    },
    201,
  )
}


const touchPresence = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const body = await readJsonBody(request)
  if (!body) return json({ error: 'Request body must be valid JSON.' }, 400)

  const user = normalizeUser(body.user)
  if (!user) return json({ error: 'User is required.' }, 400)
  if (user.length > 50) return json({ error: 'User must be 50 characters or fewer.' }, 400)

  const lastSeen = Date.now()
  await env.DB.prepare(
    'INSERT INTO online_users (user, last_seen) VALUES (?, ?) ON CONFLICT(user) DO UPDATE SET last_seen = excluded.last_seen',
  )
    .bind(user, lastSeen)
    .run()

  return json({ user, last_seen: lastSeen })
}

const removePresence = async (request, env) => {
  const missingDb = validateDatabase(env)
  if (missingDb) return missingDb

  const body = await readJsonBody(request)
  if (!body) return json({ error: 'Request body must be valid JSON.' }, 400)

  const user = normalizeUser(body.user)
  if (!user) return json({ ok: true })

  await env.DB.prepare('DELETE FROM online_users WHERE user = ?').bind(user).run()
  return json({ ok: true })
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: jsonHeaders })
    }

    if (url.pathname === '/') {
      return new Response(chatPage, { headers: pageHeaders })
    }

    if (url.pathname === '/api/messages' && request.method === 'GET') {
      return getMessages(env)
    }

    if (url.pathname === '/api/messages' && request.method === 'POST') {
      return createMessage(request, env)
    }

    if (url.pathname === '/api/presence' && request.method === 'POST') {
      return touchPresence(request, env)
    }

    if (url.pathname === '/api/presence' && request.method === 'DELETE') {
      return removePresence(request, env)
    }

    if (url.pathname === '/api/users/online' && request.method === 'GET') {
      return getOnlineUsers(env)
    }

    return json({ error: 'Not found' }, 404)
  },
}
