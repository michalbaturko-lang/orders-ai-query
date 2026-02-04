import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseServiceKey)

export interface Order {
  id?: number
  country: string
  code?: string
  order_date?: string
  status?: string
  currency?: string
  email?: string
  phone?: string
  bill_full_name?: string
  bill_company?: string
  bill_street?: string
  bill_city?: string
  bill_zip?: string
  bill_country?: string
  vat_id?: string
  delivery_full_name?: string
  delivery_street?: string
  delivery_city?: string
  delivery_zip?: string
  delivery_country?: string
  total_price?: number
  shipping_price?: number
  payment_method?: string
  shipping_method?: string
  notes?: string
  raw_data?: Record<string, any>
  created_at?: string
}
