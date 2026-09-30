import { get, set, del } from 'idb-keyval';
import { Company } from '../context/CompanyContext';
import { getTodayLocalDate } from '../utils/dateUtils';

export { getTodayLocalDate };

export const isUUID = (str?: string | null): boolean => 
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

// Helper IndexedDB storage con fallback seguro en memoria para Node / Vitest / SSR
const memoryStore = new Map<string, any>();
const hasIndexedDB = typeof indexedDB !== 'undefined';

export async function getLocal<T>(key: string, defaultVal: T): Promise<T> {
  if (!hasIndexedDB) {
    return memoryStore.has(key) ? memoryStore.get(key) : defaultVal;
  }
  try {
    const val = await get(key);
    return val !== undefined ? val : defaultVal;
  } catch {
    return memoryStore.has(key) ? memoryStore.get(key) : defaultVal;
  }
}

export async function setLocal<T>(key: string, val: T): Promise<void> {
  if (!hasIndexedDB) {
    memoryStore.set(key, val);
    return;
  }
  try {
    await set(key, val);
  } catch (e) {
    memoryStore.set(key, val);
    console.warn('Error saving to IndexedDB, using in-memory store:', e);
  }
}

export async function delLocal(key: string): Promise<void> {
  if (!hasIndexedDB) {
    memoryStore.delete(key);
    return;
  }
  try {
    await del(key);
  } catch {
    memoryStore.delete(key);
  }
}

export const DEFAULT_LOCAL_COMPANY: Company = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Mi Nueva Empresa',
  taxId: 'J-00000000-0',
  nombre: 'Mi Nueva Empresa',
  rif: 'J-00000000-0',
  direccion: '',
  telefono: '',
  email: '',
  logo: '',
  monedaPrincipal: 'USD',
  monedaSecundaria: 'VES',
  tipoContribuyente: 'ordinario',
  tipoEmpresa: 'comercial',
  anoInicio: String(new Date().getFullYear()),
  workingYear: String(new Date().getFullYear()),
  habilitarPOS: true,
  habilitarVendedores: true,
  habilitarPedidos: true,
  habilitarTasaReferencial: true,
};
