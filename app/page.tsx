'use client'

import { useState, useRef, useEffect } from 'react'

interface UploadedFile {
  name: string
  records: number
  uploadedAt: string
}

export default function Home() {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [queryLoading, setQueryLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [recordCount, setRecordCount] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load record count on mount
  useEffect(() => {
    fetchRecordCount()
  }, [])

  const fetchRecordCount = async () => {
    try {
      const res = await fetch('/api/count')
      const data = await res.json()
      if (data.count > 0) {
        setRecordCount(data.count)
        setDataLoaded(true)
      }
    } catch (e) {
      console.error('Failed to fetch count:', e)
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
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      
      if (data.success) {
        // Add to uploaded files list
        const newFiles: UploadedFile[] = []
        for (let i = 0; i < files.length; i++) {
          newFiles.push({
            name: files[i].name,
            records: Math.floor(data.totalRecords / files.length),
            uploadedAt: new Date().toLocaleString('cs-CZ')
          })
        }
        setUploadedFiles(prev => [...prev, ...newFiles])
        setRecordCount(prev => prev + data.totalRecords)
        setDataLoaded(true)
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Nahráno ${data.totalRecords} záznamů do databáze` 
        }])
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Chyba: ${data.error}` 
        }])
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Chyba při nahrávání souboru' 
      }])
    }
    
    setUploading(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClearData = async () => {
    if (!confirm('Opravdu chcete smazat všechna data z databáze?')) return
    
    try {
      const res = await fetch('/api/clear', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        setRecordCount(0)
        setDataLoaded(false)
        setUploadedFiles([])
        setMessages([{ role: 'assistant', content: 'Databáze byla vymazána' }])
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Chyba při mazání dat' }])
    }
  }

  const handleQuery = async () => {
    if (!input.trim()) return

    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
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
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Chyba při zpracování dotazu'
      }])
    }
    
    setQueryLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        {/* Header */}
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '20px', marginBottom: '20px', color: 'white' }}>
          <h1 style={{ margin: 0, fontSize: '24px' }}>Orders AI Query</h1>
          <p style={{ margin: '5px 0 0', opacity: 0.7 }}>Nahrávejte CSV/Excel soubory a ptejte se v češtině</p>
        </div>

        {/* Status bar */}
        {dataLoaded && (
          <div style={{ 
            background: '#d4edda', 
            color: '#155724', 
            padding: '12px 20px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>✓ Načteno {recordCount.toLocaleString('cs-CZ')} záznamů</span>
            <button
              onClick={handleClearData}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🗑️ Smazat data
            </button>
          </div>
        )}

        {/* File upload section */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '20px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: uploadedFiles.length > 0 ? '15px' : '0' }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.xls"
              multiple
              onChange={handleUpload}
              style={{ display: 'none' }}
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              style={{
                background: uploading ? '#6c757d' : '#28a745',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {uploading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                  Nahrávám...
                </>
              ) : (
                <>📁 {dataLoaded ? 'Přidat další soubory' : 'Nahrát soubory'}</>
              )}
            </label>
            <span style={{ color: '#666', fontSize: '14px' }}>CSV, XLS, XLSX</span>
          </div>

          {/* Uploaded files list */}
          {uploadedFiles.length > 0 && (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Nahrané soubory:</div>
              {uploadedFiles.map((file, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f8f9fa',
                  borderRadius: '4px',
                  marginBottom: '5px',
                  fontSize: '14px'
                }}>
                  <span>📄 {file.name}</span>
                  <span style={{ color: '#666' }}>{file.records} záznamů • {file.uploadedAt}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat messages */}
        <div style={{ 
          background: 'white', 
          borderRadius: '12px', 
          padding: '20px', 
          marginBottom: '20px',
          minHeight: '300px',
          maxHeight: '400px',
          overflowY: 'auto',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {messages.length === 0 && (
            <div style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
              {dataLoaded ? 'Položte dotaz k datům...' : 'Nejprve nahrajte soubor s daty'}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: '12px'
            }}>
              <div style={{
                background: msg.role === 'user' ? '#667eea' : '#f0f0f0',
                color: msg.role === 'user' ? 'white' : 'black',
                padding: '10px 15px',
                borderRadius: '18px',
                maxWidth: '80%',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.role === 'assistant' && <span style={{ marginRight: '8px' }}>🤖</span>}
                {msg.content}
              </div>
            </div>
          ))}
          
          {/* Loading indicator */}
          {queryLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                background: '#f0f0f0',
                padding: '10px 15px',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
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

        {/* Input */}
        <div style={{ 
          display: 'flex', 
          gap: '10px',
          background: 'white',
          padding: '15px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !queryLoading && handleQuery()}
            placeholder={dataLoaded ? "Zeptejte se na data..." : "Nejprve nahrajte soubor"}
            disabled={!dataLoaded || queryLoading}
            style={{
              flex: 1,
              padding: '12px 15px',
              border: '2px solid #eee',
              borderRadius: '8px',
              fontSize: '16px',
              outline: 'none'
            }}
          />
          <button
            onClick={handleQuery}
            disabled={!dataLoaded || queryLoading || !input.trim()}
            style={{
              background: (!dataLoaded || queryLoading || !input.trim()) ? '#ccc' : '#667eea',
              color: 'white',
              border: 'none',
              padding: '12px 25px',
              borderRadius: '8px',
              cursor: (!dataLoaded || queryLoading || !input.trim()) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {queryLoading ? '⏳' : '➤'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
