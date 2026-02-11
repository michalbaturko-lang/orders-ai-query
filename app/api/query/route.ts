import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

async function getSchemaInfo(tableName: string): Promise<string> {
  const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true })
  const { data: sample } = await supabase.from(tableName).select('*').limit(3)

  let columns = ''
  let dataStructureInfo = ''

  if (tableName === 'orders') {
    columns = 'id, country, code, order_date, status, currency, email, phone, bill_full_name, bill_company, bill_street, bill_city, bill_zip, bill_country, vat_id, delivery_full_name, delivery_street, delivery_city, delivery_zip, delivery_country, total_price, shipping_price, payment_method, shipping_method, notes, created_at'
    dataStructureInfo = 'Kazdy radek = jedna objednavka.'
  } else if (tableName === 'orders_cz' || tableName === 'orders_sk') {
    columns = 'id, code, date, statusname, currency, exchangerate, email, phone, billfullname, billcompany, billstreet, billhousenumber, billcity, billzip, billcountryname, companyid, vatid, deliveryfullname, deliverycompany, deliverystreet, deliveryhousenumber, deliverycity, deliveryzip, deliverycountryname, totalpricewithvat, totalpricewithoutvat, pricetopay, amountpaid, paid, itemname, itemamount, itemcode, itemvariantname, itemunitpricewithvat, sourcename'
    dataStructureInfo = `DULEZITA STRUKTURA DAT:
- Kazdy radek je POLOZKA objednavky, NE cela objednavka!
- Sloupec "code" identifikuje objednavku - stejny code = stejna objednavka
- Jedna objednavka (code) ma vice radku = vice polozek
- Pro pocet OBJEDNAVEK pouzij aggregation s "countDistinct": "code"
- Pro pocet RADKU/POLOZEK pouzij obycejny "count"
- Sloupec "date" = datum objednavky (format: YYYY-MM-DD)
- Sloupec "itemname" = nazev produktu/polozky
- Data obsahuji objednavky z VICE LET (2020-2025)`
  }

  return `Databaze obsahuje tabulku "${tableName}" s ${count || 0} radky.
${dataStructureInfo}
Sloupce: ${columns}
DULEZITE: Nepouzivej sloupec raw_data!
Priklady dat: ${sample ? JSON.stringify(sample.slice(0, 2), null, 2) : 'Zadna data'}`
}

export async function POST(request: NextRequest) {
  try {
    const { query, dataSource } = await request.json()
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 })

    let tableName = 'orders'
    if (dataSource === 'orders_cz') tableName = 'orders_cz'
    else if (dataSource === 'orders_sk') tableName = 'orders_sk'

    const schemaInfo = await getSchemaInfo(tableName)
    const sqlResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `Jsi expert na databaze. ${schemaInfo}
Uzivatelsky dotaz: "${query}"
Vygeneruj JSON: {"select": "sloupce", "filters": [{"column": "x", "operator": "eq|gt|lt|like|ilike|gte|lte", "value": "y"}], "order": {"column": "x", "ascending": true}, "random": false, "limit": 50, "aggregation": null|{"type": "count|countDistinct|sum|avg", "column": "x", "groupBy": "y"}}
Pro pocet OBJEDNAVEK (ne radku) pouzij "type": "countDistinct", "column": "code"
Pro filtrovani podle roku pouzij "gte" a "lte" na sloupec "date", napr. filters: [{"column": "date", "operator": "gte", "value": "2024-01-01"}, {"column": "date", "operator": "lte", "value": "2024-12-31"}]
Pro nahodne razeni pouzij "random": true.
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

      // Build base query with filters for aggregations
      let baseQuery: any = supabase.from(tableName).select(agg.column || 'code')
      if (queryConfig.filters) {
        for (const f of queryConfig.filters) {
          if (f.column === 'raw_data') continue
          if (f.operator === 'eq') baseQuery = baseQuery.eq(f.column, f.value)
          else if (f.operator === 'gt') baseQuery = baseQuery.gt(f.column, f.value)
          else if (f.operator === 'gte') baseQuery = baseQuery.gte(f.column, f.value)
          else if (f.operator === 'lt') baseQuery = baseQuery.lt(f.column, f.value)
          else if (f.operator === 'lte') baseQuery = baseQuery.lte(f.column, f.value)
          else if (f.operator === 'like') baseQuery = baseQuery.like(f.column, `%${f.value}%`)
          else if (f.operator === 'ilike') baseQuery = baseQuery.ilike(f.column, `%${f.value}%`)
        }
      }

      if (agg.type === 'countDistinct' && agg.column) {
        // Count unique values (e.g., unique order codes)
        const { data } = await baseQuery
        if (data) {
          const uniqueValues = new Set(data.map((row: any) => row[agg.column]))
          results = [{ pocet_objednavek: uniqueValues.size }]
        }
      } else if (agg.type === 'count' && !agg.groupBy) {
        const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true })
        results = [{ pocet_radku: count || 0 }]
      } else if (agg.groupBy) {
        const { data } = await baseQuery.select(queryConfig.select || '*')
        if (data) {
          const grouped = new Map<string, { count: number; sum: number; uniqueCodes: Set<string> }>()
          for (const row of data) {
            const key = (row as any)[agg.groupBy] || 'Unknown'
            const current = grouped.get(key) || { count: 0, sum: 0, uniqueCodes: new Set() }
            current.count++
            if ((row as any).code) current.uniqueCodes.add((row as any).code)
            if (agg.column && (row as any)[agg.column]) current.sum += parseFloat((row as any)[agg.column]) || 0
            grouped.set(key, current)
          }
          results = Array.from(grouped.entries()).map(([key, value]) => ({
            [agg.groupBy]: key,
            pocet_objednavek: value.uniqueCodes.size,
            pocet_polozek: value.count,
            ...(agg.type === 'sum' ? { suma: Math.round(value.sum * 100) / 100 } : {}),
            ...(agg.type === 'avg' ? { prumer: Math.round((value.sum / value.count) * 100) / 100 } : {})
          })).sort((a, b) => b.pocet_objednavek - a.pocet_objednavek)
        }
      }
    } else {
      let dbQuery: any = supabase.from(tableName).select(queryConfig.select || '*')
      if (queryConfig.filters) {
        for (const f of queryConfig.filters) {
          if (f.column === 'raw_data') continue
          if (f.operator === 'eq') dbQuery = dbQuery.eq(f.column, f.value)
          else if (f.operator === 'gt') dbQuery = dbQuery.gt(f.column, f.value)
          else if (f.operator === 'gte') dbQuery = dbQuery.gte(f.column, f.value)
          else if (f.operator === 'lt') dbQuery = dbQuery.lt(f.column, f.value)
          else if (f.operator === 'lte') dbQuery = dbQuery.lte(f.column, f.value)
          else if (f.operator === 'like') dbQuery = dbQuery.like(f.column, `%${f.value}%`)
          else if (f.operator === 'ilike') dbQuery = dbQuery.ilike(f.column, `%${f.value}%`)
        }
      }
      if (queryConfig.order && queryConfig.order.column && !queryConfig.order.column.includes('(')) {
        dbQuery = dbQuery.order(queryConfig.order.column, { ascending: queryConfig.order.ascending ?? true })
      }
      const fetchLimit = queryConfig.random ? Math.max((queryConfig.limit || 50) * 3, 500) : (queryConfig.limit || 50)
      dbQuery = dbQuery.limit(fetchLimit)
      const { data, error } = await dbQuery
      if (error) return NextResponse.json({ answer: `Chyba: ${error.message}`, results: [] })
      results = data || []
      if (queryConfig.random && results.length > 0) {
        for (let i = results.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [results[i], results[j]] = [results[j], results[i]]
        }
        results = results.slice(0, queryConfig.limit || 50)
      }
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
