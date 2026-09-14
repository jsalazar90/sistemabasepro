import * as dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSample() {
  const empresaId = '490ee346-ca99-4562-8fe8-925ed24a8429';
  const { data } = await supabase
    .from('cuentas_contables')
    .select('id, codigo, nombre')
    .eq('empresa_id', empresaId)
    .limit(5);
  console.log('Sample accounts in Supabase:', data);
}

checkSample();
