'use client'
import { useState, useRef } from 'react'

export default function Home() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [recordCount, setRecordCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: any) => {
    const files = e.target.files
    if (!files) return
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) formData.append('files', files[i])
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (data.success) {
      setDataLoaded(true)
      setRecordCount(data.totalRecords)
      setMessages([{ role: 'assistant', content: 'Nahrano ' + data.totalRecords + ' zaznamu' }])
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    setMessages(p => [...p, { role: 'user', content: input }])
    setInput('')
    setLoading(true)
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: input }) })
    const data = await res.json()
    setMessages(p => [...p, { role: 'assistant', content: data.answer, data: data.results }])
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#667eea', padding: 20 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', background: 'white', borderRadius: 16 }}>
        <div style={{ background: '#1a1a2e', padding: 24, color: 'white' }}><h1>Orders AI Query</h1></div>
        {!dataLoaded && <div style={{ padding: 40, textAlign: 'center' }}>
          <input type="file" ref={fileInputRef} onChange={handleUpload} accept=".xlsx" multiple hidden />
          <button onClick={() => fileInputRef.current?.click()} style={{ background: '#667eea', color: 'white', border: 'none', padding: '16px 32px', borderRadius: 8, cursor: 'pointer' }}>Nahrat Excel</button>
        </div>}
        {dataLoaded && <div style={{ padding: 12, background: '#e8f5e9' }}>Nacteno {recordCount} zaznamu</div>}
        <div style={{ height: 400, overflowY: 'auto', padding: 20 }}>
          {messages.map((m, i) => <div key={i} style={{ marginBottom: 16 }}><b>{m.role}:</b> {m.content}
            {m.data?.length > 0 && <table style={{ marginTop: 8, fontSize: 11 }}><thead><tr>{Object.keys(m.data[0]).map(k => <th key={k}>{k}</th>)}</tr></thead><tbody>{m.data.slice(0,20).map((r: any, j: number) => <tr key={j}>{Object.values(r).map((v: any, k) => <td key={k}>{String(v)}</td>)}</tr>)}</tbody></table>}
          </div>)}
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', gap: 12 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Dotaz..." disabled={!dataLoaded} style={{ flex: 1, padding: 12, border: '1px solid #ccc', borderRadius: 8 }} />
          <button type="submit" disabled={!dataLoaded || loading} style={{ background: '#667eea', color: 'white', border: 'none', padding: '12px 24px', borderRadius: 8 }}>Odeslat</button>
        </form>
      </div>
    </div>
  )
}
