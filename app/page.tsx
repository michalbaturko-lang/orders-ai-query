'use client'

import { useState, useRef, useEffect } from 'react'

interface UploadedFile {
  id: number
  filename: string
  records_count: number
  columns: string[]
  sample_data: Record<string, any>[]
  uploaded_at: string
}

export default function Home() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [queryLoading, setQueryLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [recordCount, setRecordCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [expandedFile, setExpandedFile] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/count')
      const data = await res.json()
      if (data.totalRecords > 0) {
        setRecordCount(data.totalRecords)
        setDataLoaded(true)
      }
      if (data.files && data.files.length > 0) {
        setUploadedFiles(data.files)
      }
    } catch (e) {
      console.error('Failed to fetch data:', e)
    }
  }

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
        await fetchData()
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Nahráno ${data.totalRecords} záznamů do databáze`
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Chyba: ${data.error}` }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Chyba při nahrávání souboru' }])
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleClearData = async () => {
    if (!confirm('Opravdu chcete smazat všechna data z databáze?')) return
    try {
      const res = await fetch('/api/clear', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setRecordCount(0)
        setDataLoaded(false)
        setUploadedFiles([])
        setExpandedFile(null)
        setMessages([{ role: 'assistant', content: 'Databáze byla vymazána' }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Chyba při mazání dat' }])
    }
  }

  const handleQuery = async () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: input }])
    setInput('')
    setQueryLoading(true)
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: input })
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || data.error || 'Žádná odpověď'
      }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Chyba při zpracování dotazu' }])
    }
    setQueryLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '20px', marginBottom: '20px', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Orders AI Query</h1>
          <p style={{ margin: '5px 0 0', opacity: 0.7 }}>Nahrávejte CSV/Excel soubory a ptejte se v češtině</p>
        </div>

        {dataLoaded && (
          <div style={{ background: '#d4edda', color: '#155724', padding: '12px 20px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>✓ Načteno {recordCount.toLocaleString('cs-CZ')} záznamů</span>
            <button onClick={handleClearData} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>🗑️ Smazat data</button>
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: uploadedFiles.length > 0 ? '15px' : '0' }}>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xls" multiple onChange={handleUpload} style={{ display: 'none' }} id="file-upload" />
            <label htmlFor="file-upload" style={{ background: uploading ? '#6c757d' : '#28a745', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              {uploading ? (<><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> Nahrávám...</>) : (<>📁 {dataLoaded ? 'Přidat další soubory' : 'Nahrát soubory'}</>)}
            </label>
            <span style={{ color: '#666', fontSize: '14px' }}>CSV, XLS, XLSX</span>
          </div>

          {uploadedFiles.length > 0 && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Nahrané soubory (klikněte pro náhled):</div>
              {uploadedFiles.map((file) => (
                <div key={file.id} style={{ marginBottom: '10px' }}>
                  <div onClick={() => setExpandedFile(expandedFile === file.id ? null : file.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: expandedFile === file.id ? '#e9ecef' : '#f8f9fa', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
                    <span>📄 {file.filename}</span>
                    <span style={{ color: '#666' }}>{file.records_count} záznamů • {expandedFile === file.id ? '▲' : '▼'}</span>
                  </div>
                  {expandedFile === file.id && file.columns && (
                    <div style={{ background: '#f8f9fa', padding: '10px', borderRadius: '0 0 4px 4px', fontSize: '12px', overflowX: 'auto' }}>
                      <div style={{ marginBottom: '8px', color: '#666' }}>Sloupce: {file.columns.join(', ')}</div>
                      {file.sample_data && file.sample_data.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr>{file.columns.slice(0, 6).map((col, i) => (<th key={i} style={{ border: '1px solid #ddd', padding: '4px', background: '#e9ecef', textAlign: 'left' }}>{col}</th>))}</tr>
                          </thead>
                          <tbody>
                            {file.sample_data.slice(0, 3).map((row, i) => (
                              <tr key={i}>{file.columns.slice(0, 6).map((col, j) => (<td key={j} style={{ border: '1px solid #ddd', padding: '4px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(row[col] || '')}</td>))}</tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', minHeight: '300px', maxHeight: '400px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {messages.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
              {dataLoaded ? 'Položte dotaz k datům...' : 'Nejprve nahrajte soubor s daty'}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
              <div style={{ background: msg.role === 'user' ? '#667eea' : '#f0f0f0', color: msg.role === 'user' ? 'white' : 'black', padding: '10px 15px', borderRadius: '18px', maxWidth: '80%', whiteSpace: 'pre-wrap' }}>
                {msg.role === 'assistant' && <span style={{ marginRight: '8px' }}>🤖</span>}
                {msg.content}
              </div>
            </div>
          ))}
          {queryLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
              <div style={{ background: '#f0f0f0', padding: '10px 15px', borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>🤖</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ animation: 'bounce 0.6s infinite', animationDelay: '0s' }}>●</span>
                  <span style={{ animation: 'bounce 0.6s infinite', animationDelay: '0.2s' }}>●</span>
                  <span style={{ animation: 'bounce 0.6s infinite', animationDelay: '0.4s' }}>●</span>
                </div>
                <span style={{ color: '#666', fontSize: '14px' }}>Zpracovávám dotaz...</span>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '15px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && !queryLoading && handleQuery()} placeholder={dataLoaded ? "Zeptejte se na data..." : "Nejprve nahrajte soubor"} disabled={!dataLoaded || queryLoading} style={{ flex: 1, padding: '12px 15px', border: '2px solid #eee', borderRadius: '8px', fontSize: '16px', outline: 'none' }} />
          <button onClick={handleQuery} disabled={!dataLoaded || queryLoading || !input.trim()} style={{ background: (!dataLoaded || queryLoading || !input.trim()) ? '#ccc' : '#667eea', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: (!dataLoaded || queryLoading || !input.trim()) ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {queryLoading ? '⏳' : '➤'}
          </button>
        </div>
      </div>
      <style jsx>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
