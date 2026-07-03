const ALLOWED_ORIGINS = ['https://chat1.yyc2.dpdns.org']

const jsonHeadersBase = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
}

const pageHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
}

const chatPage = String.raw`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LetsChat</title>
    <style>
      /* minimal styles; client bundle provides richer styles in dev */
      body{font-family:Inter, system-ui, -apple-system; background:linear-gradient(135deg,#eff6ff,#f8fafc);margin:0}
    </style>
  </head>
  <body>
    <div id="root">请通过前端界面访问</div>
  </body>
</html>`

const ONLINE_WINDOW_MS = 60 * 1000
const PASSWORD_MIN_LENGTH = 8
const MAX_FAILED = 6
const LOCK_DURATION_MS = 15 * 60 * 1000 // 15 minutes

const normalizeUser = (value) => (typeof value === 'string' ? value.trim() : '')
const readJsonBody = async (request) => {
  try { return await request.json() } catch { return null }
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

// Set cookie now includes Domain for .yyc2.dpdns.org to allow subdomain sharing.
// If you do not want cross-subdomain cookies, remove the Domain attribute.
const makeSetCookieHeader = (token, maxAgeSeconds = 60 * 60 * 24 * 7) => {
  return `letschat_session=${token}; Domain=.yyc2.dpdns.org; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`
}

const isOriginAllowed = (origin) => {
  if (!origin) return false
  return ALLOWED_ORIGINS.includes(origin)
}

const json = (payload, status = 200, request = null) => {
  const headers = { ...jsonHeadersBase }
  if (request) {
    const origin = request.headers.get('Origin')
    if (origin) {
      if (!isOriginAllowed(origin)) {
        // Explicitly reject unauthorized origins
        return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers })
      }
      headers['Access-Control-Allow-Origin'] = origin
    } else {
      // No Origin header (same-origin or server-side requests) — set default allowed origin
      headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0]
    }
  } else {
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0]
  }
  headers['Access-Control-Allow-Credentials'] = 'true'
  return new Response(JSON.stringify(payload), { status, headers })
}

const makeHtml = (payload) => new Response(payload, { status: 200, headers: pageHeaders })

const validateDatabase = (env) => {
  if (!env.DB) return json({ error: 'D1 database binding "DB" is not configured.' }, 500)
  return null
}

// PBKDF2-based password hashing (uses Web Crypto, no external deps)
// base64 helpers with cross-environment fallbacks (btoa/atob in Workers, Buffer in Node during build/tests)
const toBase64 = (buf) => {
  if (typeof btoa === 'function') {
    let binary = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  } else if (typeof Buffer !== 'undefined') {
    return Buffer.from(buf).toString('base64')
  }
  throw new Error('No base64 encoder available')
}

const fromBase64 = (s) => {
  if (typeof atob === 'function') {
    const binary = atob(s)
    const arr = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
    return arr
  } else if (typeof Buffer !== 'undefined') {
    const b = Buffer.from(s, 'base64')
    return Uint8Array.from(b)
  }
  throw new Error('No base64 decoder available')
}

async function hashPassword(password, iterations = 100000) {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
  const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256)
  return `pbkdf2_sha256$${iterations}$${toBase64(salt)}$${toBase64(derivedBits)}`
}

async function verifyPassword(password, stored) {
  try {
    const parts = stored.split('$')
    if (parts.length !== 4) return false
    const iterations = Number(parts[1])
    const salt = fromBase64(parts[2])
    const expected = fromBase64(parts[3])
    const enc = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
    const derivedBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, expected.byteLength * 8)
    const a = new Uint8Array(derivedBits)
    const b = expected
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
  } catch (e) {
    return false
  }
}

// session helpers
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

// API handlers
const whoami = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ ok: false }, 200, request)
  return json({ ok: true, user: session.user }, 200, request)
}

const getMessages = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const { results } = await env.DB.prepare('SELECT id, user, content, created_at FROM messages ORDER BY created_at DESC LIMIT 50').all()
  return json(results, 200, request)
}

const createMessage = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ error: '未登录', code: 'NOT_AUTHENTICATED' }, 401, request)
  const body = await readJsonBody(request); if (!body) return json({ error: '请求体必须为 JSON', code: 'INVALID_JSON' }, 400, request)
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content) return json({ error: '消息不能为空', code: 'CONTENT_REQUIRED' }, 400, request)
  if (content.length > 500) return json({ error: '消息不能超过 500 字符', code: 'CONTENT_TOO_LONG' }, 400, request)
  const createdAt = Date.now()
  const result = await env.DB.prepare('INSERT INTO messages (session_token, user, content, created_at) VALUES (?, ?, ?, ?)').bind(session.session_token, session.user, content, createdAt).run()
  return json({ id: result.meta.last_row_id, user: session.user, content, created_at: createdAt }, 201, request)
}

const getOnlineUsers = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const cutoff = Date.now() - ONLINE_WINDOW_MS
  await env.DB.prepare('DELETE FROM online_users WHERE last_seen < ?').bind(cutoff).run()
  const { results } = await env.DB.prepare('SELECT user, last_seen FROM online_users WHERE last_seen >= ? ORDER BY user COLLATE NOCASE ASC').bind(cutoff).all()
  return json(results, 200, request)
}

const touchPresence = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ error: '未登录', code: 'NOT_AUTHENTICATED' }, 401, request)
  const lastSeen = Date.now()
  await env.DB.prepare('INSERT INTO online_users (session_token, user, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_token) DO UPDATE SET last_seen = excluded.last_seen, user = excluded.user').bind(session.session_token, session.user, lastSeen).run()
  return json({ user: session.user, last_seen: lastSeen }, 200, request)
}

const removePresence = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const session = await getSession(request, env)
  if (!session) return json({ ok: true }, 200, request)
  await env.DB.prepare('DELETE FROM online_users WHERE session_token = ?').bind(session.session_token).run()
  await env.DB.prepare('DELETE FROM sessions WHERE session_token = ?').bind(session.session_token).run()
  const headers = { ...jsonHeadersBase }
  const origin = request.headers.get('Origin')
  if (origin && !isOriginAllowed(origin)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers })
  headers['Access-Control-Allow-Origin'] = origin || ALLOWED_ORIGINS[0]
  headers['Set-Cookie'] = 'letschat_session=; Domain=.yyc2.dpdns.org; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  headers['Access-Control-Allow-Credentials'] = 'true'
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}

// REGISTER (POST /api/register)
const register = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const body = await readJsonBody(request); if (!body) return json({ error: '请求体必须为 JSON', code: 'INVALID_JSON' }, 400, request)
  const username = normalizeUser(body.username)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username) return json({ error: '用户名不能为空', code: 'USERNAME_REQUIRED', field: 'username' }, 400, request)
  if (username.length > 50) return json({ error: '用户名不能超过 50 字符', code: 'USERNAME_TOO_LONG', field: 'username' }, 400, request)
  if (!password || password.length < PASSWORD_MIN_LENGTH) return json({ error: `密码至少 ${PASSWORD_MIN_LENGTH} 字符`, code: 'PASSWORD_TOO_SHORT', field: 'password' }, 400, request)
  try {
    const now = Date.now()
    const hash = await hashPassword(password)
    await env.DB.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').bind(username, hash, now).run()
    return json({ ok: true, user: username }, 201, request)
  } catch (err) {
    if (err && /UNIQUE|constraint/i.test(err.message)) {
      return json({ error: '用户名已存在', code: 'USERNAME_TAKEN', field: 'username' }, 409, request)
    }
    return json({ error: '注册失败', code: 'REGISTER_FAILED', detail: String(err && err.message) }, 500, request)
  }
}

// LOGIN (POST /api/login)
const login = async (request, env) => {
  const missingDb = validateDatabase(env); if (missingDb) return missingDb
  const body = await readJsonBody(request); if (!body) return json({ error: '请求体必须为 JSON', code: 'INVALID_JSON' }, 400, request)
  const username = normalizeUser(body.username)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return json({ error: '用户名和密码均为必填项', code: 'CREDENTIALS_REQUIRED' }, 400, request)
  const { results } = await env.DB.prepare('SELECT id, username, password_hash, failed_login_attempts, locked_until FROM users WHERE username = ? LIMIT 1').bind(username).all()
  if (!results || results.length === 0) {
    return json({ error: '用户不存在', code: 'USER_NOT_FOUND', field: 'username' }, 401, request)
  }
  const userRow = results[0]
  const now = Date.now()
  if (userRow.locked_until && userRow.locked_until > now) {
    return json({ error: '账户被暂时锁定，请稍后重试', code: 'ACCOUNT_LOCKED', retry_after_ms: userRow.locked_until - now }, 403, request)
  }
  const passwordMatch = await verifyPassword(password, userRow.password_hash)
  if (!passwordMatch) {
    const attempts = (userRow.failed_login_attempts || 0) + 1
    const lockedUntil = attempts >= MAX_FAILED ? now + LOCK_DURATION_MS : null
    await env.DB.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').bind(attempts, lockedUntil, userRow.id).run()
    return json({ error: '密码错误', code: 'INVALID_PASSWORD', attempts, locked_until: lockedUntil }, 401, request)
  }
  // success
  await env.DB.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').bind(userRow.id).run()
  const token = generateSessionToken()
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7
  await env.DB.prepare('INSERT INTO sessions (session_token, user, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(token, userRow.username, Date.now(), expiresAt).run()
  await env.DB.prepare('INSERT INTO online_users (session_token, user, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_token) DO UPDATE SET last_seen = excluded.last_seen, user = excluded.user').bind(token, userRow.username, Date.now()).run()
  const headers = { ...jsonHeadersBase }
  const origin = request.headers.get('Origin')
  if (origin && !isOriginAllowed(origin)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers })
  headers['Access-Control-Allow-Origin'] = origin || ALLOWED_ORIGINS[0]
  headers['Set-Cookie'] = makeSetCookieHeader(token)
  headers['Access-Control-Allow-Credentials'] = 'true'
  return new Response(JSON.stringify({ ok: true, user: userRow.username }), { status: 200, headers })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') {
      const headers = { ...jsonHeadersBase }
      const origin = request.headers.get('Origin')
      if (origin && !isOriginAllowed(origin)) return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers })
      headers['Access-Control-Allow-Origin'] = origin || ALLOWED_ORIGINS[0]
      headers['Access-Control-Allow-Credentials'] = 'true'
      return new Response(null, { status: 204, headers })
    }
    if (url.pathname === '/') return makeHtml(chatPage)
    if (url.pathname === '/api/whoami' && request.method === 'GET') return whoami(request, env)
    if (url.pathname === '/api/messages' && request.method === 'GET') return getMessages(request, env)
    if (url.pathname === '/api/messages' && request.method === 'POST') return createMessage(request, env)
    if (url.pathname === '/api/users/online' && request.method === 'GET') return getOnlineUsers(request, env)
    if (url.pathname === '/api/presence' && request.method === 'POST') return touchPresence(request, env)
    if (url.pathname === '/api/presence' && request.method === 'DELETE') return removePresence(request, env)
    if (url.pathname === '/api/register' && request.method === 'POST') return register(request, env)
    if (url.pathname === '/api/login' && request.method === 'POST') return login(request, env)
    return json({ error: '未找到', code: 'NOT_FOUND' }, 404, request)
  }
}
