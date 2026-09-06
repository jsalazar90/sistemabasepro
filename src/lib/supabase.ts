/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

// Helper para verificar conexión activa a Supabase
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      message: 'Supabase no está configurado en el archivo .env (Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY).'
    };
  }

  try {
    const { error } = await supabase.from('empresas').select('id, nombre').limit(1);
    if (error) {
      // Si la tabla no existe aún, la conexión fue exitosa pero falta ejecutar schema.sql
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'Conectado a Supabase correctamente. Las tablas aún no han sido creadas (Ejecuta schema.sql en el SQL Editor).'
        };
      }
      return {
        success: false,
        message: `Error al consultar Supabase: ${error.message}`
      };
    }
    return {
      success: true,
      message: 'Conexión a la base de datos Supabase establecida y funcionando con éxito.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Error de red o conexión: ${err.message || err}`
    };
  }
}
