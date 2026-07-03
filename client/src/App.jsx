import React, { useEffect, useMemo, useState } from 'react'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [user, setUser] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const resp = await fetch('/api/whoami', { credentials: 'include' })
        if (resp.ok) {
          const data = await resp.json()
          if (data && data.ok && data.user) {
            setUser(data.user)
            setIsLoggedIn(true)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    checkSession()
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadMessages = async () => {
      try {
        const response = await fetch('/api/messages')
        if (!response.ok) {
          throw new Error('加载消息失败')
        }
        const data = await response.json()
        if (isMounted) {
          setMessages(Array.isArray(data) ? data : [])
          setError('')
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadMessages()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (name) => {
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user: name }),
      })
      if (!resp.ok) throw new Error('登录失败')
      const data = await resp.json()
      setUser(data.user)
      setIsLoggedIn(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const sendMessage = async () => {
    const content = text.trim()
    if (!content || isSending) return

    setIsSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(()=>({error:'发送失败'}))
        throw new Error(payload.error || '发送失败')
      }

      const savedMessage = await response.json()
      setMessages((currentMessages) => [savedMessage, ...currentMessages])
      setText('')
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    sendMessage()
  }

  if (!isLoggedIn) {
    return (
      <main className='p-4 max-w-lg mx-auto'>
        <h1 className='text-2xl font-bold mb-4 text-center'>Cloudflare 聊天</h1>
        <div className='login-card p-4 rounded bg-white'>
          <h2 className='text-lg font-bold mb-2'>登录</h2>
          <form onSubmit={(e) => { e.preventDefault(); const v = e.target.elements.username.value.trim(); if (v) login(v) }}>
            <input name='username' placeholder='输入用户名，例如：小明' className='border p-2 rounded w-full mb-2' maxLength={50} />
            <button className='bg-blue-500 text-white px-4 rounded' type='submit'>登录</button>
          </form>
          {error && <p className='text-red-600 mt-2'>{error}</p>}
        </div>
      </main>
    )
  }

  return (
    <main className='p-4 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-4 text-center'>Cloudflare 聊天</h1>
      {error && <p className='mb-4 rounded bg-red-100 p-2 text-red-700'>{error}</p>}
      <div className='space-y-2 mb-4 h-96 overflow-y-auto border p-2 rounded bg-white'>
        {isLoading ? (
          <p>正在加载消息...</p>
        ) : messages.length === 0 ? (
          <p>还没有消息，快来打个招呼吧！</p>
        ) : (
          messages.map((message) => (
            <article key={message.id ?? `${message.created_at}-${message.user}`} className='p-2 bg-gray-100 rounded'>
              <b>{message.user}</b>: {message.content}
            </article>
          ))
        )}
      </div>
      <form className='flex gap-2' onSubmit={handleSubmit}>
        <input
          className='border flex-1 p-2 rounded'
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='输入消息...'
          maxLength={500}
        />
        <button className='bg-blue-500 text-white px-4 rounded' type='submit' disabled={!text.trim() || isSending}>
          {isSending ? '发送中...' : '发送'}
        </button>
      </form>
    </main>
  )
}
