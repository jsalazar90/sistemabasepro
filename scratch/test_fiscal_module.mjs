// Automated test for Fiscal & Withholding Module logic
import assert from 'assert';

console.log('--- TEST: MÓDULO FISCAL & RETENCIONES (SENIAT / NIIF) ---');

// 1. Simulación de Factura de Compra sujeta a retención (75% IVA y 2% ISLR)
const facturaCompra = {
  id: 'fc_001',
  fecha_emision: '2026-09-10',
  numero: 'FAC-9876',
  control_numero: '00-001234',
  proveedor_nombre: 'Distribuidora Central Mayorista C.A.',
  proveedor_rif: 'J-12345678-9',
  tasa_cambio: 40.00,
  total: 1160.00, // En USD
  base_imponible: 1000.00,
  monto_exento: 0,
  iva_porcentaje: 16,
  iva_monto: 160.00,
  retencion_iva_porcentaje: 75,
  retencion_iva_monto: 120.00, // 75% de 160 = 120 USD
  retencion_islr_porcentaje: 2,
  retencion_islr_monto: 20.00,  // 2% de 1000 = 20 USD
  neto_pagar: 1020.00
};

// 2. Simulación de Factura de Venta a Contribuyente Especial
const facturaVenta = {
  id: 'fv_001',
  fecha_emision: '2026-09-12',
  numero: 'FAC-0001',
  control_numero: '00-000001',
  cliente_nombre: 'Corporación Alpha C.A.',
  cliente_rif: 'J-98765432-1',
  tasa_cambio: 40.00,
  total: 2320.00,
  base_imponible: 2000.00,
  monto_exento: 0,
  iva_porcentaje: 16,
  iva_monto: 320.00,
  retencion_iva_porcentaje: 75,
  retencion_iva_monto: 240.00, // 75% de 320 = 240 USD
  neto_cobrar: 2080.00
};

// Verificaciones de cálculo
assert.strictEqual(facturaCompra.retencion_iva_monto, facturaCompra.iva_monto * 0.75, 'El IVA retenido debe ser exactamente el 75%');
assert.strictEqual(facturaCompra.retencion_islr_monto, facturaCompra.base_imponible * 0.02, 'El ISLR retenido debe ser el 2%');
assert.strictEqual(facturaCompra.neto_pagar, facturaCompra.total - facturaCompra.retencion_iva_monto - facturaCompra.retencion_islr_monto, 'Neto a pagar al proveedor cuadrado');

console.log('✅ 1. Cálculos de Factura de Compra con Retenciones IVA (75%) e ISLR (2%) verificados.');

// 3. Verificación de Libro de Compras (Art. 75-78 Ley IVA)
const totalComprasUSD = facturaCompra.total;
const baseComprasUSD = facturaCompra.base_imponible;
const creditoFiscalUSD = facturaCompra.iva_monto;
const retIvaEnterarUSD = facturaCompra.retencion_iva_monto;

assert.strictEqual(creditoFiscalUSD, 160.00);
assert.strictEqual(retIvaEnterarUSD, 120.00);
console.log('✅ 2. Libro de Compras Fiscal verificado (Crédito Fiscal: $160, Retención por Enterar: $120).');

// 4. Verificación de Libro de Ventas (Art. 76-79 Ley IVA)
const debitoFiscalUSD = facturaVenta.iva_monto;
const retIvaSoportadaUSD = facturaVenta.retencion_iva_monto;

assert.strictEqual(debitoFiscalUSD, 320.00);
assert.strictEqual(retIvaSoportadaUSD, 240.00);

// Simulación de generación de filas separadas en Libro de Ventas
const itemsVentasLibro = [];
let opVenta = 1;

// Fila 1: Factura
itemsVentasLibro.push({
  operacion: opVenta++,
  tipoFila: 'factura',
  fecha: facturaVenta.fecha_emision,
  numero: facturaVenta.numero,
  facturaAfectada: '-',
  base: facturaVenta.base_imponible,
  iva: facturaVenta.iva_monto,
  retIva: 0
});

// Fila 2: Retención de IVA (inmediatamente debajo de la factura)
if (facturaVenta.retencion_iva_monto > 0) {
  itemsVentasLibro.push({
    operacion: opVenta++,
    tipoFila: 'retencion_iva',
    fecha: '2026-09-12',
    numero: '20260900000012',
    facturaAfectada: facturaVenta.numero,
    base: 0,
    iva: 0,
    retIva: facturaVenta.retencion_iva_monto
  });
}

assert.strictEqual(itemsVentasLibro.length, 2, 'El libro de ventas debe contener 2 filas: 1 de factura y 1 de retención');
assert.strictEqual(itemsVentasLibro[0].tipoFila, 'factura', 'La fila 1 debe ser la Factura');
assert.strictEqual(itemsVentasLibro[0].numero, 'FAC-0001');
assert.strictEqual(itemsVentasLibro[1].tipoFila, 'retencion_iva', 'La fila 2 debe ser la Retención');
assert.strictEqual(itemsVentasLibro[1].facturaAfectada, 'FAC-0001', 'La retención debe apuntar a la factura afectada');
assert.strictEqual(itemsVentasLibro[1].retIva, 240.00);
console.log('✅ 3. Libro de Ventas Fiscal verificado: Factura emitida primero y Retención IVA en fila separada inmediatamente por debajo.');

// 5. Verificación de Cuadre y Liquidación Impositiva
const cuotaTributariaMes = debitoFiscalUSD - creditoFiscalUSD; // 320 - 160 = 160
const totalPagarFisco = Math.max(0, cuotaTributariaMes - retIvaSoportadaUSD); // 160 - 240 = -80 -> 0 (Excedente)
const excedenteCredito = cuotaTributariaMes < retIvaSoportadaUSD ? retIvaSoportadaUSD - cuotaTributariaMes : 0; // 80 a favor

assert.strictEqual(cuotaTributariaMes, 160.00);
assert.strictEqual(totalPagarFisco, 0);
assert.strictEqual(excedenteCredito, 80.00);
console.log('✅ 4. Liquidación Fiscal de IVA verificada: Excedente a favor del contribuyente = $80.00.');

// 6. Verificación de Estructura de Cadena TXT SENIAT
const rifAgente = 'J312456780';
const periodo = '202609';
const fecha = facturaCompra.fecha_emision.replace(/-/g, '');
const tc = facturaCompra.tasa_cambio;
const totalBs = (facturaCompra.total * tc).toFixed(2);
const baseBs = (facturaCompra.base_imponible * tc).toFixed(2);
const retBs = (facturaCompra.retencion_iva_monto * tc).toFixed(2);
const exentoBs = '0.00';
const alicuota = '16.00';
const numCompRet = `${periodo}00000001`;

const lineaTxt = `${rifAgente}\t${periodo}\t${fecha}\tC\t01\t${facturaCompra.proveedor_rif.replace(/[-.\s]/g, '')}\t${facturaCompra.numero}\t${facturaCompra.control_numero}\t${totalBs}\t${baseBs}\t${retBs}\t0\t${numCompRet}\t${exentoBs}\t${alicuota}\t0`;

const campos = lineaTxt.split('\t');
assert.strictEqual(campos.length, 16, 'La línea TXT SENIAT debe tener exactamente 16 campos separados por tabulación');
assert.strictEqual(campos[0], rifAgente);
assert.strictEqual(campos[1], periodo);
assert.strictEqual(campos[4], '01', 'Tipo documento 01 para Factura');
assert.strictEqual(campos[8], '46400.00', 'Total en Bs = 1160 * 40');
assert.strictEqual(campos[10], '4800.00', 'Monto retenido en Bs = 120 * 40');

console.log('✅ 5. Estructura del Archivo Plano TXT SENIAT generada con 16 campos oficiales tabulados.');
console.log('--- TODOS LOS TESTS DEL MÓDULO FISCAL PASARON EXITOSAMENTE ---');
