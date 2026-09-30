/**
 * Fachada Unificada de Servicios de Base de Datos y Persistencia
 * Halley ERP Pro
 * 
 * Re-exporta todos los servicios por dominio para garantizar 100% de compatibilidad
 * con imports existentes, permitiendo además imports modulares y code-splitting eficiente.
 */

export * from './storageHelper';
export * from './empresaService';
export * from './contactosService';
export * from './usuariosService';
export * from './contabilidadService';
export * from './bancosService';
export * from './cxcCxpService';
export * from './inventarioService';
export * from './facturacionService';
export * from './activosFijosService';
export * from './auditoriaService';
export * from './syncQueueService';
