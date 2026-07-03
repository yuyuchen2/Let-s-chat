import React, { useEffect, useState } from 'react'

export default function App() {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [user, setUser] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showRegister, setShowRegister] = useState(false)

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
      } catch (e) {}
    }
    checkSession()
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadMessages = async () => {
      try {
        const response = await fetch('/api/messages')
        if (!response.ok) throw new Error('加载消息失败')
        const data = await response.json()
        if (isMounted) setMessages(Array.isArray(data) ? data : [])
      } catch (err) {
        if (isMounted) setError(err.message)
      } finally { if (isMounted) setIsLoading(false) }
    }
    loadMessages()
    return () => { isMounted = false }
  }, [])

  const register = async (username, password) => {
    try {
      const resp = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload.error || '注册失败')
      alert('注册成功，请登录')
      setShowRegister(false)
    } catch (e) { alert(e.message) }
  }

  const login = async (username, password) => {
    try {
      const resp = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ username, password }) })
      const payload = await resp.json()
      if (!resp.ok) throw new Error(payload.error || '登录失败')
      setUser(payload.user)
      setIsLoggedIn(true)
    } catch (e) { setError(e.message) }
  }

  const sendMessage = async () => {
    const content = text.trim()
    if (!content || isSending) return
    setIsSending(true)
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ content }) })
      if (!response.ok) {
        const payload = await response.json().catch(()=>({error:'发送失败'}))
        throw new Error(payload.error || '发送失败')
      }
      const savedMessage = await response.json()
      setMessages((current) => [savedMessage, ...current])
      setText('')
      setError('')
    } catch (err) { setError(err.message) } finally { setIsSending(false) }
  }

  if (!isLoggedIn) {
    return (
      <main className='p-4 max-w-lg mx-auto'>
        <h1 className='text-2xl font-bold mb-4 text-center'>Cloudflare 聊天</h1>
        <div className={'login-card p-4 rounded bg-white ' + (showRegister ? 'show' : '')}>
          {showRegister ? (
            <RegisterForm onCancel={() => setShowRegister(false)} onRegister={register} />
          ) : (
            <LoginForm onLogin={login} onShowRegister={() => setShowRegister(true)} error={error} />
          )}
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
          <p className='skeleton' style={{height:24}}></p>
        ) : messages.length === 0 ? (
          <p>还没有消息，快来打个招呼吧！</p>
        ) : (
          messages.map((message) => (
            <article key={message.id ?? `${message.created_at}-${message.user}`} className='p-2 bg-gray-100 rounded message'>
              <b>{message.user}</b>: {message.content}
            </article>
          ))
        )}
      </div>
      <form className='flex gap-2' onSubmit={(e)=>{ e.preventDefault(); sendMessage() }}>
        <input className='border flex-1 p-2 rounded' value={text} onChange={(e)=>setText(e.target.value)} placeholder='输入消息...' maxLength={500} />
        <button className='bg-blue-500 text-white px-4 rounded' type='submit' disabled={!text.trim() || isSending}>{isSending ? '发送中...' : '发送'}</button>
      </form>
    </main>
  )
}

function LoginForm({ onLogin, onShowRegister, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  return (
    <form onSubmit={(e)=>{ e.preventDefault(); onLogin(username.trim(), password) }}>
      <h2 className='text-lg font-bold mb-2'>登录</h2>
      <input name='username' placeholder='用户名' className='border p-2 rounded w-full mb-2' maxLength={50} value={username} onChange={(e)=>setUsername(e.target.value)} />
      <input type='password' name='password' placeholder='密码' className='border p-2 rounded w-full mb-2' value={password} onChange={(e)=>setPassword(e.target.value)} />
      <div className='flex gap-2'>
        <button className='bg-blue-500 text-white px-4 rounded' type='submit'>登录</button>
        <button type='button' className='bg-gray-300 px-4 rounded' onClick={onShowRegister}>注册</button>
      </div>
      {error && <p className='text-red-600 mt-2'>{error}</p>}
    </form>
  )
}

function RegisterForm({ onCancel, onRegister }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const handle = (e) => {
    e.preventDefault()
    if (password !== confirm) { alert('两次密码不一致'); return }
    onRegister(username.trim(), password)
  }
  return (
    <form onSubmit={handle}>
      <h2 className='text-lg font-bold mb-2'>注册</h2>
      <input name='username' placeholder='用户名' className='border p-2 rounded w-full mb-2' maxLength={50} value={username} onChange={(e)=>setUsername(e.target.value)} />
      <input type='password' name='password' placeholder='密码（至少8位）' className='border p-2 rounded w-full mb-2' value={password} onChange={(e)=>setPassword(e.target.value)} />
      <input type='password' name='confirm' placeholder='确认密码' className='border p-2 rounded w-full mb-2' value={confirm} onChange={(e)=>setConfirm(e.target.value)} />
      <div className='flex gap-2'>
        <button className='bg-blue-500 text-white px-4 rounded' type='submit'>注册</button>
        <button type='button' className='bg-gray-300 px-4 rounded' onClick={onCancel}>取消</button>
      </div>
    </form>
  )
}
