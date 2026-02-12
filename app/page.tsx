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
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [expandedFile, setExpandedFile] = useState<number | null>(null)
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [dataSource, setDataSource] = useState<string>('files')
  const [supabaseTableCount, setSupabaseTableCount] = useState<{orders_cz: number, orders_sk: number}>({orders_cz: 0, orders_sk: 0})
  const [exporting, setExporting] = useState(false)
  const [exportResults, setExportResults] = useState<any[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/count')
      const data = await res.json()
      if (data.totalRecords > 0) { setRecordCount(data.totalRecords); setDataLoaded(true) }
      if (data.files && data.files.length > 0) { setUploadedFiles(data.files) }
      if (data.supabaseTables) {
        setSupabaseTableCount(data.supabaseTables)
        if (data.supabaseTables.orders_cz > 0 || data.supabaseTables.orders_sk > 0) { setDataLoaded(true) }
      }
    } catch (e) { console.error('Failed to fetch data:', e) }
  }

  const handleUpload = async (e: any) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true); setUploadProgress(0)
    const formData = new FormData()
    for (let i = 0; i < files.length; i++) { formData.append('files', files[i]) }
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (event) => { if (event.lengthComputable) { setUploadProgress(Math.round((event.loaded / event.total) * 100)) } })
    xhr.addEventListener('load', async () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText)
          if (data.success) { await fetchData(); setMessages(prev => [...prev, { role: 'assistant', content: `Nahráno ${data.totalRecords} záznamů` }]) }
          else { setMessages(prev => [...prev, { role: 'assistant', content: `Chyba: ${data.error}` }]) }
        } catch { setMessages(prev => [...prev, { role: 'assistant', content: 'Chyba při zpracování' }]) }
      } else { setMessages(prev => [...prev, { role: 'assistant', content: `Chyba: ${xhr.status}` }]) }
      setUploading(false); setUploadProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    })
    xhr.addEventListener('error', () => { setMessages(prev => [...prev, { role: 'assistant', content: 'Spojení selhalo' }]); setUploading(false) })
    xhr.open('POST', '/api/upload'); xhr.send(formData)
  }

  const handleClearData = async () => {
    if (!confirm('Smazat všechna data?')) return
    const res = await fetch('/api/clear', { method: 'DELETE' })
    const data = await res.json()
    if (data.success) { setRecordCount(0); setDataLoaded(false); setUploadedFiles([]); setMessages([{ role: 'assistant', content: 'Vymazáno' }]) }
  }

  const handleQuery = async () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, { role: 'user', content: input }]); setInput(''); setQueryLoading(true)
    const res = await fetch('/api/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: input, fileId: selectedFileId, dataSource }) })
    const data = await res.json()
    setMessages(prev => [...prev, { role: 'assistant', content: data.answer || data.error || 'Žádná odpověď' }])
    setQueryLoading(false)
  }

  const handleExport = async (cityFilter?: string) => {
    setExporting(true)
    setExportResults(null)
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataSource, cityFilter, limit: 1000 })
      })
      const data = await res.json()
      if (data.orders) {
        setExportResults(data.orders)
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Export dokončen: ${data.count} objednávek${cityFilter ? ` z města "${cityFilter}"` : ''} (celkem ${data.totalUniqueOrders?.toLocaleString('cs-CZ') || '?'} unikátních objednávek)`
        }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: `Chyba exportu: ${data.error}` }])
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Chyba: ${e.message}` }])
    }
    setExporting(false)
  }

  const downloadCSV = () => {
    if (!exportResults || exportResults.length === 0) return
    const headers = Object.keys(exportResults[0])
    const csv = [
      headers.join(';'),
      ...exportResults.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(';'))
    ].join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export_top1000_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const hasData = dataLoaded || supabaseTableCount.orders_cz > 0 || supabaseTableCount.orders_sk > 0

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '20px', marginBottom: '20px', color: 'white' }}>
          <h1 style={{ margin: 0 }}>RM Database Tool</h1>
          <p style={{ margin: '5px 0 0', opacity: 0.7 }}>Nahrávejte CSV/Excel soubory a ptejte se v češtině</p>
        </div>

        {(uploadedFiles.length > 0 || supabaseTableCount.orders_cz > 0 || supabaseTableCount.orders_sk > 0) && (
          <div style={{ background: '#1a1a2e', color: 'white', padding: '15px 20px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '10px' }}>Zdroj dat:</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '15px' }}>
              {uploadedFiles.length > 0 && <button onClick={() => setDataSource('files')} style={{ background: dataSource === 'files' ? '#28a745' : '#333', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>📁 Soubory ({recordCount.toLocaleString('cs-CZ')})</button>}
              {supabaseTableCount.orders_cz > 0 && <button onClick={() => setDataSource('orders_cz')} style={{ background: dataSource === 'orders_cz' ? '#28a745' : '#333', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>🇨🇿 CZ ({supabaseTableCount.orders_cz.toLocaleString('cs-CZ')})</button>}
              {supabaseTableCount.orders_sk > 0 && <button onClick={() => setDataSource('orders_sk')} style={{ background: dataSource === 'orders_sk' ? '#28a745' : '#333', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>🇸🇰 SK ({supabaseTableCount.orders_sk.toLocaleString('cs-CZ')})</button>}
            </div>
            {(dataSource === 'orders_cz' || dataSource === 'orders_sk') && (
              <div>
                <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '10px' }}>Export top 1000 objednávek dle ceny:</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button onClick={() => handleExport()} disabled={exporting} style={{ background: exporting ? '#555' : '#764ba2', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: exporting ? 'wait' : 'pointer' }}>{exporting ? '⏳ Exportuji...' : '📊 Top 1000 (vše)'}</button>
                  <button onClick={() => handleExport('Praha')} disabled={exporting} style={{ background: exporting ? '#555' : '#764ba2', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: exporting ? 'wait' : 'pointer' }}>{exporting ? '⏳ Exportuji...' : '📊 Top 1000 Praha'}</button>
                  {exportResults && exportResults.length > 0 && (
                    <button onClick={downloadCSV} style={{ background: '#28a745', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer' }}>💾 Stáhnout CSV</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xls" multiple onChange={handleUpload} style={{ display: 'none' }} id="file-upload" />
          <label htmlFor="file-upload" style={{ background: '#28a745', color: 'white', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' }}>📁 Nahrát soubory</label>
          {uploading && <div style={{ marginTop: '10px' }}><div style={{ background: '#e9ecef', borderRadius: '10px', height: '20px' }}><div style={{ background: '#28a745', height: '100%', width: `${uploadProgress}%`, borderRadius: '10px' }} /></div></div>}
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '20px', minHeight: '200px' }}>
          {messages.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: '40px' }}>{hasData ? 'Položte dotaz...' : 'Nahrajte soubor'}</div>}
          {messages.map((msg, i) => <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '12px' }}><div style={{ background: msg.role === 'user' ? '#667eea' : '#f0f0f0', color: msg.role === 'user' ? 'white' : 'black', padding: '10px 15px', borderRadius: '18px', maxWidth: '80%' }}>{msg.content}</div></div>)}
          {queryLoading && <div style={{ color: '#666' }}>Zpracovávám...</div>}
        </div>

        <div style={{ display: 'flex', gap: '10px', background: 'white', padding: '15px', borderRadius: '12px' }}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleQuery()} placeholder="Zeptejte se..." disabled={!hasData} style={{ flex: 1, padding: '12px', border: '2px solid #eee', borderRadius: '8px' }} />
          <button onClick={handleQuery} disabled={!hasData || !input.trim()} style={{ background: hasData && input.trim() ? '#667eea' : '#ccc', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: hasData && input.trim() ? 'pointer' : 'not-allowed' }}>➤</button>
        </div>

        {exportResults && exportResults.length > 0 && (
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', marginTop: '20px', overflowX: 'auto' }}>
            <h3 style={{ margin: '0 0 15px', color: '#333' }}>Top {exportResults.length} objednávek</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#667eea', color: 'white' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>#</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Kód</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Datum</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Zákazník</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Město</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Cena</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {exportResults.map((order, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#f9f9f9' : 'white', borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '8px 10px' }}>{i + 1}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{order.code}</td>
                    <td style={{ padding: '8px 10px' }}>{order.date}</td>
                    <td style={{ padding: '8px 10px' }}>{order.billfullname}</td>
                    <td style={{ padding: '8px 10px' }}>{order.billcity || order.deliverycity}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{parseFloat(order.totalpricewithvat || 0).toLocaleString('cs-CZ')} Kč</td>
                    <td style={{ padding: '8px 10px' }}>{order.statusname}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
