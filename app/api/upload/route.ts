import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabase, Order } from '@/lib/supabase'

const columnMapping: Record<string, keyof Order> = {
  'kod': 'code', 'code': 'code', 'objednavka': 'code', 'order': 'code', 'order_number': 'code', 'cislo_objednavky': 'code',
  'datum': 'order_date', 'date': 'order_date', 'order_date': 'order_date', 'datum_objednavky': 'order_date', 'created': 'order_date', 'created_at': 'order_date',
  'stav': 'status', 'status': 'status', 'state': 'status',
  'mena': 'currency', 'currency': 'currency',
  'email': 'email', 'e-mail': 'email', 'mail': 'email',
  'telefon': 'phone', 'phone': 'phone', 'tel': 'phone', 'mobil': 'phone',
  'jmeno': 'bill_full_name', 'name': 'bill_full_name', 'full_name': 'bill_full_name', 'billing_name': 'bill_full_name', 'fakturacni_jmeno': 'bill_full_name',
  'firma': 'bill_company', 'company': 'bill_company', 'spolecnost': 'bill_company',
  'ulice': 'bill_street', 'street': 'bill_street', 'adresa': 'bill_street', 'address': 'bill_street',
  'mesto': 'bill_city', 'city': 'bill_city', 'obec': 'bill_city',
  'psc': 'bill_zip', 'zip': 'bill_zip', 'postal_code': 'bill_zip',
  'zeme': 'bill_country', 'country': 'bill_country', 'stat': 'bill_country',
  'ico': 'vat_id', 'dic': 'vat_id', 'vat_id': 'vat_id', 'vat': 'vat_id',
  'dorucovaci_jmeno': 'delivery_full_name', 'delivery_name': 'delivery_full_name',
  'dorucovaci_ulice': 'delivery_street', 'delivery_street': 'delivery_street',
  'dorucovaci_mesto': 'delivery_city', 'delivery_city': 'delivery_city',
  'dorucovaci_psc': 'delivery_zip', 'delivery_zip': 'delivery_zip',
  'dorucovaci_zeme': 'delivery_country', 'delivery_country': 'delivery_country',
  'celkem': 'total_price', 'total': 'total_price', 'total_price': 'total_price', 'cena': 'total_price', 'price': 'total_price', 'castka': 'total_price',
  'doprava': 'shipping_price', 'shipping': 'shipping_price', 'shipping_price': 'shipping_price', 'postovne': 'shipping_price',
  'platba': 'payment_method', 'payment': 'payment_method', 'payment_method': 'payment_method', 'zpusob_platby': 'payment_method',
  'doprava_metoda': 'shipping_method', 'shipping_method': 'shipping_method', 'zpusob_dopravy': 'shipping_method',
  'poznamka': 'notes', 'notes': 'notes', 'note': 'notes', 'komentar': 'notes',
}

function detectCountryFromFilename(filename: string): string {
  const lowerName = filename.toLowerCase()
  if (lowerName.includes('cz') || lowerName.includes('czech')) return 'CZ'
  if (lowerName.includes('sk') || lowerName.includes('slovak')) return 'SK'
  if (lowerName.includes('hu') || lowerName.includes('hungary') || lowerName.includes('magyar')) return 'HU'
  if (lowerName.includes('ro') || lowerName.includes('roman')) return 'RO'
  if (lowerName.includes('pl') || lowerName.includes('poland') || lowerName.includes('polsk')) return 'PL'
  if (lowerName.includes('de') || lowerName.includes('german') || lowerName.includes('nemec')) return 'DE'
  if (lowerName.includes('at') || lowerName.includes('austria') || lowerName.includes('rakous')) return 'AT'
  return 'XX'
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function mapRowToOrder(row: Record<string, any>, country: string): Order {
  const order: Order = { country, raw_data: row }
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined || value === '') continue
    const normalizedKey = normalizeColumnName(key)
    const mappedField = columnMapping[normalizedKey] || columnMapping[key.toLowerCase()]
    if (mappedField) {
      if (mappedField === 'total_price' || mappedField === 'shipping_price') {
        const numValue = parseFloat(String(value).replace(/[^\d.-]/g, ''))
        if (!isNaN(numValue)) (order as any)[mappedField] = numValue
      } else if (mappedField === 'order_date') {
        if (value instanceof Date) order.order_date = value.toISOString()
        else if (typeof value === 'number') {
          const date = XLSX.SSF.parse_date_code(value)
          if (date) order.order_date = new Date(date.y, date.m - 1, date.d).toISOString()
        } else order.order_date = String(value)
      } else (order as any)[mappedField] = String(value)
    }
  }
  return order
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0)
      return NextResponse.json({ success: false, error: 'No files uploaded' }, { status: 400 })

    let totalRecords = 0
    const errors: string[] = []
    const uploadedFiles: Array<{ filename: string; records: number }> = []

    for (const file of files) {
      try {
        const country = detectCountryFromFilename(file.name)
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        
        let fileRecords = 0
        let allColumns: string[] = []
        let sampleData: Record<string, any>[] = []

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          if (jsonData.length === 0) continue

          // Collect columns from first row
          if (jsonData.length > 0 && allColumns.length === 0) {
            allColumns = Object.keys(jsonData[0] as Record<string, any>)
          }

          // Collect sample data (first 5 rows)
          if (sampleData.length < 5) {
            sampleData = jsonData.slice(0, 5) as Record<string, any>[]
          }

          const orders = jsonData.map(row => mapRowToOrder(row as Record<string, any>, country))
          const batchSize = 500
          for (let i = 0; i < orders.length; i += batchSize) {
            const batch = orders.slice(i, i + batchSize)
            const { error } = await supabase.from('orders').insert(batch)
            if (error) {
              console.error('Supabase insert error:', error)
              errors.push(`Error inserting batch from ${file.name}: ${error.message}`)
            } else {
              totalRecords += batch.length
              fileRecords += batch.length
            }
          }
        }

        // Save file metadata to uploaded_files table
        const { error: fileError } = await supabase.from('uploaded_files').insert({
          filename: file.name,
          records_count: fileRecords,
          columns: allColumns,
          sample_data: sampleData
        })

        if (fileError) {
          console.error('Error saving file metadata:', fileError)
          errors.push(`Error saving metadata for ${file.name}: ${fileError.message}`)
        }

        uploadedFiles.push({ filename: file.name, records: fileRecords })
      } catch (err: any) {
        console.error('File processing error:', err)
        errors.push(`Error processing ${file.name}: ${err.message}`)
      }
    }

    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      totalRecords: count || totalRecords,
      filesProcessed: files.length,
      uploadedFiles,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
