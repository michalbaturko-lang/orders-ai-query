import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { dataSource, cityFilter, limit = 100 } = await request.json()

    let tableName = 'orders'
    if (dataSource === 'orders_cz') tableName = 'orders_cz'
    else if (dataSource === 'orders_sk') tableName = 'orders_sk'

    // For orders_cz/sk, we need to get unique orders by code with highest value
    if (tableName === 'orders_cz' || tableName === 'orders_sk') {
      const pageSize = 1000
      let offset = 0
      let hasMore = true
      const orderMap = new Map<string, any>()

      while (hasMore) {
        let query = supabase
          .from(tableName)
          .select('code, date, billcity, deliverycity, totalpricewithvat, email, billfullname, statusname')

        if (cityFilter) {
          query = query.or(`billcity.ilike.%${cityFilter}%,deliverycity.ilike.%${cityFilter}%`)
        }

        const { data, error } = await query.range(offset, offset + pageSize - 1)

        if (error || !data || data.length === 0) {
          hasMore = false
        } else {
          for (const row of data) {
            const existing = orderMap.get(row.code)
            if (!existing || (row.totalpricewithvat && parseFloat(row.totalpricewithvat) > parseFloat(existing.totalpricewithvat || '0'))) {
              orderMap.set(row.code, {
                code: row.code,
                date: row.date,
                billcity: row.billcity,
                deliverycity: row.deliverycity,
                totalpricewithvat: row.totalpricewithvat,
                email: row.email,
                billfullname: row.billfullname,
                statusname: row.statusname
              })
            }
          }
          offset += pageSize
          hasMore = data.length === pageSize
        }
      }

      // Sort by total price and take top N
      const sortedOrders = Array.from(orderMap.values())
        .sort((a, b) => parseFloat(b.totalpricewithvat || '0') - parseFloat(a.totalpricewithvat || '0'))
        .slice(0, limit)

      return NextResponse.json({
        orders: sortedOrders,
        count: sortedOrders.length,
        totalUniqueOrders: orderMap.size,
        filter: cityFilter || 'all'
      })
    } else {
      let query = supabase
        .from(tableName)
        .select('*')
        .order('total_price', { ascending: false })
        .limit(limit)

      const { data, error } = await query
      if (error) throw error

      return NextResponse.json({
        orders: data || [],
        count: data?.length || 0
      })
    }
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
