Created At: 2026-09-12T19:13:07-04:00
Completed At: 2026-09-12T19:13:07-04:00
File Path: `file:///C:/Users/Portal%20De%20trabajo/Desktop/sistema%20base%20pro/src/pages/InvoiceForm.tsx`
Total Lines: 3504
Total Bytes: 168966
Showing lines 1 to 800
The following code has been modified to include a line number before every line, in the format: <line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
1: import React, { useState, useMemo, useEffect } from 'react';
2: import { useNavigate } from 'react-router-dom';
3: import { 
4:   FileText, ArrowLeft, Search, Plus, Trash2, CheckCircle2, 
5:   Save, AlertTriangle, User, Building2, DollarSign, Calendar, 
6:   BookOpen, Eye, X, HelpCircle, Package, ShieldCheck, ShieldAlert, KeyRound,
7:   CreditCard, Landmark, Check, CornerDownRight, Coins, 
8:   Clock, ArrowRight, Sparkles, RefreshCw, Mail, Phone, Lock, Printer
9: } from 'lucide-react';
10: import BackButton from '../components/common/BackButton';
11: import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
12: import CuentaContableModal from '../components/common/CuentaContableModal';
13: import TasaCambioModal from '../components/invoicing/TasaCambioModal';
14: import MasterAuthModal from '../components/common/MasterAuthModal';
15: import InvoicePrintModal from '../components/invoicing/InvoicePrintModal';
16: import { getTasaForDate, fetchLiveBcvRate } from '../services/exchangeRateService';
17: import { dbFetchTerminalesPos, dbFetchLotesPos, dbSaveLotePos } from '../services/db';
18: import { FacturaVentaModel, FacturaItemModel, ProductModel, TerminalPosModel, LotePosTransaccion } from '../types/database';
19: import { formatDate } from '../utils/dateUtils';
20: 
21: export default function InvoiceForm({
22:   contactos = [],
23:   products = [],
24:   cuentasContables = [],
25:   bancos = [],
26:   configContable,
27:   onSave,
28:   showToast,
29:   workingYear,
30:   isModal = false,
31:   onClose,
32:   empresa
33: }: {
34:   contactos?: any[];
35:   products?: ProductModel[];
36:   cuentasContables?: any[];
37:   bancos?: any[];
38:   configContable?: any;
39:   onSave?: (collection: string, data: any) => void;
40:   showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
41:   workingYear?: string;
42:   isModal?: boolean;
43:   onClose?: () => void;
44:   empresa?: any;
45: }) {
46:   const navigate = useNavigate();
47: 
48:   // Document Info
49:   const [docType, setDocType] = useState<'factura' | 'nota_entrega' | 'nota_credito' | 'nota_debito'>('factura');
50:   const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
51:   const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
52:   const [exchangeRateInput, setExchangeRateInput] = useState<string>(() => {
53:     const today = new Date().toISOString().split('T')[0];
54:     return getTasaForDate(today).toFixed(2);
55:   });
56:   const exchangeRate = useMemo(() => {
57:     const clean = exchangeRateInput.replace(',', '.');
58:     const val = parseFloat(clean);
59:     return isNaN(val) || val <= 0 ? 1 : val;
60:   }, [exchangeRateInput]);
61:   const [invoiceNumber, setInvoiceNumber] = useState('');
62:   const [controlNumber, setControlNumber] = useState('');
63:   const [notes, setNotes] = useState('');
64:   const [isTasaModalOpen, setIsTasaModalOpen] = useState(false);
65:   const [isSyncingBcvLive, setIsSyncingBcvLive] = useState(false);
66:   const [lastEmittedInvoice, setLastEmittedInvoice] = useState<FacturaVentaModel | null>(null);
67:   const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
68: 
69:   // Sincronizar en vivo desde la página oficial del BCV
70:   const handleSyncLiveBcv = async () => {
71:     setIsSyncingBcvLive(true);
72:     try {
73:       const res = await fetchLiveBcvRate(true);
74:       if (res.success && res.tasa) {
75:         const rateStr = res.tasa.toFixed(2);
76:         setExchangeRateInput(rateStr);
77:         showToast?.(`Tasa BCV actualizada en vivo: Bs. ${res.tasa.toFixed(2)} / $ (${res.fuente})`, 'success');
78:         if (currency === 'VES') {
79:           recalculateItemsInVES(res.tasa);
80:         }
81:       } else {
82:         showToast?.(res.error || 'No se pudo obtener la tasa en vivo del BCV', 'error');
83:       }
84:     } catch (e: any) {
85:       showToast?.('Error al conectar con el servidor oficial del BCV', 'error');
86:     } finally {
87:       setIsSyncingBcvLive(false);
88:     }
89:   };
90: 
91:   // Auto-sincronizar tasa BCV al ingresar si está en valor por defecto
92:   useEffect(() => {
93:     const today = new Date().toISOString().split('T')[0];
94:     const stored = getTasaForDate(today);
95:     if (stored === 36.5) {
96:       fetchLiveBcvRate(false).then(res => {
97:         if (res.success && res.tasa) {
98:           setExchangeRateInput(res.tasa.toFixed(2));
99:         }
100:       });
101:     }
102:   }, []);
103: 
104:   // Sincronizar tasa si cambia la fecha de emisión
105:   useEffect(() => {
106:     const rate = getTasaForDate(issueDate);
107:     setExchangeRateInput(rate.toFixed(2));
108:   }, [issueDate]);
109: 
110:   // Escuchar eventos globales de actualización de tasa
111:   useEffect(() => {
112:     const handleTasaUpdated = (e: any) => {
113:       const detail = e.detail;
114:       if (detail && detail.tasa) {
115:         if (!detail.fecha || detail.fecha === issueDate) {
116:           setExchangeRateInput(Number(detail.tasa).toFixed(2));
117:         }
118:       }
119:     };
120:     window.addEventListener('tasa-cambio-updated', handleTasaUpdated);
121:     return () => window.removeEventListener('tasa-cambio-updated', handleTasaUpdated);
122:   }, [issueDate]);
123: 
124:   // Cliente Info
125:   const [selectedCustomerId, setSelectedCustomerId] = useState('');
126:   const [customerName, setCustomerName] = useState('');
127:   const [customerRif, setCustomerRif] = useState('');
128:   const [customerAddress, setCustomerAddress] = useState('');
129:   const [customerPhone, setCustomerPhone] = useState('');
130:   const [customerEmail, setCustomerEmail] = useState('');
131: 
132:   // Modales de Cliente
133:   const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
134:   const [customerSearchTerm, setCustomerSearchTerm] = useState('');
135:   const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
136:   const [activeCustomerModalTab, setActiveCustomerModalTab] = useState<'info' | 'contabilidad'>('info');
137:   const [customerModalForm, setCustomerModalForm] = useState({
138:     name: '',
139:     isCompany: true,
140:     taxIdPrefix: 'J',
141:     taxIdNumber: '',
142:     email: '',
143:     phone: '',
144:     personaContacto: '',
145:     cargo: '',
146:     address: '',
147:     debitAccount: '',
148:     creditAccount: ''
149:   });
150:   const [customerAccountError, setCustomerAccountError] = useState<string | null>(null);
151:   const [showCustomerCuentaModal, setShowCustomerCuentaModal] = useState(false);
152:   const [activeCustomerAccountKey, setActiveCustomerAccountKey] = useState<'debitAccount' | 'creditAccount' | null>(null);
153: 
154:   // Modal de Selección de Productos de Inventario
155:   const [isProductModalOpen, setIsProductModalOpen] = useState(false);
156:   const [activeItemIndexForProduct, setActiveItemIndexForProduct] = useState<number | null>(null);
157:   const [productSearchTerm, setProductSearchTerm] = useState('');
158:   const [selectedProductCategory, setSelectedProductCategory] = useState('all');
159: 
160:   // Items / Líneas de la Factura
161:   const [items, setItems] = useState<FacturaItemModel[]>([
162:     {
163:       id: `item_${Date.now()}_1`,
164:       producto_id: '',
165:       codigo: '',
166:       descripcion: '',
167:       cantidad: 1,
168:       precio_unitario: 0,
169:       exento: false,
170:       subtotal: 0,
171:       iva_monto: 0,
172:       total: 0,
173:       cuenta_ingreso_id: '4.1.01.001',
174:       cuenta_costo_id: '5.1.01.001',
175:       cuenta_inventario_id: '1.1.04.001'
176:     }
177:   ]);
178: 
179:   // Modales y estados del flujo de emisión
180:   const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
181:   const [selectedCondition, setSelectedCondition] = useState<'contado' | 'credito'>('contado');
182:   const [creditDays, setCreditDays] = useState(15);
183:   const [calculatedDueDate, setCalculatedDueDate] = useState('');
184: 
185:   // Autorización de Stock 0 con Clave Especial de Operaciones Master
186:   const [isZeroStockAuthorized, setIsZeroStockAuthorized] = useState(false);
187:   const [isMasterAuthModalOpen, setIsMasterAuthModalOpen] = useState(false);
188: 
189:   // Artículos con stock 0 o insuficiente
190:   const zeroStockItems = useMemo(() => {
191:     return items.filter(item => {
192:       if (!item.producto_id) return false;
193:       const prod = products.find(p => p.id === item.producto_id);
194:       if (!prod) return false;
195:       const stock = Number(prod.stock_actual) || 0;
196:       const qty = Number(item.cantidad) || 0;
197:       return stock <= 0 || qty > stock;
198:     });
199:   }, [items, products]);
200: 
201:   // Opciones de Retenciones e IGTF (Leyes Tributarias Venezolanas - SENIAT)
202:   const [applyRetIva, setApplyRetIva] = useState(false);
203:   const [retIvaPercent, setRetIvaPercent] = useState<number>(75); // 75% o 100% (Providencia SNAT/2015/0049)
204: 
205:   const [applyRetIslr, setApplyRetIslr] = useState(false);
206:   const [retIslrPercent, setRetIslrPercent] = useState<number>(2); // 2%, 5%, 1%, 3% (Decreto 1808)
207: 
208:   const [applyIgtf, setApplyIgtf] = useState(false);
209:   const [igtfPercent, setIgtfPercent] = useState<number>(3); // 3% Ley IGTF 2022
210: 
211:   // Modal de Cobranza (para facturas de Contado)
212:   const [isCobranzaModalOpen, setIsCobranzaModalOpen] = useState(false);
213:   const [cobranzaForm, setCobranzaForm] = useState({
214:     fecha: new Date().toISOString().split('T')[0],
215:     tasa: 36.50,
216:     pagos: [] as Array<{
217:       id: string;
218:       bancoId: string;
219:       metodoPago: string;
220:       terminalId?: string;
221:       referencia: string;
222:       monto: string;
223:       montoBs: string;
224:     }>
225:   });
226: 
227:   // Terminales POS para cobranzas con tarjeta
228:   const [terminalesPos, setTerminalesPos] = useState<TerminalPosModel[]>([]);
229:   useEffect(() => {
230:     dbFetchTerminalesPos().then(res => {
231:       if (res && res.length > 0) setTerminalesPos(res);
232:     });
233:   }, []);
234: 
235:   // Modal de Asiento Contable
236:   const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
237:   const [pendingVoucher, setPendingVoucher] = useState<any>(null);
238: 
239:   // Generar correlativo inicial
240:   useEffect(() => {
241:     const prefix = docType === 'nota_credito' ? 'NC-' : docType === 'nota_debito' ? 'ND-' : docType === 'nota_entrega' ? 'NE-' : (configContable?.prefijoFactura || 'FAC-');
242:     const baseCorrelativo = configContable?.correlativoFactura || '00001';
243:     setInvoiceNumber(`${prefix}${baseCorrelativo}`);
244:     setControlNumber(`00-${Math.floor(100000 + Math.random() * 900000)}`);
245:   }, [configContable, docType]);
246: 
247:   // Recalcular vencimiento al cambiar días de crédito o fecha de emisión
248:   useEffect(() => {
249:     const base = new Date(issueDate);
250:     base.setDate(base.getDate() + Number(creditDays || 0));
251:     setCalculatedDueDate(base.toISOString().split('T')[0]);
252:   }, [issueDate, creditDays]);
253: 
254:   // Atajos de teclado estilo ERP (F2: Emitir Factura, F3: Buscar Catálogo)
255:   useEffect(() => {
256:     const handleKeyDown = (e: KeyboardEvent) => {
257:       if (e.key === 'F2') {
258:         e.preventDefault();
259:         const formEl = document.getElementById('invoice-main-form') as HTMLFormElement;
260:         if (formEl) formEl.requestSubmit();
261:       } else if (e.key === 'F3') {
262:         e.preventDefault();
263:         handleOpenProductModal(null);
264:       }
265:     };
266:     window.addEventListener('keydown', handleKeyDown);
267:     return () => window.removeEventListener('keydown', handleKeyDown);
268:   }, []);
269: 
270:   // Lista filtrada de clientes
271:   const customersList = useMemo(() => {
272:     const term = customerSearchTerm.toLowerCase();
273:     return contactos.filter(c => {
274:       const isCust = c.type === 'customer' || c.type === 'both';
275:       const match = !term || 
276:         (c.name || '').toLowerCase().includes(term) ||
277:         (c.taxId || '').toLowerCase().includes(term);
278:       return isCust && match;
279:     });
280:   }, [contactos, customerSearchTerm]);
281: 
282:   // Totales calculados en tiempo real (con Retenciones e IGTF de acuerdo a leyes venezolanas)
283:   const totals = useMemo(() => {
284:     let subtotal = 0;
285:     let montoExento = 0;
286:     let baseImponible = 0;
287:     let ivaMonto = 0;
288: 
289:     items.forEach(item => {
290:       const lineSubtotal = (Number(item.cantidad) || 0) * (Number(item.precio_unitario) || 0);
291:       subtotal += lineSubtotal;
292:       if (item.exento) {
293:         montoExento += lineSubtotal;
294:       } else {
295:         baseImponible += lineSubtotal;
296:         ivaMonto += lineSubtotal * 0.16;
297:       }
298:     });
299: 
300:     // 1. IGTF 3% (Ley de Reforma del IGTF: Percepción por cobro en divisas o moneda extranjera)
301:     const igtfMonto = applyIgtf ? (subtotal + ivaMonto) * (igtfPercent / 100) : 0;
302: 
303:     // Total de la Factura (Subtotal + IVA + IGTF si aplica)
304:     const totalFactura = subtotal + ivaMonto + igtfMonto;
305: 
306:     // 2. Retención de IVA (Providencia SNAT/2015/0049: 75% o 100% sobre el IVA facturado)
307:     const retIvaMonto = applyRetIva ? ivaMonto * (retIvaPercent / 100) : 0;
308: 
309:     // 3. Retención de ISLR (Decreto 1808: 2%, 5%, 1% o 3% sobre la Base Imponible)
310:     const retIslrMonto = applyRetIslr ? baseImponible * (retIslrPercent / 100) : 0;
311: 
312:     // 4. Neto a Cobrar / Pagar (Total Facturado menos Retenciones que el cliente entrega en comprobante)
313:     const netoCobrar = Math.max(0, totalFactura - retIvaMonto - retIslrMonto);
314: 
315:     // Calcular montos en USD y Bs. según la moneda seleccionada en pantalla
316:     const isVes = currency === 'VES' && exchangeRate > 0;
317:     const factorToUSD = isVes ? (1 / exchangeRate) : 1;
318:     const factorToBs = isVes ? 1 : (exchangeRate || 1);
319: 
320:     const subtotalUSD = subtotal * factorToUSD;
321:     const subtotalBs = subtotal * factorToBs;
322:     const montoExentoUSD = montoExento * factorToUSD;
323:     const montoExentoBs = montoExento * factorToBs;
324:     const baseImponibleUSD = baseImponible * factorToUSD;
325:     const baseImponibleBs = baseImponible * factorToBs;
326:     const ivaMontoUSD = ivaMonto * factorToUSD;
327:     const ivaMontoBs = ivaMonto * factorToBs;
328:     const igtfMontoUSD = igtfMonto * factorToUSD;
329:     const igtfMontoBs = igtfMonto * factorToBs;
330:     const totalUSD = totalFactura * factorToUSD;
331:     const totalBs = totalFactura * factorToBs;
332:     const retIvaMontoUSD = retIvaMonto * factorToUSD;
333:     const retIvaMontoBs = retIvaMonto * factorToBs;
334:     const retIslrMontoUSD = retIslrMonto * factorToUSD;
335:     const retIslrMontoBs = retIslrMonto * factorToBs;
336:     const netoCobrarUSD = netoCobrar * factorToUSD;
337:     const netoCobrarBs = netoCobrar * factorToBs;
338: 
339:     return { 
340:       subtotal, 
341:       montoExento, 
342:       baseImponible, 
343:       ivaMonto, 
344:       igtfMonto,
345:       total: totalFactura, 
346:       totalUSD, 
347:       totalBs,
348:       subtotalUSD,
349:       subtotalBs,
350:       montoExentoUSD,
351:       montoExentoBs,
352:       baseImponibleUSD,
353:       baseImponibleBs,
354:       ivaMontoUSD,
355:       ivaMontoBs,
356:       igtfMontoUSD,
357:       igtfMontoBs,
358:       retIvaMonto,
359:       retIvaMontoUSD,
360:       retIvaMontoBs,
361:       retIslrMonto,
362:       retIslrMontoUSD,
363:       retIslrMontoBs,
364:       netoCobrar,
365:       netoCobrarUSD,
366:       netoCobrarBs
367:     };
368:   }, [items, currency, exchangeRate, applyRetIva, retIvaPercent, applyRetIslr, retIslrPercent, applyIgtf, igtfPercent]);
369: 
370:   // Formateador de moneda
371:   const formatMoney = (amount: number, curr = currency) => {
372:     return new Intl.NumberFormat('es-VE', { 
373:       style: 'currency', 
374:       currency: curr === 'VES' ? 'VES' : 'USD',
375:       minimumFractionDigits: 2 
376:     }).format(amount || 0).replace('USD', '$').replace('VES', 'Bs.');
377:   };
378: 
379:   // Manejo de Cliente
380:   const handleSelectCustomer = (cust: any) => {
381:     setSelectedCustomerId(cust.id);
382:     setCustomerName(cust.name || cust.nombre || '');
383:     setCustomerRif(cust.taxId || cust.rif || '');
384:     setCustomerAddress(cust.address || cust.direccion || '');
385:     setCustomerPhone(cust.phone || cust.telefono || '');
386:     setCustomerEmail(cust.email || '');
387:     setIsCustomerModalOpen(false);
388:   };
389: 
390:   const handleClearCustomer = () => {
391:     setSelectedCustomerId('');
392:     setCustomerName('');
393:     setCustomerRif('');
394:     setCustomerAddress('');
395:     setCustomerPhone('');
396:     setCustomerEmail('');
397:   };
398: 
399:   // Categorías únicas de productos
400:   const productCategories = useMemo(() => {
401:     const cats = new Set<string>();
402:     products.forEach(p => {
403:       if (p.categoria && p.categoria.trim()) {
404:         cats.add(p.categoria.trim());
405:       }
406:     });
407:     return Array.from(cats);
408:   }, [products]);
409: 
410:   // Lista de productos filtrada para el modal
411:   const filteredProducts = useMemo(() => {
412:     const term = productSearchTerm.toLowerCase().trim();
413:     return products.filter(p => {
414:       const matchesCategory = selectedProductCategory === 'all' || p.categoria === selectedProductCategory;
415:       if (!matchesCategory) return false;
416:       if (!term) return true;
417:       return (
418:         (p.codigo || '').toLowerCase().includes(term) ||
419:         (p.nombre || '').toLowerCase().includes(term) ||
420:         (p.descripcion || '').toLowerCase().includes(term) ||
421:         (p.categoria || '').toLowerCase().includes(term)
422:       );
423:     });
424:   }, [products, productSearchTerm, selectedProductCategory]);
425: 
426:   const handleOpenProductModal = (index: number | null = null) => {
427:     setActiveItemIndexForProduct(index);
428:     setProductSearchTerm('');
429:     setSelectedProductCategory('all');
430:     setIsProductModalOpen(true);
431:   };
432: 
433:   const handleSelectProductFromModal = (prod: ProductModel) => {
434:     let targetIndex = activeItemIndexForProduct;
435: 
436:     // Si no había índice activo (ej. botón global "+ Buscar en Catálogo"), buscamos una línea vacía o agregamos una nueva
437:     if (targetIndex === null || targetIndex < 0 || targetIndex >= items.length) {
438:       const emptyIdx = items.findIndex(it => !it.producto_id && !it.descripcion && (it.precio_unitario === 0 || !it.precio_unitario));
439:       if (emptyIdx !== -1) {
440:         targetIndex = emptyIdx;
441:       } else {
442:         targetIndex = items.length;
443:       }
444:     }
445: 
446:     setItems(prev => {
447:       const updated = [...prev];
448:       const existingLine = targetIndex !== null && targetIndex < updated.length ? updated[targetIndex] : null;
449:       const qty = existingLine ? (Number(existingLine.cantidad) || 1) : 1;
450: 
451:       // Calcular precio unitario según la moneda de emisión (USD o VES)
452:       let price = Number(prod.precio_venta) || 0;
453:       if (currency === 'VES' && exchangeRate > 0) {
454:         price = price * exchangeRate;
455:       }
456: 
457:       const lineSubtotal = qty * price;
458:       const isExempt = !prod.aplica_iva;
459:       const iva = isExempt ? 0 : lineSubtotal * 0.16;
460:       const cleanName = (prod.nombre || '').replace(/\s*\(E\)\s*$/i, '').trim();
461:       const itemDescription = isExempt ? `${cleanName} (E)` : cleanName;
462: 
463:       const newItem: FacturaItemModel = {
464:         id: existingLine?.id || `item_${Date.now()}_${targetIndex}`,
465:         producto_id: prod.id,
466:         codigo: prod.codigo,
467:         descripcion: itemDescription,
468:         cantidad: qty,
469:         precio_unitario: price,
470:         exento: isExempt,
471:         subtotal: lineSubtotal,
472:         iva_monto: iva,
473:         total: lineSubtotal + iva,
474:         cuenta_ingreso_id: prod.cuenta_venta_id || '4.1.01.001',
475:         cuenta_costo_id: prod.cuenta_costo_id || '5.1.01.001',
476:         cuenta_inventario_id: prod.cuenta_inventario_id || '1.1.04.001'
477:       };
478: 
479:       if (targetIndex !== null && targetIndex < updated.length) {
480:         updated[targetIndex] = newItem;
481:       } else {
482:         updated.push(newItem);
483:       }
484:       return updated;
485:     });
486: 
487:     setIsProductModalOpen(false);
488:     setActiveItemIndexForProduct(null);
489:     showToast?.(`Artículo "${prod.nombre}" añadido a la factura`, 'success');
490:   };
491: 
492:   // Conversión automática de moneda y multiplicación por tasa de cambio al cambiar a Bolívares
493:   const handleCurrencyChange = (newCurrency: 'USD' | 'VES') => {
494:     if (newCurrency === currency) return;
495: 
496:     setCurrency(newCurrency);
497: 
498:     setItems(prevItems => {
499:       return prevItems.map(item => {
500:         // Si la fila está completamente vacía, conservarla sin cambios
501:         if (!item.producto_id && !item.descripcion && !item.precio_unitario) {
502:           return item;
503:         }
504: 
505:         const qty = Number(item.cantidad) || 1;
506:         const prod = products.find(p => p.id === item.producto_id);
507: 
508:         let newUnitPrice = Number(item.precio_unitario) || 0;
509: 
510:         if (newCurrency === 'VES') {
511:           // AL CAMBIAR A BOLÍVARES: Tomar el precio del producto y multiplicarlo por la tasa de cambio
512:           if (prod && Number(prod.precio_venta) > 0) {
513:             newUnitPrice = Number(prod.precio_venta) * exchangeRate;
514:           } else if (newUnitPrice > 0 && exchangeRate > 0) {
515:             newUnitPrice = newUnitPrice * exchangeRate;
516:           }
517:         } else {
518:           // AL CAMBIAR A DÓLARES: Restaurar el precio base del producto en USD o dividir por la tasa
519:           if (prod && Number(prod.precio_venta) > 0) {
520:             newUnitPrice = Number(prod.precio_venta);
521:           } else if (newUnitPrice > 0 && exchangeRate > 0) {
522:             newUnitPrice = newUnitPrice / exchangeRate;
523:           }
524:         }
525: 
526:         newUnitPrice = Number(newUnitPrice.toFixed(2));
527:         const isExempt = item.exento;
528:         const lineSubtotal = Number((qty * newUnitPrice).toFixed(2));
529:         const lineIva = isExempt ? 0 : Number((lineSubtotal * 0.16).toFixed(2));
530: 
531:         return {
532:           ...item,
533:           precio_unitario: newUnitPrice,
534:           subtotal: lineSubtotal,
535:           iva_monto: lineIva,
536:           total: Number((lineSubtotal + lineIva).toFixed(2))
537:         };
538:       });
539:     });
540: 
541:     if (showToast) {
542:       showToast(
543:         newCurrency === 'VES'
544:           ? `Precios convertidos a Bolívares (Tasa: Bs. ${exchangeRate.toFixed(2)})`
545:           : 'Precios convertidos a Dólares ($)',
546:         'info'
547:       );
548:     }
549:   };
550: 
551:   const recalculateItemsInVES = (customRate?: number) => {
552:     const rate = customRate || exchangeRate;
553:     if (rate <= 0) return;
554: 
555:     setItems(prevItems => {
556:       return prevItems.map(item => {
557:         if (!item.producto_id && !item.descripcion && !item.precio_unitario) {
558:           return item;
559:         }
560: 
561:         const qty = Number(item.cantidad) || 1;
562:         const prod = products.find(p => p.id === item.producto_id);
563: 
564:         let newUnitPrice = Number(item.precio_unitario) || 0;
565:         if (prod && Number(prod.precio_venta) > 0) {
566:           newUnitPrice = Number(prod.precio_venta) * rate;
567:         } else if (currency === 'VES' && newUnitPrice > 0 && exchangeRate > 0) {
568:           newUnitPrice = (newUnitPrice / exchangeRate) * rate;
569:         }
570: 
571:         newUnitPrice = Number(newUnitPrice.toFixed(2));
572:         const isExempt = item.exento;
573:         const lineSubtotal = Number((qty * newUnitPrice).toFixed(2));
574:         const lineIva = isExempt ? 0 : Number((lineSubtotal * 0.16).toFixed(2));
575: 
576:         return {
577:           ...item,
578:           precio_unitario: newUnitPrice,
579:           subtotal: lineSubtotal,
580:           iva_monto: lineIva,
581:           total: Number((lineSubtotal + lineIva).toFixed(2))
582:         };
583:       });
584:     });
585: 
586:     showToast?.(`Precios recalculados a la tasa de Bs. ${rate.toFixed(2)}`, 'success');
587:   };
588: 
589:   const handleOpenNewCustomerModal = () => {
590:     setCustomerModalForm({
591:       name: '',
592:       isCompany: true,
593:       taxIdPrefix: 'J',
594:       taxIdNumber: '',
595:       email: '',
596:       phone: '',
597:       personaContacto: '',
598:       cargo: '',
599:       address: '',
600:       debitAccount: '',
601:       creditAccount: ''
602:     });
603:     setCustomerAccountError(null);
604:     setActiveCustomerModalTab('info');
605:     setIsNewCustomerModalOpen(true);
606:   };
607: 
608:   const handleSaveCustomerFromModal = (e: React.FormEvent) => {
609:     e.preventDefault();
610:     if (!customerModalForm.name.trim()) {
611:       showToast?.('El nombre o razón social es obligatorio', 'error');
612:       return;
613:     }
614: 
615:     // Validación obligatoria de cuentas contables vinculadas manualmente
616:     if (!customerModalForm.debitAccount?.trim() || !customerModalForm.creditAccount?.trim()) {
617:       setActiveCustomerModalTab('contabilidad');
618:       const msg = !customerModalForm.debitAccount?.trim() && !customerModalForm.creditAccount?.trim()
619:         ? 'Debe vincular las cuentas contables (Cuenta por Cobrar y Anticipo) de forma manual antes de registrar el cliente'
620:         : !customerModalForm.debitAccount?.trim()
621:           ? 'Debe vincular la Cuenta por Cobrar del cliente de forma manual'
622:           : 'Debe vincular la Cuenta de Anticipo del cliente de forma manual';
623:       setCustomerAccountError(msg);
624:       showToast?.(msg, 'error');
625:       return;
626:     }
627: 
628:     const fullTaxId = customerModalForm.taxIdNumber.trim()
629:       ? `${customerModalForm.taxIdPrefix}-${customerModalForm.taxIdNumber.trim().toUpperCase()}`
630:       : `${customerModalForm.taxIdPrefix}-00000000-0`;
631: 
632:     const newContact = {
633:       id: `ct_${Date.now()}`,
634:       name: customerModalForm.name.trim(),
635:       type: 'customer',
636:       taxId: fullTaxId,
637:       email: customerModalForm.email.trim(),
638:       phone: customerModalForm.phone.trim(),
639:       address: customerModalForm.address.trim(),
640:       isCompany: customerModalForm.isCompany,
641:       personaContacto: customerModalForm.personaContacto.trim(),
642:       cargo: customerModalForm.cargo.trim(),
643:       debitAccount: customerModalForm.debitAccount,
644:       creditAccount: customerModalForm.creditAccount,
645:       saldo: 0,
646:       activo: true,
647:       created_at: new Date().toISOString()
648:     };
649: 
650:     onSave?.('contactos', newContact);
651:     handleSelectCustomer(newContact);
652:     setIsNewCustomerModalOpen(false);
653:     showToast?.('Cliente registrado y seleccionado en la factura', 'success');
654:   };
655: 
656:   // Manejo de Items
657:   const handleAddItem = () => {
658:     setItems(prev => [
659:       ...prev,
660:       {
661:         id: `item_${Date.now()}_${prev.length + 1}`,
662:         producto_id: '',
663:         codigo: '',
664:         descripcion: '',
665:         cantidad: 1,
666:         precio_unitario: 0,
667:         exento: false,
668:         subtotal: 0,
669:         iva_monto: 0,
670:         total: 0,
671:         cuenta_ingreso_id: '4.1.01.001',
672:         cuenta_costo_id: '5.1.01.001',
673:         cuenta_inventario_id: '1.1.04.001'
674:       }
675:     ]);
676:   };
677: 
678:   const handleRemoveItem = (index: number) => {
679:     if (items.length === 1) {
680:       showToast?.('La factura debe tener al menos una línea', 'info');
681:       return;
682:     }
683:     setItems(prev => prev.filter((_, idx) => idx !== index));
684:   };
685: 
686:   const handleProductSelect = (index: number, productId: string) => {
687:     const prod = products.find(p => p.id === productId);
688:     setItems(prev => {
689:       const updated = [...prev];
690:       if (prod) {
691:         const qty = updated[index].cantidad || 1;
692:         // Si la moneda es VES, convertir el precio venta en USD a VES
693:         let price = prod.precio_venta || 0;
694:         if (currency === 'VES' && exchangeRate > 0) {
695:           price = price * exchangeRate;
696:         }
697: 
698:         const lineSubtotal = qty * price;
699:         const isExempt = !prod.aplica_iva;
700:         const iva = isExempt ? 0 : lineSubtotal * 0.16;
701: 
702:         updated[index] = {
703:           ...updated[index],
704:           producto_id: prod.id,
705:           codigo: prod.codigo,
706:           descripcion: prod.nombre,
707:           precio_unitario: price,
708:           exento: isExempt,
709:           subtotal: lineSubtotal,
710:           iva_monto: iva,
711:           total: lineSubtotal + iva,
712:           cuenta_ingreso_id: prod.cuenta_venta_id || '4.1.01.001',
713:           cuenta_costo_id: prod.cuenta_costo_id || '5.1.01.001',
714:           cuenta_inventario_id: prod.cuenta_inventario_id || '1.1.04.001'
715:         };
716:       } else {
717:         updated[index] = {
718:           ...updated[index],
719:           producto_id: '',
720:           codigo: '',
721:           descripcion: '',
722:           precio_unitario: 0,
723:           subtotal: 0,
724:           iva_monto: 0,
725:           total: 0
726:         };
727:       }
728:       return updated;
729:     });
730:   };
731: 
732:   const handleItemFieldChange = (index: number, field: string, value: any) => {
733:     setItems(prev => {
734:       const updated = [...prev];
735:       const item = { ...updated[index], [field]: value };
736: 
737:       const qty = Number(item.cantidad) || 0;
738:       const price = Number(item.precio_unitario) || 0;
739:       const lineSubtotal = qty * price;
740:       const iva = item.exento ? 0 : lineSubtotal * 0.16;
741: 
742:       item.subtotal = lineSubtotal;
743:       item.iva_monto = iva;
744:       item.total = lineSubtotal + iva;
745: 
746:       updated[index] = item;
747:       return updated;
748:     });
749:   };
750: 
751:   // =========================================================================
752:   // PASO 1: Validar Formulario y Abrir Modal de Condición (Contado o Crédito)
753:   // =========================================================================
754:   const handleStartEmission = (e: React.FormEvent) => {
755:     e.preventDefault();
756: 
757:     if (!customerName || !customerRif) {
758:       showToast?.('Seleccione o registre el cliente a quien se emitirá la factura', 'error');
759:       return;
760:     }
761: 
762:     if (!invoiceNumber.trim()) {
763:       showToast?.('El número de documento es obligatorio', 'error');
764:       return;
765:     }
766: 
767:     if (items.some(i => !i.descripcion.trim() || i.cantidad <= 0)) {
768:       showToast?.('Complete la descripción y cantidad válida en cada línea', 'error');
769:       return;
770:     }
771: 
772:     if (totals.total <= 0) {
773:       showToast?.('El total de la factura debe ser mayor a 0', 'error');
774:       return;
775:     }
776: 
777:     // Validar año contable
778:     if (workingYear && issueDate) {
779:       const yr = issueDate.substring(0, 4);
780:       if (yr !== workingYear) {
781:         showToast?.(`La fecha (${yr}) no coincide con el período contable seleccionado (${workingYear})`, 'error');
782:         return;
783:       }
784:     }
785: 
786:     // Si hay productos con stock 0 o insuficiente y aún no han sido autorizados con clave master
787:     if (zeroStockItems.length > 0 && !isZeroStockAuthorized) {
788:       setIsMasterAuthModalOpen(true);
789:       return;
790:     }
791: 
792:     // Proceder directamente según la condición de pago seleccionada en la cabecera
793:     if (selectedCondition === 'credito') {
794:       buildAndShowVoucher('credito');
795:     } else {
796:       handleSelectCondition('contado');
797:     }
798:   };
799: 
800:   const handleResetForm = () => {
The above content does NOT show the entire file contents. If you need to view any lines of the file which were not shown to complete your task, call this tool again to view those lines.
