import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')

    // Fetch all orders
    let query = supabase.from('orders').select('*')

    // Note: File filtering would require file_id column in orders table
    // For now, we export all orders

    const { data: orders, error } = await query

    if (error) {
      console.error('Export error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 })
    }

    // Prepare data for Excel - remove raw_data to keep file clean
    const exportData = orders.map(order => {
      const { raw_data, ...cleanOrder } = order
      return cleanOrder
    })

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(exportData)

    // Auto-size columns
    const maxWidth = 50
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.min(maxWidth, Math.max(
        key.length,
        ...exportData.slice(0, 100).map(row =>
          String((row as any)[key] || '').length
        )
      ))
    }))
    worksheet['!cols'] = colWidths

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data')

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="export-${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Cache-Control': 'no-store'
      }
    })
  } catch (error: any) {
    console.error('Export error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
