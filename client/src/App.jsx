import React, { useState, useEffect } from 'react'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [user, setUser] = useState('user' + Math.floor(Math.random() * 1000))

  useEffect(() => {
    fetch('/api/messages')
      .then(res => res.json())
      .then(setMessages)
  }, [])

  const sendMessage = async () => {
    if (!text) return
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, content: text })
    })
    setMessages([{ user, content: text, created_at: Date.now() }, ...messages])
    setText('')
  }

  return (
    <div className='p-4 max-w-lg mx-auto'>
      <h1 className='text-2xl font-bold mb-4 text-center'>Cloudflare Chat</h1>
      <div className='space-y-2 mb-4 h-96 overflow-y-auto border p-2 rounded'>
        {messages.map((m, i) => (
          <div key={i} className='p-2 bg-gray-100 rounded'>
            <b>{m.user}</b>: {m.content}
          </div>
        ))}
      </div>
      <div className='flex gap-2'>
        <input
          className='border flex-1 p-2 rounded'
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='Type a message...'
        />
        <button className='bg-blue-500 text-white px-4 rounded' onClick={sendMessage}>
          Send
        </button>
      </div>
    </div>
  )
}
