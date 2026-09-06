import { supabase, isSupabaseConfigured } from './supabase';

export const BUCKET_NAME = 'expedientes';

export interface UploadResult {
  url: string;
  nombre: string;
  error?: string;
}

/**
 * Sube un archivo a Supabase Storage en el bucket 'expedientes'.
 * Si Supabase no está configurado o falla, devuelve un Base64 DataURL como respaldo.
 */
export async function uploadDocumentoTransporte(
  file: File,
  folder: 'vehiculos' | 'choferes' | 'seguros' | 'logos' = 'vehiculos'
): Promise<UploadResult> {
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const filePath = `${folder}/${timestamp}_${cleanName}`;

  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
          contentType: file.type || 'application/pdf',
          cacheControl: '3600',
          upsert: true
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(filePath);

        return {
          url: publicUrlData.publicUrl,
          nombre: file.name
        };
      } else {
        console.warn('Fallo al subir a Supabase Storage, usando respaldo Base64:', error?.message);
      }
    } catch (err: any) {
      console.warn('Error de conexión a Storage, usando respaldo Base64:', err?.message || err);
    }
  }

  // Respaldo Base64
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        url: reader.result as string,
        nombre: file.name
      });
    };
    reader.onerror = () => {
      resolve({
        url: URL.createObjectURL(file),
        nombre: file.name,
        error: 'No se pudo leer el archivo'
      });
    };
    reader.readAsDataURL(file);
  });
}
