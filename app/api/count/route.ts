import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
    })
  } catch (error) {
    console.error('Count API error:', error)
    return NextResponse.json(
      { error: 'Failed to get data count' },
      { status: 500 }
    )
  }
}
