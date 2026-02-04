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
