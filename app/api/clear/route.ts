import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function DELETE() {
  try {
    // Delete all records from orders table
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .neq('id', 0) // Delete all rows

    if (ordersError) throw ordersError

    // Delete all records from uploaded_files table
    const { error: filesError } = await supabase
      .from('uploaded_files')
      .delete()
      .neq('id', 0) // Delete all rows

    if (filesError) throw filesError

    return NextResponse.json({
      success: true,
      message: 'All data cleared successfully'
    })
  } catch (error) {
    console.error('Clear API error:', error)
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}






