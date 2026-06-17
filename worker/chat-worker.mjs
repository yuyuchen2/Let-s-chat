const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(135deg, #eff6ff, #f8fafc 45%, #ecfeff);
        color: #0f172a;
      }
      main {
        width: min(100% - 2rem, 42rem);
        margin: 0 auto;
        padding: 2rem 0;
      }
      h1 { margin: 0 0 1rem; text-align: center; }
      .panel {
        border: 1px solid #cbd5e1;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.9);
        box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
        overflow: hidden;
      }
      #messages {
        height: 28rem;
        overflow-y: auto;
        padding: 1rem;
      }
      .message {
        padding: 0.75rem;
        margin-bottom: 0.75rem;
        border-radius: 0.75rem;
        background: #f1f5f9;
      }
      .message strong { color: #1d4ed8; }
      .message time {
        display: block;
        margin-top: 0.25rem;
        color: #64748b;
        font-size: 0.8rem;
      }
      .empty, .error { padding: 1rem; color: #64748b; }
      .error { color: #b91c1c; background: #fee2e2; }
      form {
        display: flex;
        gap: 0.5rem;
        padding: 1rem;
        border-top: 1px solid #e2e8f0;
        background: #ffffff;
      }
      input {
        flex: 1;
        min-width: 0;
        border: 1px solid #cbd5e1;
        border-radius: 0.75rem;
        padding: 0.75rem;
        font: inherit;
      }
      button {
        border: 0;
        border-radius: 0.75rem;
        padding: 0.75rem 1rem;
        background: #2563eb;
        color: #ffffff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }
      button:disabled { cursor: not-allowed; opacity: 0.65; }
    </style>
  </head>
  <body>
    <main>
      <h1>LetsChat</h1>
      <section class="panel" aria-label="Chat room">
        <div id="status" class="empty">Loading messages...</div>
        <div id="messages" hidden></div>
        <form id="form">
          <input id="message" name="message" maxlength="500" autocomplete="off" placeholder="Type a message..." required />
          <button id="send" type="submit">Send</button>
        </form>
      </section>
    </main>
    <script>
      const status = document.querySelector('#status')
      const messages = document.querySelector('#messages')
      const form = document.querySelector('#form')
      const input = document.querySelector('#message')
      const send = document.querySelector('#send')
      const user = localStorage.getItem('letschat:user') || 'user' + Math.floor(Math.random() * 1000)
      localStorage.setItem('letschat:user', user)

      const escapeHtml = (value) => value.replace(/[&<>'"]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;',
      }[char]))

      const render = (items) => {
        status.hidden = items.length > 0
        messages.hidden = false
        messages.innerHTML = items.length
          ? items.map((item) =>
              '<article class="message">' +
                '<strong>' + escapeHtml(item.user) + '</strong>: ' + escapeHtml(item.content) +
                '<time>' + new Date(item.created_at).toLocaleString() + '</time>' +
              '</article>'
            ).join('')
          : '<p class="empty">No messages yet. Start the conversation!</p>'
      }

      const showError = (message) => {
        status.hidden = false
        status.className = 'error'
        status.textContent = message
      }

      const loadMessages = async () => {
        try {
          const response = await fetch('/api/messages')
          if (!response.ok) throw new Error('Failed to load messages')
          render(await response.json())
        } catch (error) {
          showError(error.message)
        }
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        const content = input.value.trim()
        if (!content) return

        send.disabled = true
        try {
          const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, content }),
          })
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}))
            throw new Error(payload.error || 'Failed to send message')
          }
          input.value = ''
          await loadMessages()
        } catch (error) {
          showError(error.message)
        } finally {
          send.disabled = false
          input.focus()
        }
      })

      loadMessages()
    </script>
  </body>
</html>`

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

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400)
  }

  const user = typeof body.user === 'string' ? body.user.trim() : ''
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

    return json({ error: 'Not found' }, 404)
  },
}
