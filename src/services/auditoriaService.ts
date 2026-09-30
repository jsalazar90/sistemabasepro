import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isUUID, getLocal, setLocal } from './storageHelper';

// ============================================================================
// 22. SISTEMA DE AUDITORÍA FORENSE (AUDIT LOGS)
// ============================================================================

export interface AuditoriaLogEntry {
  id: string;
  empresa_id: string;
  tabla: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  registro_id?: string;
  usuario_id?: string;
  usuario_email?: string;
  valores_anteriores?: any;
  valores_nuevos?: any;
  detalles?: string;
  created_at: string;
}

export async function dbFetchAuditoriaLogs(empresaId: string, limit: number = 100): Promise<AuditoriaLogEntry[]> {
  const cid = empresaId || 'default';
  if (isSupabaseConfigured && supabase && isUUID(empresaId)) {
    try {
      const { data, error } = await supabase
        .from('auditoria_logs')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!error && data) {
        await setLocal(`erp_local_audit_logs_${cid}`, data);
        return data;
      }
      if (error) {
        console.warn('Error fetching auditoria_logs Supabase:', error.message);
      }
    } catch (err) {
      console.error('Exception fetching audit logs:', err);
    }
  }

  // Local fallback
  const local = await getLocal<AuditoriaLogEntry[]>(`erp_local_audit_logs_${cid}`, []);
  return local || [];
}







