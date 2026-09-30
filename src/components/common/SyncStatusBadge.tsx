import React, { useState, useEffect } from 'react';
import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff, UploadCloud } from 'lucide-react';
import { isSupabaseConfigured, testSupabaseConnection } from '../../lib/supabase';
import { getPendingCount, processSyncQueue } from '../../services/syncQueueService';

export default function SyncStatusBadge() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('Verificando conexión...');

  const refreshPending = async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      setPendingCount(0);
    }
  };

  const checkConnectionAndSync = async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setIsDbConnected(false);
      setStatusMessage('Modo sin conexión. Las mutaciones se encolan en IndexedDB local.');
      await refreshPending();
      return;
    }

    setIsOnline(true);

    if (!isSupabaseConfigured) {
      setIsDbConnected(false);
      setStatusMessage('Supabase no configurado. Operando en almacenamiento local.');
      await refreshPending();
      return;
    }

    setIsChecking(true);
    try {
      const result = await testSupabaseConnection();
      setIsDbConnected(result.success);

      if (result.success) {
        // Si hay conexión y registros en cola, procesarlos
        const count = await getPendingCount();
        if (count > 0) {
          setIsSyncing(true);
          setStatusMessage(`Sincronizando ${count} operaciones pendientes...`);
          const syncRes = await processSyncQueue();
          await refreshPending();
          setStatusMessage(
            syncRes.remaining === 0
              ? 'En línea. Todas las operaciones sincronizadas con la nube.'
              : `Sincronizados ${syncRes.processed}. Restan ${syncRes.remaining} pendientes.`
          );
        } else {
          setStatusMessage('En línea. Sincronizado con Supabase en la nube.');
        }
      } else {
        setStatusMessage(`Almacenamiento local activo. (${result.message})`);
        await refreshPending();
      }
    } catch {
      setIsDbConnected(false);
      setStatusMessage('Sin respuesta del servidor. Operando en modo local seguro.');
      await refreshPending();
    } finally {
      setIsChecking(false);
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    checkConnectionAndSync();
    refreshPending();

    const handleOnline = () => {
      setIsOnline(true);
      checkConnectionAndSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDbConnected(false);
      setStatusMessage('Sin conexión a internet. Guardando en cola local.');
      refreshPending();
    };

    const handleQueueUpdate = (e: any) => {
      if (typeof e.detail?.pendingCount === 'number') {
        setPendingCount(e.detail.pendingCount);
      } else {
        refreshPending();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('erp_sync_queue_updated', handleQueueUpdate);

    // Verificación periódica cada 2 minutos
    const intervalId = setInterval(() => {
      checkConnectionAndSync();
    }, 2 * 60 * 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('erp_sync_queue_updated', handleQueueUpdate);
      clearInterval(intervalId);
    };
  }, []);

  const isFullyConnected = isOnline && isDbConnected;

  return (
    <button
      onClick={checkConnectionAndSync}
      disabled={isChecking || isSyncing}
      className={`hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs active:scale-95 ${
        pendingCount > 0
          ? 'bg-amber-500/10 border-amber-300 text-amber-800 hover:bg-amber-500/20'
          : isFullyConnected
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700 hover:bg-emerald-100/80'
          : isOnline
          ? 'bg-amber-50/80 border-amber-200 text-amber-700 hover:bg-amber-100/80'
          : 'bg-rose-50/80 border-rose-200 text-rose-700 hover:bg-rose-100/80'
      }`}
      title={`${statusMessage} (Clic para forzar sincronización)`}
    >
      <span className="relative flex h-2 w-2">
        {pendingCount > 0 ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </>
        ) : isFullyConnected ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </>
        ) : isOnline ? (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
        )}
      </span>

      {isChecking || isSyncing ? (
        <RefreshCw size={13} className="animate-spin text-slate-500" />
      ) : pendingCount > 0 ? (
        <UploadCloud size={14} className="text-amber-600 shrink-0" />
      ) : isFullyConnected ? (
        <Cloud size={14} className="text-emerald-600 shrink-0" />
      ) : isOnline ? (
        <Wifi size={14} className="text-amber-600 shrink-0" />
      ) : (
        <WifiOff size={14} className="text-rose-600 shrink-0" />
      )}

      <span className="text-[11px] font-extrabold tracking-tight hidden md:inline">
        {isChecking 
          ? 'Comprobando...' 
          : isSyncing
          ? 'Sincronizando...'
          : pendingCount > 0
          ? `${pendingCount} pendiente${pendingCount > 1 ? 's' : ''}`
          : isFullyConnected 
          ? 'Nube Sincronizada' 
          : isOnline 
          ? 'Modo Local (IndexedDB)' 
          : 'Sin Conexión'}
      </span>

      {pendingCount > 0 && !isSyncing && (
        <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-2xs">
          {pendingCount}
        </span>
      )}
    </button>
  );
}
