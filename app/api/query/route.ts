import { NextRequest, NextResponse } from 'next/server'

declare global { var ordersData: any[] | undefined }

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    if (!query) return NextResponse.json({ error: 'Chybí dotaz' }, { status: 400 })
    if (!global.ordersData || global.ordersData.length === 0) return NextResponse.json({ error: 'Nejprve nahrajte data' }, { status: 400 })
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Chybí API klíč' }, { status: 500 })
    const columns = Object.keys(global.ordersData[0])
    const sampleRow = global.ordersData[0]
    const systemPrompt = `Jsi analytický asistent. Data: ${global.ordersData.length} záznamů. Sloupce: ${columns.join(', ')}. Ukázka: ${JSON.stringify(sampleRow)}. Odpověz JSON: {"thinking":"..","code":"data.filter(...)","explanation":".."} Kód musí být výraz vracející pole. Limit 100.`
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, messages: [{ role: 'user', content: query }], system: systemPrompt })
    })
    if (!response.ok) return NextResponse.json({ error: 'Chyba API' }, { status: 500 })
    const claudeResponse = await response.json()
    const content = claudeResponse.content[0]?.text || ''
    let parsed
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0])
      else throw new Error('No JSON')
    } catch (e) { return NextResponse.json({ answer: content, results: [] }) }
    let results: any[] = []
    try {
      const data = global.ordersData
      const safeEval = new Function('data', `return ${parsed.code}`)
      results = safeEval(data)
      if (!Array.isArray(results)) results = [results]
      results = results.slice(0, 100)
    } catch (evalError: any) { return NextResponse.json({ answer: `Chyba: ${evalError.message}`, results: [] }) }
    return NextResponse.json({ answer: parsed.explanation || 'Hotovo', results })
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }) }
}
