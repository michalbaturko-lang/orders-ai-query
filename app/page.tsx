'use client'
import { useState, useRef } from 'react'

export default function Home() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [recordCount, setRecordCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (e: any) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i])
    }

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        setDataLoaded(true)
        setRecordCount(data.totalRecords)
        setMessages([{ role: 'assistant', content: `Nahráno ${data.totalRecords} záznamů do databáze` }])
      } else {
        setMessages([{ role: 'assistant', content: `Chyba: ${data.error}` }])
      }
    } catch (err: any) {
      setMessages([{ role: 'assistant', content: `Chyba při nahrávání: ${err.message}` }])
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: any) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input
    setMessages(p => [...p, { role: 'user', content: userMessage }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage })
      })
      const data = await res.json()
      setMessages(p => [...p, { role: 'assistant', content: data.answer, data: data.results }])
    } catch (err: any) {
      setMessages(p => [...p, { role: 'assistant', content: `Chyba: ${err.message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: 20 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', background: 'white', borderRadius: 16, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ background: 'linear-gradient(90deg, #1a1a2e 0%, #16213e 100%)', padding: 24, color: 'white', borderRadius: '16px 16px 0 0' }}>
          <h1 style={{ margin: 0, fontSize: 28 }}>Orders AI Query</h1>
          <p style={{ margin: '8px 0 0', opacity: 0.8, fontSize: 14 }}>Nahrávejte CSV/Excel soubory a ptejte se v češtině</p>
        </div>

        {!dataLoaded && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ marginBottom: 20 }}>
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept=".xlsx,.csv,.xls"
              multiple
              hidden
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                background: uploading ? '#ccc' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '16px 40px',
                borderRadius: 8,
                cursor: uploading ? 'wait' : 'pointer',
                fontSize: 16,
                fontWeight: 600,
                transition: 'transform 0.2s'
              }}
            >
              {uploading ? 'Nahrávám...' : 'Nahrát soubory'}
            </button>
            <p style={{ marginTop: 16, color: '#666', fontSize: 14 }}>
              Podporované formáty: CSV, XLS, XLSX
            </p>
          </div>
        )}

        {dataLoaded && (
          <div style={{ padding: '12px 20px', background: 'linear-gradient(90deg, #d4edda 0%, #c3e6cb 100%)', borderBottom: '1px solid #b8daff' }}>
            <span style={{ color: '#155724', fontWeight: 500 }}>✓ Načteno {recordCount.toLocaleString()} záznamů</span>
          </div>
        )}

        <div style={{ height: 450, overflowY: 'auto', padding: 20 }}>
          {messages.length === 0 && dataLoaded && (
            <div style={{ textAlign: 'center', color: '#999', paddingTop: 40 }}>
              <p>Zadejte dotaz v češtině, např.:</p>
              <p style={{ fontStyle: 'italic' }}>"Kolik objednávek bylo z České republiky?"</p>
              <p style={{ fontStyle: 'italic' }}>"Ukaž mi top 10 zákazníků podle celkové ceny"</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 20 }}>
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: m.role === 'user' ? '#667eea' : '#1a1a2e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 14,
                  fontWeight: 600,
                  flexShrink: 0
                }}>
                  {m.role === 'user' ? 'Vy' : 'AI'}
                </div>
                <div style={{
                  background: m.role === 'user' ? '#667eea' : '#f8f9fa',
                  color: m.role === 'user' ? 'white' : '#333',
                  padding: '12px 16px',
                  borderRadius: 12,
                  maxWidth: '80%'
                }}>
                  {m.content}
                </div>
              </div>
              {m.data?.length > 0 && (
                <div style={{ marginTop: 12, marginLeft: 48, overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', background: 'white', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    <thead>
                      <tr style={{ background: '#f1f3f4' }}>
                        {Object.keys(m.data[0]).slice(0, 8).map(k => (
                          <th key={k} style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #dee2e6' }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {m.data.slice(0, 20).map((r: any, j: number) => (
                        <tr key={j} style={{ background: j % 2 === 0 ? 'white' : '#f8f9fa' }}>
                          {Object.values(r).slice(0, 8).map((v: any, k) => (
                            <td key={k} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>{String(v).substring(0, 50)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {m.data.length > 20 && <p style={{ fontSize: 12, color: '#666', marginTop: 8 }}>Zobrazeno 20 z {m.data.length} záznamů</p>}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 14 }}>AI</div>
              <div style={{ color: '#666' }}>Přemýšlím...</div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 20, borderTop: '1px solid #eee', display: 'flex', gap: 12 }}>
          <input value={input} onChange={e => setInput(e.target.value)} placeholder="Zadejte dotaz v češtině..." disabled={!dataLoaded || loading} style={{ flex: 1, padding: '14px 16px', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: 15, outline: 'none' }} />
          <button type="submit" disabled={!dataLoaded || loading || !input.trim()} style={{ background: (!dataLoaded || loading || !input.trim()) ? '#ccc' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', padding: '14px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: (!dataLoaded || loading || !input.trim()) ? 'not-allowed' : 'pointer' }}>Odeslat</button>
        </form>
      </div>
    </div>
  )
}
