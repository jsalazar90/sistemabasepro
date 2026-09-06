/**
 * Tipos TypeScript Fuertemente Tipados para el Esquema Relacional de Base de Datos
 * Sistema ERP Administrativo y Contable NIIF
 */

export type TipoContribuyente = 'ordinario' | 'especial' | 'formal';
export type TipoEmpresa = 'comercial' | 'servicios' | 'manufacturera' | 'mixta';
export type RoleUsuario = 'Master' | 'SuperAdmin' | 'Contador' | 'Operador' | 'Vendedor';
export type NaturalezaCuenta = 'Deudora' | 'Acreedora';
export type TipoCuenta = 'Movimiento' | 'Grupo';
export type GrupoCuenta = 'Activo' | 'Pasivo' | 'Patrimonio' | 'Ingresos' | 'Costos' | 'Gastos';
export type TipoDocumento = 'factura' | 'nota_entrega' | 'cotizacion';
export type EstadoDocumento = 'Pendiente' | 'Cobrada' | 'Parcial' | 'Anulada' | 'Contabilizado';

export interface EmpresaModel {
  id: string;
  nombre: string;
  rif: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  logo?: string;
  moneda_principal: string;
  moneda_secundaria: string;
  tipo_contribuyente: TipoContribuyente;
  tipo_empresa: TipoEmpresa;
  habilitar_pos: boolean;
  habilitar_vendedores: boolean;
  habilitar_pedidos: boolean;
  habilitar_tasa_referencial?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UsuarioModel {
  id: string;
  email: string;
  password_hash?: string;
  nombre?: string;
  role: RoleUsuario;
  activo: boolean;
  created_at?: string;
}

export interface UsuarioEmpresaModel {
  id: string;
  usuario_id: string;
  empresa_id: string;
  role: RoleUsuario;
  vendedor_id?: string;
  vendedor_nombre?: string;
  permissions: Record<string, { view: boolean; create: boolean; delete: boolean }>;
  activo: boolean;
  created_at?: string;
}

export interface CuentaContableModel {
  id: string;
  empresa_id: string;
  codigo: string;
  nombre: string;
  tipo: TipoCuenta;
  naturaleza: NaturalezaCuenta;
  grupo: GrupoCuenta;
  nivel: number;
  cuenta_padre_id?: string;
  saldo_actual: number;
  activo: boolean;
  created_at?: string;
}

export interface ComprobanteDiarioModel {
  id: string;
  empresa_id: string;
  numero: string;
  fecha: string;
  tipo: string;
  descripcion: string;
  referencia?: string;
  total: number;
  estado: 'Contabilizado' | 'Borrador' | 'Anulado' | 'Descuadrado';
  created_by?: string;
  created_at?: string;
  lineas?: LineaComprobanteModel[];
}

export interface LineaComprobanteModel {
  id: string;
  comprobante_id: string;
  cuenta_id: string;
  descripcion?: string;
  debe: number;
  haber: number;
  orden?: number;
}

export interface ContactoModel {
  id: string;
  empresa_id: string;
  name: string;
  tax_id: string;
  type: 'aliados' | 'customer' | 'freelance' | 'supplier' | 'airline' | 'employee' | 'empleados' | 'agentes' | 'travel_agent' | 'intercompany' | 'shareholder' | 'both';
  email?: string;
  phone?: string;
  address?: string;
  tipo_contribuyente: TipoContribuyente;
  saldo: number;
  saldo_cxp?: number;
  debit_account?: string;
  credit_account?: string;
  expense_account?: string;
  employee_type?: string;
  comision_porcentaje?: number;
  codigo_iata?: string;
  codigo_dos_letras?: string;
  terminal_agente?: string;
  terminalAgente?: string;
  activo: boolean;
  created_at?: string;
}

export interface BancoModel {
  id: string;
  empresa_id: string;
  banco: string;
  numero_cuenta: string;
  moneda: 'Bolivares' | 'Dolares' | 'Euros';
  saldo: number;
  tasa: number;
  cuenta_contable_id?: string;
  activo: boolean;
  created_at?: string;
}

export interface MovimientoBancoModel {
  id: string;
  empresa_id: string;
  banco_id: string;
  fecha: string;
  ref?: string;
  descripcion: string;
  tipo: 'ingreso' | 'egreso' | 'transferencia';
  monto: number;
  tasa: number;
  comprobante_id?: string;
  estado: 'conciliado' | 'cuarentena' | 'anulado';
  notas?: string;
  created_at?: string;
}

export interface FacturaVentaModel {
  id: string;
  empresa_id: string;
  numero: string;
  tipo_documento: TipoDocumento;
  cliente_id: string;
  cliente_nombre: string;
  cliente_rif?: string;
  vendedor_id?: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  moneda: string;
  tasa_cambio: number;
  subtotal: number;
  base_imponible: number;
  monto_exento: number;
  iva_porcentaje: number;
  iva_monto: number;
  igtf_monto: number;
  total: number;
  saldo_pendiente: number;
  estado: EstadoDocumento;
  comprobante_id?: string;
  notas?: string;
  created_at?: string;
}

export interface CuentaCobrarCxcModel {
  id: string;
  empresa_id: string;
  factura_id: string;
  cliente_id: string;
  cliente: string;
  categoria: string;
  fecha: string;
  vencimiento: string;
  descripcion?: string;
  tipo: 'factura' | 'saldo_inicial' | 'anticipo';
  total: number;
  saldo: number;
  moneda: string;
  tasa: number;
  created_at?: string;
}

export interface CobranzaModel {
  id: string;
  empresa_id: string;
  recibo_numero: string;
  cliente_id: string;
  cliente_nombre: string;
  fecha: string;
  monto_total: number;
  banco_id?: string;
  comprobante_id?: string;
  retencion_iva?: number;
  retencion_islr?: number;
  diferencial_cambiario?: number;
  detalles?: Array<{ cxc_id: string; monto_abonado: number }>;
  notas?: string;
  created_at?: string;
}

export interface CuentaPagarCxpModel {
  id: string;
  empresa_id: string;
  factura_id: string;
  proveedor_id: string;
  proveedor: string;
  categoria: string;
  fecha: string;
  vencimiento: string;
  descripcion?: string;
  tipo: 'factura' | 'saldo_inicial' | 'anticipo';
  total: number;
  saldo: number;
  moneda: string;
  tasa: number;
  created_at?: string;
}

export interface PagoRealizadoModel {
  id: string;
  empresa_id: string;
  comprobante_pago: string;
  proveedor_id: string;
  proveedor_nombre: string;
  fecha: string;
  monto_total: number;
  banco_id?: string;
  comprobante_id?: string;
  retencion_iva?: number;
  retencion_islr?: number;
  diferencial_cambiario?: number;
  detalles?: Array<{ cxp_id: string; monto_abonado: number }>;
  notas?: string;
  created_at?: string;
}

export interface ServicioModel {
  id: string;
  empresa_id: string;
  nombre: string;
  codigo?: string;
  descripcion?: string;
  precio: number;
  tipo: 'Servicio' | 'Producto';
  exento_iva: boolean;
  cuenta_ingreso_id?: string;
  cuenta_costo_id?: string;
  activo: boolean;
  created_at?: string;
}

export interface ActivoFijoModel {
  id: string;
  empresa_id: string;
  codigo: string;
  nombre: string;
  categoria?: string;
  fecha_adquisicion: string;
  valor_compra: number;
  vida_util_meses: number;
  depreciacion_acumulada: number;
  cuenta_activo_id?: string;
  cuenta_gasto_deprec_id?: string;
  estado: 'Activo' | 'Desincorporado' | 'Depreciado';
  created_at?: string;
}

export interface ConfiguracionContableModel {
  id: string;
  empresa_id: string;
  cuenta_inventario?: string;
  cuenta_costo_ventas?: string;
  cuenta_ventas: string;
  cuenta_gastos: string;
  cuenta_anticipo_recibido?: string;
  cuenta_anticipo_otorgado?: string;
  cuenta_cxc: string;
  cuenta_cxp: string;
  cuenta_debito_fiscal: string;
  cuenta_credito_fiscal?: string;
  cuenta_iva_retenido_ventas?: string;
  cuenta_iva_retenido_compras?: string;
  cuenta_islr_retenido_ventas?: string;
  cuenta_islr_retenido_compras?: string;
  cuenta_ganancia_diferencial: string;
  cuenta_perdida_diferencial: string;
  cuenta_utilidad_anteriores?: string;
  mes_cierre: string;
  working_year: string;
  
  iva: number;
  igtf: number;
  retencion_iva: number;
  retencion_islr: number;
  
  prefijo_factura?: string;
  correlativo_factura: string;
  prefijo_cotizacion?: string;
  correlativo_cotizacion: string;
  prefijo_nota_entrega?: string;
  correlativo_nota_entrega: string;
  prefijo_recibo?: string;
  correlativo_recibo: string;
  
  dias_vencimiento_default: number;
  notas_default?: string;
  comision_mode: 'emitidas' | 'cobradas';
  active_service_template: string;
  active_inventory_template: string;
  
  usa_maquina_fiscal: boolean;
  marca_maquina_fiscal?: string;
  puerto_maquina_fiscal?: string;
  formato_impresion?: string;
  updated_at?: string;
}

export interface PlantillaDocumentoModel {
  id: string;
  empresa_id: string;
  nombre: string;
  tipo: 'servicios' | 'inventario';
  diseno_json: Record<string, any>;
  es_predeterminada: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AuditoriaConfiguracionModel {
  id: string;
  empresa_id: string;
  usuario_email: string;
  seccion: string;
  cambio_detalle: Record<string, any>;
  ip_origen?: string;
  created_at?: string;
}

export type TipoSolicitudBanco = 'confirmacion_ingreso' | 'solicitud_pago';
export type EstadoSolicitudBanco = 'pendiente' | 'confirmada' | 'pagada' | 'rechazada';

export interface SolicitudBancoModel {
  id: string;
  empresa_id?: string;
  tipo: TipoSolicitudBanco;
  estado: EstadoSolicitudBanco;
  fecha: string;
  fecha_requerida?: string;
  contacto_id?: string;
  contacto_nombre?: string;
  contacto_tipo?: string;
  banco_id?: string;
  banco_nombre?: string;
  monto: number;
  moneda: string;
  tasa?: number;
  monto_ves?: number;
  referencia: string;
  metodo_pago: string;
  descripcion: string;
  categoria_concepto?: string;
  comprobante_adjunto?: string;
  
  // Datos bancarios de destino para pagos
  datos_pago_beneficiario?: {
    banco_destino?: string;
    cuenta_destino?: string;
    titular?: string;
    identificacion?: string;
    pago_movil?: string;
    zelle_email?: string;
  };

  // Resolución por tesorería
  fecha_resolucion?: string;
  usuario_resolucion?: string;
  banco_resolucion_id?: string;
  referencia_resolucion?: string;
  nota_resolucion?: string;
  movimiento_banco_id?: string;
  comprobante_contable_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface EmisionBoletoModel {
  id: string;
  empresa_id: string;
  numero_ticket: string;
  fare: number;
  tax: number;
  fee: number;
  comision: number;
  net: number;
  metodo_pago?: string;
  transaccion?: string;
  localizador: string;
  ruta: string;
  pasajero: string;
  categoria?: string;
  grupo_tarifario?: string;
  aerolinea?: string;
  clase?: string;
  telefono?: string;
  correo?: string;
  tipo_transaccion?: string;
  agencia_emisor?: string;
  agente_emisor?: string;
  terminal_agente?: string;
  fecha: string;
  estado?: 'emitido' | 'anulado' | 'reembolsado' | 'procesado';
  created_at?: string;
  updated_at?: string;
}
