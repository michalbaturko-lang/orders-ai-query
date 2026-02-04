import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function getSchemaInfo(): Promise<string> {
  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
  const { data: sample } = await supabase.from('orders').select('*').limit(3)
  return `Databaze obsahuje tabulku "orders" s ${count || 0} zaznamy.
Sloupce: id, country, code, order_date, status, currency, email, phone, bill_full_name, bill_company, bill_street, bill_city, bill_zip, bill_country, vat_id, delivery_full_name, delivery_street, delivery_city, delivery_zip, delivery_country, total_price, shipping_price, payment_method, shipping_method, notes, raw_data, created_at
Priklady dat: ${sample ? JSON.stringify(sample.slice(0, 2), null, 2) : 'Zadna data'}`
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 })

    const schemaInfo = await getSchemaInfo()
    const sqlResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `Jsi expert na databaze. ${schemaInfo}
Uzivatelsky dotaz: "${query}"
Vygeneruj JSON: {"select": "sloupce", "filters": [{"column": "x", "operator": "eq|gt|lt|like|ilike", "value": "y"}], "order": {"column": "x", "ascending": true}, "limit": 50, "aggregation": null|{"type": "count|sum|avg", "column": "x", "groupBy": "y"}}
Odpovez POUZE validnim JSON.` }]
    })

    const sqlText = sqlResponse.content[0].type === 'text' ? sqlResponse.content[0].text : ''
    let queryConfig
    try {
      const jsonMatch = sqlText.match(/\{[\s\S]*\}/)
      queryConfig = jsonMatch ? JSON.parse(jsonMatch[0]) : { select: '*', filters: [], limit: 20 }
    } catch { queryConfig = { select: '*', filters: [], limit: 20 } }

    let results: any[] = []
    if (queryConfig.aggregation) {
      const agg = queryConfig.aggregation
      if (agg.type === 'count' && !agg.groupBy) {
        const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })
        results = [{ pocet: count || 0 }]
      } else if (agg.groupBy) {
        const { data } = await supabase.from('orders').select(queryConfig.select || '*')
        if (data) {
          const grouped = new Map<string, { count: number; sum: number }>()
          for (const row of data) {
            const key = (row as any)[agg.groupBy] || 'Unknown'
            const current = grouped.get(key) || { count: 0, sum: 0 }
            current.count++
            if (agg.column && (row as any)[agg.column]) current.sum += parseFloat((row as any)[agg.column]) || 0
            grouped.set(key, current)
          }
          results = Array.from(grouped.entries()).map(([key, value]) => ({
            [agg.groupBy]: key, pocet: value.count,
            ...(agg.type === 'sum' ? { suma: Math.round(value.sum * 100) / 100 } : {}),
            ...(agg.type === 'avg' ? { prumer: Math.round((value.sum / value.count) * 100) / 100 } : {})
          })).sort((a, b) => b.pocet - a.pocet)
        }
      }
    } else {
      let dbQuery = supabase.from('orders').select(queryConfig.select || '*')
      if (queryConfig.filters) {
        for (const f of queryConfig.filters) {
          if (f.operator === 'eq') dbQuery = dbQuery.eq(f.column, f.value)
          else if (f.operator === 'gt') dbQuery = dbQuery.gt(f.column, f.value)
          else if (f.operator === 'lt') dbQuery = dbQuery.lt(f.column, f.value)
          else if (f.operator === 'like') dbQuery = dbQuery.like(f.column, `%${f.value}%`)
          else if (f.operator === 'ilike') dbQuery = dbQuery.ilike(f.column, `%${f.value}%`)
        }
      }
      if (queryConfig.order) dbQuery = dbQuery.order(queryConfig.order.column, { ascending: queryConfig.order.ascending ?? true })
      dbQuery = dbQuery.limit(queryConfig.limit || 50)
      const { data, error } = await dbQuery
      if (error) return NextResponse.json({ answer: `Chyba: ${error.message}`, results: [] })
      results = data || []
    }

    const answerResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: `Uzivatel se ptal: "${query}"
Vysledky (${results.length} zaznamu): ${JSON.stringify(results.slice(0, 10), null, 2)}
Odpovez kratce v cestine.` }]
    })

    const answer = answerResponse.content[0].type === 'text' ? answerResponse.content[0].text : 'Nemohu zpracovat odpoved.'
    return NextResponse.json({ answer, results: results.slice(0, 100) })
  } catch (error: any) {
    console.error('Query error:', error)
    return NextResponse.json({ answer: `Chyba: ${error.message}`, results: [] }, { status: 500 })
  }
}
