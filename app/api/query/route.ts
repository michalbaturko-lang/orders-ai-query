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

DULEZITE PRAVIDLA:
- Pro pocet OBJEDNAVEK pouzij "type": "countDistinct", "column": "code"
- Pro filtrovani roku: filters [{"column": "date", "operator": "gte", "value": "YYYY-01-01"}, {"column": "date", "operator": "lte", "value": "YYYY-12-31"}]
- Pro NEJVETSI/NEJDRAZSI objednavky: order by "totalpricewithvat" ascending: false
- Pro NEJMENSI/NEJLEVNEJSI: order by "totalpricewithvat" ascending: true
- Pro nahodne razeni: "random": true
- Sloupec totalpricewithvat obsahuje celkovou cenu objednavky v Kc

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
        // Count unique values using pagination to get ALL data
        const uniqueValues = new Set<string>()
        const pageSize = 1000
        let offset = 0
        let hasMore = true

        while (hasMore) {
          let pageQuery: any = supabase.from(tableName).select(agg.column)

          // Apply filters
          if (queryConfig.filters) {
            for (const f of queryConfig.filters) {
              if (f.column === 'raw_data') continue
              if (f.operator === 'eq') pageQuery = pageQuery.eq(f.column, f.value)
              else if (f.operator === 'gt') pageQuery = pageQuery.gt(f.column, f.value)
              else if (f.operator === 'gte') pageQuery = pageQuery.gte(f.column, f.value)
              else if (f.operator === 'lt') pageQuery = pageQuery.lt(f.column, f.value)
              else if (f.operator === 'lte') pageQuery = pageQuery.lte(f.column, f.value)
              else if (f.operator === 'like') pageQuery = pageQuery.like(f.column, `%${f.value}%`)
              else if (f.operator === 'ilike') pageQuery = pageQuery.ilike(f.column, `%${f.value}%`)
            }
          }

          const { data, error } = await pageQuery.range(offset, offset + pageSize - 1)

          if (error || !data || data.length === 0) {
            hasMore = false
          } else {
            data.forEach((row: any) => {
              if (row[agg.column]) uniqueValues.add(row[agg.column])
            })
            offset += pageSize
            hasMore = data.length === pageSize
          }
        }

        results = [{ pocet_objednavek: uniqueValues.size }]
      } else if (agg.type === 'count' && !agg.groupBy) {
        const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true })
        results = [{ pocet_radku: count || 0 }]
      } else if (agg.groupBy) {
        // Use pagination for groupBy aggregations to get ALL data
        const grouped = new Map<string, { count: number; sum: number; uniqueCodes: Set<string> }>()
        const pageSize = 1000
        let offset = 0
        let hasMore = true
        const selectCols = agg.groupBy + ',code' + (agg.column ? ',' + agg.column : '')

        while (hasMore) {
          let pageQuery: any = supabase.from(tableName).select(selectCols)

          // Apply filters
          if (queryConfig.filters) {
            for (const f of queryConfig.filters) {
              if (f.column === 'raw_data') continue
              if (f.operator === 'eq') pageQuery = pageQuery.eq(f.column, f.value)
              else if (f.operator === 'gt') pageQuery = pageQuery.gt(f.column, f.value)
              else if (f.operator === 'gte') pageQuery = pageQuery.gte(f.column, f.value)
              else if (f.operator === 'lt') pageQuery = pageQuery.lt(f.column, f.value)
              else if (f.operator === 'lte') pageQuery = pageQuery.lte(f.column, f.value)
              else if (f.operator === 'like') pageQuery = pageQuery.like(f.column, `%${f.value}%`)
              else if (f.operator === 'ilike') pageQuery = pageQuery.ilike(f.column, `%${f.value}%`)
            }
          }

          const { data, error } = await pageQuery.range(offset, offset + pageSize - 1)

          if (error || !data || data.length === 0) {
            hasMore = false
          } else {
            for (const row of data) {
              const key = (row as any)[agg.groupBy] || 'Unknown'
              const current = grouped.get(key) || { count: 0, sum: 0, uniqueCodes: new Set() }
              current.count++
              if ((row as any).code) current.uniqueCodes.add((row as any).code)
              if (agg.column && (row as any)[agg.column]) current.sum += parseFloat((row as any)[agg.column]) || 0
              grouped.set(key, current)
            }
            offset += pageSize
            hasMore = data.length === pageSize
          }
        }

        results = Array.from(grouped.entries()).map(([key, value]) => ({
          [agg.groupBy]: key,
          pocet_objednavek: value.uniqueCodes.size,
          pocet_polozek: value.count,
          ...(agg.type === 'sum' ? { suma: Math.round(value.sum * 100) / 100 } : {}),
          ...(agg.type === 'avg' ? { prumer: Math.round((value.sum / value.count) * 100) / 100 } : {})
        })).sort((a, b) => b.pocet_objednavek - a.pocet_objednavek)
      }
    } else {
      // Special handling for price ordering - fetch more data and sort in JS because price is stored as string
      const isPriceOrder = queryConfig.order?.column === 'totalpricewithvat' || queryConfig.order?.column === 'totalpricewithoutvat' || queryConfig.order?.column === 'pricetopay'

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

      // For price ordering, fetch ALL data and sort properly
      if (isPriceOrder) {
        const allResults: any[] = []
        const pageSize = 1000
        let offset = 0
        let hasMore = true

        while (hasMore) {
          let pageQuery: any = supabase.from(tableName).select(queryConfig.select || '*')
          if (queryConfig.filters) {
            for (const f of queryConfig.filters) {
              if (f.column === 'raw_data') continue
              if (f.operator === 'eq') pageQuery = pageQuery.eq(f.column, f.value)
              else if (f.operator === 'gte') pageQuery = pageQuery.gte(f.column, f.value)
              else if (f.operator === 'lte') pageQuery = pageQuery.lte(f.column, f.value)
              else if (f.operator === 'ilike') pageQuery = pageQuery.ilike(f.column, `%${f.value}%`)
            }
          }
          const { data, error } = await pageQuery.range(offset, offset + pageSize - 1)
          if (error || !data || data.length === 0) {
            hasMore = false
          } else {
            allResults.push(...data)
            offset += pageSize
            hasMore = data.length === pageSize
          }
        }

        // Get unique orders by code, keeping highest price
        const orderMap = new Map<string, any>()
        for (const row of allResults) {
          const existing = orderMap.get(row.code)
          const rowPrice = parseFloat(row.totalpricewithvat || row.totalpricewithoutvat || '0')
          const existingPrice = existing ? parseFloat(existing.totalpricewithvat || existing.totalpricewithoutvat || '0') : 0
          if (!existing || rowPrice > existingPrice) {
            orderMap.set(row.code, row)
          }
        }

        // Sort by price numerically
        const priceCol = queryConfig.order.column
        results = Array.from(orderMap.values())
          .sort((a, b) => {
            const priceA = parseFloat(a[priceCol] || '0')
            const priceB = parseFloat(b[priceCol] || '0')
            return queryConfig.order.ascending ? priceA - priceB : priceB - priceA
          })
          .slice(0, queryConfig.limit || 50)
      } else {
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
