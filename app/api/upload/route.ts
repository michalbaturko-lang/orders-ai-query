import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

declare global { var ordersData: any[] | undefined }

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    if (!files || files.length === 0) return NextResponse.json({ error: 'No files' }, { status: 400 })
    let allRecords: any[] = []
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const normalized = data.map((row: any) => {
          const n: any = {}
          for (const key of Object.keys(row)) {
            const nKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_')
            n[nKey] = row[key]
          }
          n._source = file.name
          return n
        })
        allRecords = allRecords.concat(normalized)
      }
    }
    global.ordersData = allRecords
    return NextResponse.json({ success: true, filesProcessed: files.length, totalRecords: allRecords.length, columns: allRecords.length > 0 ? Object.keys(allRecords[0]) : [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ hasData: !!global.ordersData, recordCount: global.ordersData?.length || 0 })
}
