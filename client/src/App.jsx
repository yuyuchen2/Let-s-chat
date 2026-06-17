import React, { useEffect, useMemo, useState } from 'react'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const user = useMemo(() => `user${Math.floor(Math.random() * 1000)}`, [])

  useEffect(() => {
    let isMounted = true

    const loadMessages = async () => {
      try {
        const response = await fetch('/api/messages')
        if (!response.ok) {
          throw new Error('Failed to load messages')
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

  const sendMessage = async () => {
    const content = text.trim()
    if (!content || isSending) return

    setIsSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, content }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
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

  return (
    <main className='p-4 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-4 text-center'>Cloudflare Chat</h1>
      {error && <p className='mb-4 rounded bg-red-100 p-2 text-red-700'>{error}</p>}
      <div className='space-y-2 mb-4 h-96 overflow-y-auto border p-2 rounded bg-white'>
        {isLoading ? (
          <p>Loading messages...</p>
        ) : messages.length === 0 ? (
          <p>No messages yet. Start the conversation!</p>
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
          placeholder='Type a message...'
          maxLength={500}
        />
        <button className='bg-blue-500 text-white px-4 rounded' type='submit' disabled={!text.trim() || isSending}>
          {isSending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </main>
  )
}
