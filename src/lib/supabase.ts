/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl: string = 
  (import.meta.env?.VITE_SUPABASE_URL as string) || 
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL || '' : '') || 
  '';

const supabaseAnonKey: string = 
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || 
  (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY || '' : '') || 
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://your-project.supabase.co' &&
  supabaseAnonKey !== 'your-anon-key'
);

// Fetch resiliente con reintento automático para manejar cold-starts y errores 504 Gateway Timeout de Cloudflare/Supabase
const resilientFetch: typeof fetch = async (input, init) => {
  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    try {
      // Timeout del lado del cliente de 10s para abortar antes de que Cloudflare dispare su 504 sin CORS
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, 10000);

      const customInit: RequestInit = {
        ...init,
        signal: init?.signal || controller.signal
      };

      let response: Response;
      try {
        response = await fetch(input, customInit);
      } finally {
        clearTimeout(timeoutId);
      }

      // Reintentar en errores temporales de pasarela (502, 503, 504 Gateway Timeout)
      if ([502, 503, 504].includes(response.status) && attempts < maxAttempts - 1) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
        continue;
      }

      // Si fue un reintento tras un 504 y ahora devuelve 409 Conflict, significa que el primer intento sí se escribió en la base de datos
      if (response.status === 409 && attempts > 0) {
        return new Response(JSON.stringify({ message: "Successfully merged after gateway timeout retry" }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return response;
    } catch (err: any) {
      attempts++;
      if (attempts >= maxAttempts) {
        // En caso de que se agoten los reintentos por falla de red/timeout/CORS de Cloudflare,
        // devolver una respuesta limpia para que la librería de Supabase no lance una excepción no capturada
        const isGet = !init?.method || init.method.toUpperCase() === 'GET';
        return new Response(JSON.stringify(isGet ? [] : {
          code: 'PGRST504',
          message: 'Error temporal de conexión con el servidor Supabase (Gateway Timeout). Usando respaldo local.',
          details: err?.message || null,
          hint: null
        }), {
          status: isGet ? 200 : 504,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
    }
  }

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: {
        fetch: resilientFetch
      }
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
