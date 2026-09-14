import React from 'react';
import { Printer, X, Download, FileText, CheckCircle2 } from 'lucide-react';
import { FacturaVentaModel } from '../../types/database';
import { formatDate } from '../../utils/dateUtils';

export default function InvoicePrintModal({
  isOpen,
  onClose,
  factura,
  empresa
}: {
  isOpen: boolean;
  onClose: () => void;
  factura: FacturaVentaModel | null;
  empresa: any;
}) {
  if (!isOpen || !factura) return null;

  const handlePrint = () => {
    window.print();
  };

  const isPresentationVES = factura.moneda_presentacion === 'VES' || factura.moneda === 'VES';
  const displayCurrency = isPresentationVES ? 'VES' : 'USD';
  const rate = factura.tasa_cambio || 1;

  const formatMoney = (amount: number, curr = displayCurrency) => {
    return new Intl.NumberFormat('es-VE', { 
      style: 'currency', 
      currency: curr === 'VES' ? 'VES' : 'USD',
      minimumFractionDigits: 2 
    }).format(amount || 0).replace('USD', '$').replace('VES', 'Bs.');
  };

  // Montos normalizados para presentación
  const subtotalDisplay = isPresentationVES 
    ? (factura.subtotal_bs ?? (factura.subtotal * rate))
    : factura.subtotal;

  const montoExentoDisplay = isPresentationVES
    ? (factura.monto_exento_bs ?? (factura.monto_exento * rate))
    : factura.monto_exento;

  const baseImponibleDisplay = isPresentationVES
    ? (factura.base_imponible_bs ?? (factura.base_imponible * rate))
    : factura.base_imponible;

  const ivaMontoDisplay = isPresentationVES
    ? (factura.iva_monto_bs ?? (factura.iva_monto * rate))
    : factura.iva_monto;

  const igtfMontoDisplay = isPresentationVES
    ? (factura.igtf_monto_bs ?? (factura.igtf_monto * rate))
    : factura.igtf_monto;

  const retIvaMontoDisplay = isPresentationVES
    ? (factura.retencion_iva_monto_bs ?? ((factura.retencion_iva_monto || 0) * rate))
    : (factura.retencion_iva_monto || 0);

  const retIslrMontoDisplay = isPresentationVES
    ? (factura.retencion_islr_monto_bs ?? ((factura.retencion_islr_monto || 0) * rate))
    : (factura.retencion_islr_monto || 0);

  const netoCobrarDisplay = isPresentationVES
    ? (factura.neto_cobrar_bs ?? ((factura.neto_cobrar || factura.total) * rate))
    : (factura.neto_cobrar || factura.total);

  const totalUSD = factura.total;
  const totalBs = factura.total_bs || (factura.total * rate);

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 print:p-0 print:bg-white animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col border border-slate-100 print:shadow-none print:max-w-none print:w-full print:max-h-none print:rounded-none print:border-none">
        
        {/* Barra superior no imprimible */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 tracking-tight">Vista de Impresión de Factura</h3>
              <p className="text-[11px] text-slate-400 font-semibold">{factura.numero} • {factura.cliente_nombre}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-500/20"
            >
              <Printer size={15} />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition font-bold"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Hoja de Factura (Área imprimible) */}
        <div className="p-8 sm:p-10 overflow-y-auto print:p-0 print:overflow-visible text-slate-800 text-xs font-sans">
          
          {/* Cabecera: Empresa y Documento */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                {empresa?.nombre || empresa?.name || 'EMPRESA COMERCIAL, C.A.'}
              </h2>
              <p className="text-xs font-bold text-slate-600 font-mono mt-0.5">
                RIF: {empresa?.rif || empresa?.taxId || 'J-00000000-0'}
              </p>
              {empresa?.direccion && (
                <p className="text-[11px] text-slate-500 max-w-sm mt-1">{empresa.direccion}</p>
              )}
              {empresa?.telefono && (
                <p className="text-[11px] text-slate-500 mt-0.5">Teléfono: {empresa.telefono}</p>
              )}
              {empresa?.email && (
                <p className="text-[11px] text-slate-500">Correo: {empresa.email}</p>
              )}
            </div>

            <div className="text-right">
              <div className="inline-block bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl">
                <span className="block text-[10px] font-black uppercase tracking-wider text-indigo-700">
                  {factura.tipo_documento === 'nota_entrega' ? 'NOTA DE ENTREGA' : 'FACTURA DE VENTA'}
                </span>
                <span className="text-lg font-black text-indigo-950 font-mono">
                  {factura.numero}
                </span>
              </div>
              {factura.control_numero && (
                <p className="text-[11px] text-slate-500 font-mono mt-1">
                  N° Control: <span className="font-bold text-slate-700">{factura.control_numero}</span>
                </p>
              )}
              <p className="text-[11px] text-slate-500 mt-1">
                Condición: <span className="font-bold text-slate-800 uppercase">{factura.condicion || 'Contado'}</span>
              </p>
            </div>
          </div>

          {/* Datos del Cliente y Fechas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Facturado a:</p>
              <p className="text-sm font-bold text-slate-900">{factura.cliente_nombre}</p>
              <p className="text-xs font-semibold text-slate-600 font-mono mt-0.5">
                RIF / C.I.: {factura.cliente_rif || 'N/A'}
              </p>
              {factura.cliente_direccion && (
                <p className="text-[11px] text-slate-500 mt-0.5">{factura.cliente_direccion}</p>
              )}
              {factura.cliente_telefono && (
                <p className="text-[11px] text-slate-500 mt-0.5">Telf: {factura.cliente_telefono}</p>
              )}
            </div>

            <div className="sm:text-right space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Información de Emisión:</p>
              <p className="text-xs text-slate-600">
                Fecha Emisión: <span className="font-bold text-slate-900">{formatDate(factura.fecha_emision)}</span>
              </p>
              <p className="text-xs text-slate-600">
                Fecha Vencimiento: <span className="font-bold text-slate-900">{formatDate(factura.fecha_vencimiento)}</span>
              </p>
              <p className="text-xs text-slate-600">
                Moneda de Presentación: <span className="font-bold text-slate-900">{isPresentationVES ? 'Bolívares (VES)' : 'Dólares (USD)'}</span>
              </p>
              {factura.tasa_cambio > 1 && (
                <p className="text-xs text-slate-600">
                  Tasa de Cambio Oficial BCV: <span className="font-bold text-slate-900">{factura.tasa_cambio.toFixed(2)} Bs./$</span>
                </p>
              )}
            </div>
          </div>

          {/* Tabla de Items / Productos */}
          <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-3.5 py-2.5 w-12 text-center">#</th>
                  <th className="px-3.5 py-2.5">Descripción / Producto</th>
                  <th className="px-3.5 py-2.5 text-center w-20">Cant.</th>
                  <th className="px-3.5 py-2.5 text-right w-28">Precio Unit.</th>
                  <th className="px-3.5 py-2.5 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(factura.items || []).map((item, idx) => {
                  const unitPrice = isPresentationVES
                    ? (item.precio_unitario_bs ?? (item.precio_unitario * rate))
                    : item.precio_unitario;

                  const lineTotal = isPresentationVES
                    ? (item.total_bs ?? (item.total * rate))
                    : item.total;

                  return (
                    <tr key={item.id || idx}>
                      <td className="px-3.5 py-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3.5 py-2">
                        <div className="font-bold text-slate-900 flex items-center gap-1 flex-wrap">
                          <span>{item.descripcion}</span>
                          {item.exento && (
                            <span className="font-black text-slate-900 font-mono text-[11px] bg-slate-100 px-1 py-0.2 rounded border border-slate-200" title="Exento de IVA">
                              (E)
                            </span>
                          )}
                        </div>
                        {item.codigo && (
                          <div className="text-[10px] font-mono text-slate-400">{item.codigo}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2 text-center font-bold text-slate-800">{item.cantidad}</td>
                      <td className="px-3.5 py-2 text-right font-medium text-slate-700">
                        {formatMoney(unitPrice)}
                      </td>
                      <td className="px-3.5 py-2 text-right font-bold text-slate-900">
                        {formatMoney(lineTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {factura.items?.some(it => it.exento) && (
              <div className="px-3.5 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 italic">
                (E) = Bien o servicio exento de Impuesto al Valor Agregado (IVA).
              </div>
            )}
          </div>

          {/* Sección de Totales y Desglose Fiscal */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-slate-200 pt-4">
            {/* Notas / Datos de Pago */}
            <div className="flex-1 text-xs text-slate-500 space-y-2">
              {factura.notas && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-700 text-[11px] mb-0.5">Notas / Observaciones:</p>
                  <p className="text-[11px] leading-relaxed">{factura.notas}</p>
                </div>
              )}
              <div className="text-[10px] text-slate-400 leading-normal">
                Comprobante emitido de acuerdo a las providencias administrativas vigentes. 
                Los pagos efectuados en Bolívares se calcularán a la tasa del BCV de la fecha de pago.
              </div>
            </div>

            {/* Totales */}
            <div className="w-full sm:w-72 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal Neto:</span>
                <span className="font-semibold">{formatMoney(subtotalDisplay)}</span>
              </div>

              {montoExentoDisplay > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Monto Exento:</span>
                  <span className="font-semibold">{formatMoney(montoExentoDisplay)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>Base Imponible (16%):</span>
                <span className="font-semibold">{formatMoney(baseImponibleDisplay)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>IVA (16%):</span>
                <span className="font-semibold">{formatMoney(ivaMontoDisplay)}</span>
              </div>

              {igtfMontoDisplay > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>(+) IGTF (3%):</span>
                  <span className="font-semibold">+{formatMoney(igtfMontoDisplay)}</span>
                </div>
              )}

              {retIvaMontoDisplay > 0 && (
                <div className="flex justify-between text-amber-800 font-medium">
                  <span>(-) Retención IVA ({factura.retencion_iva_porcentaje || 75}%):</span>
                  <span className="font-mono font-semibold">-{formatMoney(retIvaMontoDisplay)}</span>
                </div>
              )}

              {retIslrMontoDisplay > 0 && (
                <div className="flex justify-between text-indigo-800 font-medium">
                  <span>(-) Retención ISLR ({factura.retencion_islr_porcentaje || 2}%):</span>
                  <span className="font-mono font-semibold">-{formatMoney(retIslrMontoDisplay)}</span>
                </div>
              )}

              <div className="border-t-2 border-slate-900 pt-2 flex justify-between items-center text-slate-900">
                <span className="text-sm font-black uppercase">
                  {retIvaMontoDisplay > 0 || retIslrMontoDisplay > 0 ? 'Neto a Cobrar:' : 'Total a Pagar:'}
                </span>
                <span className="text-base font-black text-indigo-600">
                  {formatMoney(netoCobrarDisplay)}
                </span>
              </div>

              {/* Recuadro de equivalencia en la otra moneda */}
              {isPresentationVES ? (
                <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-900 flex justify-between items-center font-bold text-xs mt-2">
                  <span>Equivalente en USD ($):</span>
                  <span className="text-sm font-black font-mono">
                    $ {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalUSD)}
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 flex justify-between items-center font-bold text-xs mt-2">
                  <span>Equiv. en Bolívares:</span>
                  <span className="text-sm font-black font-mono">
                    Bs. {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(totalBs)}
                  </span>
                </div>
              )}

              {factura.vuelto !== undefined && factura.vuelto > 0 && (
                <div className="p-2 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex justify-between items-center font-bold text-xs mt-1.5">
                  <span>Vuelto / Cambio entregado:</span>
                  <span className="text-xs font-black font-mono">
                    $ {new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(factura.vuelto)}
                    {factura.vuelto_bs ? ` (Bs. ${new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2 }).format(factura.vuelto_bs)})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Firmas */}
          <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t border-slate-200 print:mt-16 text-center text-xs text-slate-500">
            <div>
              <div className="w-44 border-b border-slate-400 mx-auto mb-1"></div>
              <p className="font-bold text-slate-700">Emitido por / Empresa</p>
              <p className="text-[10px] text-slate-400">Firma y Sello Autorizado</p>
            </div>
            <div>
              <div className="w-44 border-b border-slate-400 mx-auto mb-1"></div>
              <p className="font-bold text-slate-700">Recibido Conforme / Cliente</p>
              <p className="text-[10px] text-slate-400">Firma, Nombre y C.I.</p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
