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
  type: 'customer' | 'supplier' | 'employee' | 'empleados' | 'intercompany' | 'shareholder' | 'both' | 'aliados' | 'freelance';
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
  es_caja?: boolean;
  tipo_cuenta?: 'nacional' | 'internacional';
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

export interface FacturaItemModel {
  id: string;
  producto_id?: string;
  codigo?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  precio_unitario_bs?: number;
  exento: boolean;
  subtotal: number;
  subtotal_bs?: number;
  iva_monto: number;
  iva_monto_bs?: number;
  total: number;
  total_bs?: number;
  cuenta_ingreso_id?: string;
  cuenta_costo_id?: string;
  cuenta_inventario_id?: string;
}

export interface FacturaVentaModel {
  id: string;
  empresa_id: string;
  numero: string;
  control_numero?: string;
  tipo_documento: TipoDocumento;
  condicion: 'contado' | 'credito';
  dias_credito?: number;
  cliente_id: string;
  cliente_nombre: string;
  cliente_rif?: string;
  cliente_direccion?: string;
  cliente_telefono?: string;
  cliente_email?: string;
  vendedor_id?: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  moneda: string;
  moneda_presentacion?: string;
  tasa_cambio: number;
  items: FacturaItemModel[];
  subtotal: number;
  subtotal_bs?: number;
  base_imponible: number;
  base_imponible_bs?: number;
  monto_exento: number;
  monto_exento_bs?: number;
  iva_porcentaje: number;
  iva_monto: number;
  iva_monto_bs?: number;
  igtf_porcentaje?: number;
  igtf_monto: number;
  igtf_monto_bs?: number;
  retencion_iva_porcentaje?: number;
  retencion_iva_monto?: number;
  retencion_iva_monto_bs?: number;
  comprobante_retencion_iva_numero?: string;
  comprobante_retencion_iva_fecha?: string;
  retencion_islr_porcentaje?: number;
  retencion_islr_monto?: number;
  retencion_islr_monto_bs?: number;
  comprobante_retencion_islr_numero?: string;
  comprobante_retencion_islr_fecha?: string;
  neto_cobrar?: number;
  neto_cobrar_bs?: number;
  total: number;
  total_bs?: number;
  saldo_pendiente: number;
  saldo_pendiente_bs?: number;
  estado: EstadoDocumento | 'emitida' | 'cobrada' | 'parcial' | 'anulada';
  banco_id?: string;
  comprobante_id?: string;
  cxc_id?: string;
  monto_recibido?: number;
  monto_recibido_bs?: number;
  vuelto?: number;
  vuelto_bs?: number;
  notas?: string;
  created_at?: string;
}

export interface FacturaCompraItemModel {
  id: string;
  producto_id?: string;
  codigo?: string;
  descripcion: string;
  unidad_medida?: string;
  almacen_id?: string;
  cantidad: number;
  costo_unitario: number;
  costo_unitario_bs?: number;
  exento: boolean;
  alicuota_iva?: number;
  subtotal: number;
  subtotal_bs?: number;
  iva_monto: number;
  iva_monto_bs?: number;
  total: number;
  total_bs?: number;
  actualizar_costo?: boolean;
  nuevo_precio_venta?: number;
  cuenta_inventario_id?: string;
  cuenta_gasto_id?: string;
}

export interface FacturaCompraModel {
  id: string;
  empresa_id: string;
  numero: string;
  control_numero?: string;
  tipo_documento: 'factura_compra' | 'nota_entrega' | 'nota_debito' | 'orden_compra' | 'servicio' | 'gasto';
  categoria_compra?: 'mercancia' | 'servicio';
  categoria_gasto?: string;
  cuenta_gasto_id?: string;
  concepto_gasto?: string;
  condicion: 'contado' | 'credito';
  dias_credito?: number;
  proveedor_id: string;
  proveedor_nombre: string;
  proveedor_rif?: string;
  proveedor_direccion?: string;
  proveedor_telefono?: string;
  proveedor_email?: string;
  almacen_destino_id?: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  moneda: string;
  moneda_presentacion?: string;
  tasa_cambio: number;
  items: FacturaCompraItemModel[];
  subtotal: number;
  subtotal_bs?: number;
  base_imponible: number;
  base_imponible_bs?: number;
  monto_exento: number;
  monto_exento_bs?: number;
  iva_porcentaje: number;
  iva_monto: number;
  iva_monto_bs?: number;
  igtf_porcentaje?: number;
  igtf_monto: number;
  igtf_monto_bs?: number;
  retencion_iva_porcentaje?: number;
  retencion_iva_monto?: number;
  retencion_iva_monto_bs?: number;
  retencion_islr_porcentaje?: number;
  retencion_islr_monto?: number;
  retencion_islr_monto_bs?: number;
  neto_pagar?: number;
  neto_pagar_bs?: number;
  total: number;
  total_bs?: number;
  saldo_pendiente: number;
  saldo_pendiente_bs?: number;
  estado: 'emitida' | 'pagada' | 'parcial' | 'anulada';
  banco_id?: string;
  metodo_pago?: string;
  terminal_id?: string;
  comprobante_id?: string;
  cxp_id?: string;
  notas?: string;
  created_at?: string;
}

export interface AlmacenModel {
  id: string;
  empresa_id: string;
  codigo: string;
  nombre: string;
  ubicacion?: string;
  responsable?: string;
  es_principal: boolean;
  activo: boolean;
  created_at?: string;
}

export interface ProductModel {
  id: string;
  empresa_id: string;
  codigo: string; // SKU
  codigo_barra?: string; // Código de barras EAN-13 / UPC
  referencia_fabrica?: string; // N° de parte / Referencia alterna
  nombre: string;
  descripcion?: string;
  categoria: string;
  subcategoria?: string;
  marca?: string;
  modelo?: string;
  unidad_medida: string;
  unidad_empaque?: string;
  factor_empaque?: number;
  ubicacion?: string; // Pasillo, Estante, etc.
  costo_unitario: number;
  costo_promedio?: number;
  precio_venta: number; // Precio 1 (Detal)
  precio_mayor?: number; // Precio 2 (Mayorista)
  precio_vip?: number; // Precio 3 (Especial / VIP)
  precio_minimo?: number; // Precio 4 (Mínimo autorizado)
  stock_actual: number;
  stock_minimo: number;
  stock_maximo?: number;
  punto_reorden?: number;
  almacen_id?: string;
  almacen_nombre?: string;
  aplica_iva: boolean;
  alicuota_iva?: 'general' | 'reducida' | 'suntuario' | 'exento';
  cuenta_inventario_id?: string;
  cuenta_costo_id?: string;
  cuenta_venta_id?: string;
  cuenta_ingreso_id?: string;
  activo: boolean;
  imagen_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CategoriaProductoModel {
  id: string;
  empresa_id?: string;
  codigo: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MovimientoInventarioModel {
  id: string;
  empresa_id: string;
  producto_id: string;
  producto_nombre: string;
  producto_codigo?: string;
  tipo: 'entrada' | 'salida' | 'ajuste_positivo' | 'ajuste_negativo' | 'venta' | 'compra' | 'transferencia';
  almacen_origen_id?: string;
  almacen_destino_id?: string;
  cantidad: number;
  stock_anterior: number;
  stock_resultante: number;
  costo_unitario: number;
  referencia: string;
  fecha: string;
  usuario?: string;
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


export interface TerminalPosModel {
  id: string;
  empresa_id?: string;
  codigo: string;             // Ej: "POS-01"
  nombre: string;             // Ej: "Punto Banesco Caja 1"
  banco_id: string;           // Banco receptor asignado
  cuenta_transitoria_id: string; // Ej: "1.1.01.03"
  cuenta_comision_id?: string; // Ej: "6.1.02.01" (Gastos por comisiones)
  comision_estimada: number;  // Ej: 1.5 (%)
  tipo_cuenta?: 'nacional' | 'internacional'; // Nacional (VES con tasa BCV) o Internacional (USD sin tasa)
  moneda?: 'VES' | 'USD';
  activo: boolean;
  created_at?: string;
}

export interface LotePosTransaccion {
  id: string;
  factura_id?: string;
  factura_numero: string;
  cliente_nombre: string;
  referencia: string;          // Nº de aprobación / voucher
  monto_bs: number;
  monto_usd: number;
  hora: string;
  fecha: string;
}

export interface LotePosModel {
  id: string;
  empresa_id?: string;
  terminal_id: string;
  terminal_nombre: string;
  banco_id: string;
  lote_numero: string;           // Nº impreso en el ticket (ej: "000145")
  fecha_apertura: string;
  fecha_cierre?: string;
  fecha_acreditacion?: string;
  total_operaciones: number;     // Conteo de transacciones
  monto_bruto_sistema: number;   // Suma según transacciones registradas
  monto_bruto_ticket: number;    // Monto según ticket físico
  diferencia: number;            // monto_bruto_ticket - monto_bruto_sistema
  comision_porcentaje?: number;  // % aplicado (ej: 1.5)
  comision_monto: number;        // Comisión bancaria deducida (USD / principal)
  comision_monto_bs?: number;    // Comisión bancaria deducida (Bs. / secundaria)
  retencion_iva_monto?: number;  // Retención IVA tarjeta
  retencion_islr_monto?: number; // Retención ISLR tarjeta
  monto_bruto_usd?: number;      // Bruto en moneda principal (USD)
  monto_neto_banco: number;      // Monto que ingresa al banco en moneda principal (USD)
  monto_neto_banco_bs?: number;  // Monto que ingresa al banco en moneda secundaria (Bs.)
  tasa_cambio?: number;          // Tasa de cambio oficial BCV aplicada
  estado: 'abierto' | 'cerrado_pendiente' | 'acreditado_conciliado';
  referencia_banco?: string;     // Referencia en el extracto bancario
  movimiento_banco_id?: string;  // ID en movimientosBancos
  comprobante_id?: string;       // ID del asiento contable de liquidación
  notas?: string;
  transacciones: LotePosTransaccion[];
  created_at?: string;
  updated_at?: string;
}

export interface ComprobanteRetencionModel {
  id: string;
  empresa_id?: string;
  tipo: 'IVA' | 'ISLR';
  numero_comprobante: string; // Formato AAAAMMDDDDDDDD (ej: 20260900000001)
  periodo_fiscal: string;     // YYYYMM (ej: 202609)
  fecha_emision: string;      // YYYY-MM-DD
  origen: 'compra' | 'venta'; // Compra = Emitido por la empresa al proveedor. Venta = Recibido del cliente.
  sujeto_id: string;          // Proveedor o Cliente ID
  sujeto_nombre: string;
  sujeto_rif: string;
  sujeto_direccion?: string;
  factura_id?: string;
  factura_numero: string;
  factura_control?: string;
  factura_fecha: string;
  monto_total: number;
  monto_total_bs?: number;
  base_imponible: number;
  base_imponible_bs?: number;
  exento: number;
  exento_bs?: number;
  alicuota: number;           // 16
  impuesto_monto: number;     // IVA total
  impuesto_monto_bs?: number;
  porcentaje_retencion: number; // 75% o 100% para IVA, 1%, 2%, 3%, 5% para ISLR
  monto_retenido: number;
  monto_retenido_bs: number;
  tasa_cambio: number;
  concepto_islr?: string;
  estado: 'emitido' | 'declarado' | 'anulado';
  created_at?: string;
}

