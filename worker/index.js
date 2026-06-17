import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use('*', cors())

app.get('/', (c) => c.text('Cloudflare Worker Chat API'))

app.get('/api/messages', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, user, content, created_at FROM messages ORDER BY created_at DESC LIMIT 50',
  ).all()

  return c.json(results)
})

app.post('/api/messages', async (c) => {
  let body

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be valid JSON.' }, 400)
  }

  const user = typeof body.user === 'string' ? body.user.trim() : ''
  const content = typeof body.content === 'string' ? body.content.trim() : ''

  if (!user || !content) {
    return c.json({ error: 'Both user and content are required.' }, 400)
  }

  if (user.length > 50 || content.length > 500) {
    return c.json({ error: 'User must be 50 characters or fewer and content must be 500 characters or fewer.' }, 400)
  }

  const createdAt = Date.now()
  const result = await c.env.DB.prepare('INSERT INTO messages (user, content, created_at) VALUES (?, ?, ?)')
    .bind(user, content, createdAt)
    .run()

  return c.json(
    {
      id: result.meta.last_row_id,
      user,
      content,
      created_at: createdAt,
    },
    201,
  )
})

export default app
