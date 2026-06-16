import { Hono } from 'hono'
import { cors } from 'hono/cors'

export default {
  async fetch(request, env, ctx) {
    const app = new Hono()

    app.use('*', cors())

    app.get('/', (c) => c.text('Cloudflare Worker Chat API'))

    // 示例聊天室接口
    app.get('/api/messages', async (c) => {
      const messages = await env.DB.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 50').all()
      return c.json(messages.results)
    })

    app.post('/api/messages', async (c) => {
      const body = await c.req.json()
      const { user, content } = body
      await env.DB.prepare('INSERT INTO messages (user, content, created_at) VALUES (?, ?, ?)')
        .bind(user, content, Date.now())
        .run()
      return c.json({ success: true })
    })

    return app.fetch(request, env, ctx)
  }
}
