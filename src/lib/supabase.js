import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://scajdhjbbpyqiycpxvoa.supabase.co'
const supabaseKey = 'sb_publishable_mshImxB162N5y4UNtCLVng_phtqyVC1'

export const supabase = createClient(supabaseUrl, supabaseKey)