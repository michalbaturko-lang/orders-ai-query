import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { count: ordersCount, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    if (ordersError) throw ordersError

    const { data: files, error: filesError } = await supabase
      .from('uploaded_files')
      .select('*')
      .order('uploaded_at', { ascending: false })

    if (filesError) throw filesError

    // Get counts for CZ and SK tables
    let ordersCzCount = 0
    let ordersSkCount = 0

    try {
      const { count: czCount } = await supabase
        .from('orders_cz')
        .select('*', { count: 'exact', head: true })
      ordersCzCount = czCount || 0
    } catch (e) {
      // Table might not exist
    }

    try {
      const { count: skCount } = await supabase
        .from('orders_sk')
        .select('*', { count: 'exact', head: true })
      ordersSkCount = skCount || 0
    } catch (e) {
      // Table might not exist
    }

    return NextResponse.json({
      totalRecords: ordersCount || 0,
      files: files || [],
      supabaseTables: {
        orders_cz: ordersCzCount,
        orders_sk: ordersSkCount
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Count API error:', error)
    return NextResponse.json({
      totalRecords: 0,
      files: [],
      supabaseTables: { orders_cz: 0, orders_sk: 0 },
      error: 'Failed to fetch data'
    }, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  }
}import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const { count: ordersCount, error: ordersError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    if (ordersError) throw ordersError

    const { data: files, error: filesError } = await supabase
      .from('uploaded_files')
      .select('*')
      .order('uploaded_at', { ascending: false })

    if (filesError) throw filesError

    return NextResponse.json({
      totalRecords: ordersCount || 0,
      files: files || []
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Count API error:', error)
    return NextResponse.json({ 
      totalRecords: 0, 
      files: [],
      error: 'Failed to fetch data' 
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-store'
      }
    })
  }
}
