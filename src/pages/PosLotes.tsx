import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, Landmark, CheckCircle2, Clock, AlertTriangle, 
  ArrowRight, Plus, Search, Calendar, DollarSign, Check, X, 
  Receipt, ShieldCheck, RefreshCw, FileText, ChevronRight, 
  Eye, Edit2, Trash2, ArrowUpRight, Scale, Filter
} from 'lucide-react';
import BackButton from '../components/common/BackButton';
import { LotePosModel, TerminalPosModel, BancoModel, LotePosTransaccion } from '../types/database';
import { dbFetchTerminalesPos, dbSaveTerminalPos, dbFetchLotesPos, dbSaveLotePos, dbSaveComprobante } from '../services/db';
import { formatDate } from '../utils/dateUtils';
import { formatNumber } from '../utils/numberFormat';
import { useCompany } from '../context/CompanyContext';
import { getTasaForDate, fetchLiveBcvRate } from '../services/exchangeRateService';
import CuentaSelectorTrigger from '../components/common/CuentaSelectorTrigger';
import CuentaContableModal from '../components/common/CuentaContableModal';
import VoucherPreviewModal from '../components/common/VoucherPreviewModal';

interface PosLotesProps {
  bancos: BancoModel[];
  cuentasContables?: any[];
  configContable?: any;
  comprobantes?: any[];
  onSave?: (collection: string, data: any) => void;
  showToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  workingYear?: string;
}

export default function PosLotes({
  bancos = [],
  cuentasContables = [],
  configContable,
  comprobantes = [],
  onSave,
  showToast,
  workingYear
}: PosLotesProps) {
  const { availableCompanies, activeCompanyId } = useCompany();
  const activeCompany = availableCompanies.find(c => c.id === activeCompanyId);
  const monedaPrincipal = activeCompany?.monedaPrincipal || configContable?.moneda_principal || 'USD';
  const isPrincipalUSD = monedaPrincipal === 'USD' || monedaPrincipal === '$';
  const symbolPrincipal = isPrincipalUSD ? '$' : monedaPrincipal;
  const symbolSecundaria = 'Bs.';

  const [currentTasa, setCurrentTasa] = useState<number>(() => getTasaForDate());
  const [isSyncingTasa, setIsSyncingTasa] = useState(false);

  useEffect(() => {
    const handleTasaUpdate = () => setCurrentTasa(getTasaForDate());
    window.addEventListener('tasa-cambio-updated', handleTasaUpdate);
    return () => window.removeEventListener('tasa-cambio-updated', handleTasaUpdate);
  }, []);

  const handleSyncBcvRate = async () => {
    setIsSyncingTasa(true);
    try {
      const res = await fetchLiveBcvRate(true);
      if (res.success && res.tasa) {
        setCurrentTasa(res.tasa);
        setLiquidacionForm(prev => ({ ...prev, tasaCambio: res.tasa! }));
        showToast?.(`Tasa BCV actualizada en vivo: Bs. ${res.tasa.toFixed(2)} / USD`, 'success');
      } else {
        showToast?.('No se pudo sincronizar con el BCV. Verifique la conexión.', 'error');
      }
    } catch (e) {
      console.error(e);
      showToast?.('Error al consultar la tasa del BCV', 'error');
    } finally {
      setIsSyncingTasa(false);
    }
  };

  const [activeTab, setActiveTab] = useState<'abiertos' | 'pendientes' | 'historial' | 'terminales'>('abiertos');
  const [posViewMode, setPosViewMode] = useState<'tarjetas' | 'lista'>('tarjetas');
  const [terminales, setTerminales] = useState<TerminalPosModel[]>([]);
  const [lotes, setLotes] = useState<LotePosModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [isCierreModalOpen, setIsCierreModalOpen] = useState(false);
  const [selectedLoteForCierre, setSelectedLoteForCierre] = useState<LotePosModel | null>(null);

  const [isLiquidacionModalOpen, setIsLiquidacionModalOpen] = useState(false);
  const [selectedLoteForLiquidacion, setSelectedLoteForLiquidacion] = useState<LotePosModel | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLoteDetail, setSelectedLoteDetail] = useState<LotePosModel | null>(null);

  const [isTerminalModalOpen, setIsTerminalModalOpen] = useState(false);
  const [editingTerminal, setEditingTerminal] = useState<TerminalPosModel | null>(null);

  // Modal de Asiento Contable previo al registro (NIIF / Partida Doble)
  const [pendingVoucher, setPendingVoucher] = useState<{
    comprobante: any;
    onConfirm: (finalComprobante: any) => Promise<void> | void;
    title?: string;
    subtitle?: string;
  } | null>(null);

  const [showCuentaModal, setShowCuentaModal] = useState(false);
  const [activeAccountKey, setActiveAccountKey] = useState<'transitoria' | 'comision'>('transitoria');

  // Formulario Cierre y Conciliación de Lote
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
  const [montoReporteBs, setMontoReporteBs] = useState('');
  const [loteNumeroInput, setLoteNumeroInput] = useState('');
  const [notasCierre, setNotasCierre] = useState('');
  const [modalVoucherSearch, setModalVoucherSearch] = useState('');
  const [cierreForm, setCierreForm] = useState({
    loteNumero: '',
    totalOperacionesTicket: 0,
    montoTicketBs: '',
    notas: ''
  });

  // Formulario Liquidación Bancaria
  const [liquidacionForm, setLiquidacionForm] = useState({
    bancoId: '',
    fechaAcreditacion: new Date().toISOString().split('T')[0],
    referenciaBanco: '',
    tasaCambio: getTasaForDate(),
    comisionPorcentaje: 1.5,
    retencionIva: 0,
    retencionIslr: 0,
    notas: ''
  });

  // Formulario Terminal
  const [terminalForm, setTerminalForm] = useState({
    codigo: '',
    nombre: '',
    bancoId: '',
    cuentaTransitoriaId: '1.1.01.03',
    cuentaComisionId: '6.1.02.01',
    comisionEstimada: 1.5,
    tipoCuenta: 'nacional' as 'nacional' | 'internacional',
    activo: true
  });

  // Búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');

  // Cargar datos
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [terms, batchList] = await Promise.all([
        dbFetchTerminalesPos(activeCompanyId),
        dbFetchLotesPos(activeCompanyId)
      ]);
      setTerminales(terms || []);
      setLotes(batchList || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeCompanyId]);

  // Garantizar que cada terminal activa tenga un lote "abierto"
  const openBatches = useMemo(() => {
    const list: LotePosModel[] = [];
    terminales.filter(t => t.activo).forEach(term => {
      let open = lotes.find(l => l.terminal_id === term.id && l.estado === 'abierto');
      if (!open) {
        // Lote virtual abierto listo para recibir cobros
        open = {
          id: `lote_open_${term.id}`,
          terminal_id: term.id,
          terminal_nombre: term.nombre,
          banco_id: term.banco_id,
          lote_numero: 'EN CURSO',
          fecha_apertura: new Date().toISOString().split('T')[0],
          total_operaciones: 0,
          monto_bruto_sistema: 0,
          monto_bruto_usd: 0,
          monto_bruto_ticket: 0,
          diferencia: 0,
          comision_monto: 0,
          monto_neto_banco: 0,
          monto_neto_banco_bs: 0,
          estado: 'abierto',
          transacciones: []
        };
      }
      list.push(open);
    });
    return list;
  }, [terminales, lotes]);

  // Lotes cerrados pendientes de acreditar
  const pendingBatches = useMemo(() => {
    return lotes.filter(l => l.estado === 'cerrado_pendiente');
  }, [lotes]);

  // Historial de lotes acreditados
  const historyBatches = useMemo(() => {
    return lotes.filter(l => l.estado === 'acreditado_conciliado');
  }, [lotes]);

  // KPIs Totales (Moneda Principal USD y Secundaria Bs como referencia)
  const totalMontoAbiertoUSD = useMemo(() => {
    return openBatches.reduce((sum, l) => {
      const usd = l.monto_bruto_usd || (l.transacciones?.reduce((s, t) => s + (Number(t.monto_usd) || 0), 0)) || ((l.monto_bruto_sistema || 0) / (currentTasa || 1));
      return sum + Number(usd || 0);
    }, 0);
  }, [openBatches, currentTasa]);

  const totalMontoAbiertoBs = useMemo(() => {
    return openBatches.reduce((sum, l) => sum + (l.monto_bruto_sistema || 0), 0);
  }, [openBatches]);

  const totalMontoPendienteUSD = useMemo(() => {
    return pendingBatches.reduce((sum, l) => {
      const bs = l.monto_bruto_ticket || l.monto_bruto_sistema || 0;
      const usd = l.monto_bruto_usd || (l.transacciones?.reduce((s, t) => s + (Number(t.monto_usd) || 0), 0)) || (bs / (l.tasa_cambio || currentTasa || 1));
      return sum + Number(usd || 0);
    }, 0);
  }, [pendingBatches, currentTasa]);

  const totalMontoPendienteBs = useMemo(() => {
    return pendingBatches.reduce((sum, l) => sum + (l.monto_bruto_ticket || l.monto_bruto_sistema || 0), 0);
  }, [pendingBatches]);

  const totalConciliadoUSD = useMemo(() => {
    return historyBatches.reduce((sum, l) => {
      const tasa = l.tasa_cambio || currentTasa || 1;
      let usd = 0;
      if (l.monto_neto_banco !== undefined && l.monto_neto_banco_bs !== undefined) {
        usd = Number(l.monto_neto_banco || 0);
      } else if (l.monto_neto_banco) {
        // Compatibilidad histórica: si fue guardado en Bs en pruebas iniciales (> 5000)
        usd = l.monto_neto_banco > 5000 ? l.monto_neto_banco / tasa : l.monto_neto_banco;
      }
      return sum + usd;
    }, 0);
  }, [historyBatches, currentTasa]);

  const totalConciliadoBs = useMemo(() => {
    return historyBatches.reduce((sum, l) => {
      const tasa = l.tasa_cambio || currentTasa || 1;
      let bs = 0;
      if (l.monto_neto_banco_bs !== undefined) {
        bs = Number(l.monto_neto_banco_bs || 0);
      } else if (l.monto_neto_banco) {
        bs = l.monto_neto_banco > 5000 ? l.monto_neto_banco : l.monto_neto_banco * tasa;
      }
      return sum + bs;
    }, 0);
  }, [historyBatches, currentTasa]);

  // =========================================================================
  // CONCILIACIÓN DE VOUCHERS Y CIERRE DE LOTE
  // =========================================================================
  const handleOpenCierreModal = (lote: LotePosModel) => {
    setSelectedLoteForCierre(lote);
    setSelectedTxIds(new Set());
    setMontoReporteBs('');
    setLoteNumeroInput('');
    setNotasCierre('');
    setModalVoucherSearch('');
    setIsCierreModalOpen(true);
  };

  // Vouchers seleccionados en el modal de conciliación
  const selectedTransactions = useMemo(() => {
    if (!selectedLoteForCierre) return [];
    return (selectedLoteForCierre.transacciones || []).filter(tx => selectedTxIds.has(tx.id));
  }, [selectedLoteForCierre, selectedTxIds]);

  const totalSeleccionadoBs = useMemo(() => {
    return selectedTransactions.reduce((acc, tx) => acc + (Number(tx.monto_bs) || 0), 0);
  }, [selectedTransactions]);

  const totalSeleccionadoUsd = useMemo(() => {
    return selectedTransactions.reduce((acc, tx) => acc + (Number(tx.monto_usd) || 0), 0);
  }, [selectedTransactions]);

  const montoReporteNum = useMemo(() => {
    if (!montoReporteBs) return 0;
    return parseFloat(montoReporteBs.replace(',', '.')) || 0;
  }, [montoReporteBs]);

  const diferenciaConciliacion = useMemo(() => {
    if (!montoReporteBs) return 0;
    return Number((montoReporteNum - totalSeleccionadoBs).toFixed(2));
  }, [montoReporteNum, totalSeleccionadoBs, montoReporteBs]);

  const isCuadrado = useMemo(() => {
    if (!montoReporteBs || selectedTxIds.size === 0) return false;
    return Math.abs(montoReporteNum - totalSeleccionadoBs) < 0.01;
  }, [montoReporteBs, selectedTxIds, montoReporteNum, totalSeleccionadoBs]);

  const handleToggleTx = (txId: string) => {
    setSelectedTxIds(prev => {
      const next = new Set(prev);
      if (next.has(txId)) {
        next.delete(txId);
      } else {
        next.add(txId);
      }
      return next;
    });
  };

  const handleSelectAllTxs = (txs: LotePosTransaccion[]) => {
    const next = new Set(selectedTxIds);
    txs.forEach(t => next.add(t.id));
    setSelectedTxIds(next);
  };

  const handleDeselectAllTxs = () => {
    setSelectedTxIds(new Set());
  };

  const filteredModalTxs = useMemo(() => {
    if (!selectedLoteForCierre) return [];
    const list = selectedLoteForCierre.transacciones || [];
    if (!modalVoucherSearch.trim()) return list;
    const q = modalVoucherSearch.toLowerCase();
    return list.filter(t => 
      (t.factura_numero && t.factura_numero.toLowerCase().includes(q)) ||
      (t.cliente_nombre && t.cliente_nombre.toLowerCase().includes(q)) ||
      (t.referencia && t.referencia.toLowerCase().includes(q))
    );
  }, [selectedLoteForCierre, modalVoucherSearch]);

  const handleConfirmCierre = async (e: React.FormEvent, proceedToLiquidacion: boolean = false) => {
    e.preventDefault();
    if (!selectedLoteForCierre) return;

    if (!isCuadrado) {
      showToast?.('El lote debe estar cuadrado con el reporte del punto para proceder.', 'error');
      return;
    }

    if (!loteNumeroInput.trim()) {
      showToast?.('Ingrese el número de lote impreso en el ticket del punto de venta', 'error');
      return;
    }

    const allTxs = selectedLoteForCierre.transacciones || [];
    const selectedTxs = allTxs.filter(t => selectedTxIds.has(t.id));
    const remainingTxs = allTxs.filter(t => !selectedTxIds.has(t.id));

    const totalUsdCalculado = totalSeleccionadoUsd > 0
      ? totalSeleccionadoUsd
      : Number((totalSeleccionadoBs / (currentTasa || 1)).toFixed(2));

    // 1. Guardar el nuevo lote cerrado (cerrado_pendiente)
    const loteCerrado: LotePosModel = {
      ...selectedLoteForCierre,
      id: crypto.randomUUID(),
      empresa_id: activeCompanyId,
      lote_numero: loteNumeroInput.trim(),
      fecha_cierre: new Date().toISOString(),
      total_operaciones: selectedTxs.length,
      monto_bruto_sistema: totalSeleccionadoBs,
      monto_bruto_ticket: montoReporteNum,
      monto_bruto_usd: totalUsdCalculado,
      tasa_cambio: currentTasa,
      diferencia: 0,
      estado: 'cerrado_pendiente',
      transacciones: selectedTxs,
      notas: notasCierre.trim()
    };

    await dbSaveLotePos(loteCerrado, activeCompanyId);
    onSave?.('lotesPos', loteCerrado);

    // 2. Actualizar el lote abierto virtual para mantener los restantes (si hay) o dejarlo en 0
    const openId = selectedLoteForCierre.id.startsWith('lote_open_')
      ? selectedLoteForCierre.id
      : `lote_open_${selectedLoteForCierre.terminal_id}`;

    const remainingBs = Number(remainingTxs.reduce((sum, t) => sum + (Number(t.monto_bs) || 0), 0).toFixed(2));
    const remainingUsd = Number(remainingTxs.reduce((sum, t) => sum + (Number(t.monto_usd) || (Number(t.monto_bs) / (currentTasa || 1))), 0).toFixed(2));

    const remainingOpen: LotePosModel = {
      ...selectedLoteForCierre,
      id: openId,
      lote_numero: 'EN CURSO',
      total_operaciones: remainingTxs.length,
      monto_bruto_sistema: remainingBs,
      monto_bruto_usd: remainingUsd,
      monto_bruto_ticket: 0,
      diferencia: 0,
      estado: 'abierto',
      transacciones: remainingTxs,
      fecha_cierre: undefined,
      notas: ''
    };

    await dbSaveLotePos(remainingOpen, activeCompanyId);
    onSave?.('lotesPos', remainingOpen);

    showToast?.(`Lote Nº ${loteCerrado.lote_numero} cerrado exitosamente. ${selectedTxs.length} transacciones por ${symbolPrincipal} ${totalUsdCalculado.toFixed(2)} (Ref: Bs. ${totalSeleccionadoBs.toFixed(2)}).`, 'success');
    setIsCierreModalOpen(false);
    setSelectedLoteForCierre(null);
    await loadData();

    if (proceedToLiquidacion) {
      handleOpenLiquidacionModal(loteCerrado);
    }
  };

  // =========================================================================
  // LIQUIDACIÓN Y CONCILIACIÓN BANCARIA
  // =========================================================================
  const handleOpenLiquidacionModal = (lote: LotePosModel) => {
    setSelectedLoteForLiquidacion(lote);
    const term = terminales.find(t => t.id === lote.terminal_id);
    const defaultBancoId = term?.banco_id || (bancos.length > 0 ? bancos[0].id : '');
    const defaultComisionPct = term?.comision_estimada || 1.5;
    const defaultTasa = lote.tasa_cambio || getTasaForDate() || currentTasa;

    setLiquidacionForm({
      bancoId: defaultBancoId,
      fechaAcreditacion: new Date().toISOString().split('T')[0],
      referenciaBanco: `LIQ-LOTE-${lote.lote_numero}`,
      tasaCambio: defaultTasa,
      comisionPorcentaje: defaultComisionPct,
      retencionIva: 0,
      retencionIslr: 0,
      notas: ''
    });
    setIsLiquidacionModalOpen(true);
  };

  const calculatedLiquidacion = useMemo(() => {
    if (!selectedLoteForLiquidacion) {
      return {
        montoBrutoBs: 0,
        montoBrutoUSD: 0,
        tasa: currentTasa || 1,
        comisionMontoBs: 0,
        comisionMontoUSD: 0,
        retIvaBs: 0,
        retIvaUSD: 0,
        retIslrBs: 0,
        retIslrUSD: 0,
        netoBs: 0,
        netoUSD: 0
      };
    }
    const tasa = Number(liquidacionForm.tasaCambio) > 0 ? Number(liquidacionForm.tasaCambio) : (currentTasa || 1);
    const montoBrutoBs = selectedLoteForLiquidacion.monto_bruto_ticket || selectedLoteForLiquidacion.monto_bruto_sistema || 0;
    const montoBrutoUSD = selectedLoteForLiquidacion.monto_bruto_usd 
      ? Number(selectedLoteForLiquidacion.monto_bruto_usd) 
      : Number((montoBrutoBs / tasa).toFixed(2));

    const comisionMontoBs = Number((montoBrutoBs * (liquidacionForm.comisionPorcentaje / 100)).toFixed(2));
    const comisionMontoUSD = Number((montoBrutoUSD * (liquidacionForm.comisionPorcentaje / 100)).toFixed(2));

    const retIvaBs = Number(liquidacionForm.retencionIva) || 0;
    const retIvaUSD = Number((retIvaBs / tasa).toFixed(2));

    const retIslrBs = Number(liquidacionForm.retencionIslr) || 0;
    const retIslrUSD = Number((retIslrBs / tasa).toFixed(2));

    const netoBs = Number((montoBrutoBs - comisionMontoBs - retIvaBs - retIslrBs).toFixed(2));
    const netoUSD = Number((montoBrutoUSD - comisionMontoUSD - retIvaUSD - retIslrUSD).toFixed(2));

    return {
      montoBrutoBs,
      montoBrutoUSD,
      tasa,
      comisionMontoBs,
      comisionMontoUSD,
      retIvaBs,
      retIvaUSD,
      retIslrBs,
      retIslrUSD,
      netoBs: Math.max(0, netoBs),
      netoUSD: Math.max(0, netoUSD)
    };
  }, [selectedLoteForLiquidacion, liquidacionForm, currentTasa]);

  const handleConfirmLiquidacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoteForLiquidacion) return;

    if (!liquidacionForm.bancoId) {
      showToast?.('Seleccione la cuenta bancaria donde se acreditó el lote', 'error');
      return;
    }

    const bank = bancos.find(b => b.id === liquidacionForm.bancoId);
    if (!bank) {
      showToast?.('Cuenta bancaria no encontrada', 'error');
      return;
    }

    const {
      montoBrutoBs,
      montoBrutoUSD,
      tasa,
      comisionMontoBs,
      comisionMontoUSD,
      retIvaBs,
      retIvaUSD,
      retIslrBs,
      retIslrUSD,
      netoBs,
      netoUSD
    } = calculatedLiquidacion;

    const movBancoId = `mov_liq_pos_${Date.now()}`;
    const voucherId = `comp_liq_pos_${Date.now()}`;

    // Preparar Asiento Contable Automatizado de Liquidación POS para revisión del usuario
    // El asiento es el reverso de la cuenta asociada a la terminal (HABER)
    // Entra en la cuenta contable del banco seleccionado (DEBE)
    // Entra en la cuenta de comisión bancaria asociada a la terminal (DEBE)
    const terminalAsociada = terminales.find(t => t.id === selectedLoteForLiquidacion.terminal_id) 
      || terminales.find(t => t.nombre === selectedLoteForLiquidacion.terminal_nombre);

    const getAccountDetails = (idOrCode?: string, defaultCode = '', defaultName = '') => {
      if (idOrCode) {
        const found = cuentasContables.find(c => 
          c.id === idOrCode || 
          c.codigo === idOrCode || 
          (c.codigo && idOrCode && c.codigo.replace(/\./g, '') === idOrCode.replace(/\./g, ''))
        );
        if (found) {
          return {
            id: found.id,
            codigo: found.codigo,
            nombre: found.nombre
          };
        }
      }
      if (defaultCode) {
        const foundDef = cuentasContables.find(c => 
          c.codigo === defaultCode || 
          (c.codigo && c.codigo.replace(/\./g, '') === defaultCode.replace(/\./g, '')) ||
          (c.nombre && c.nombre.toLowerCase().includes(defaultName.toLowerCase()))
        );
        if (foundDef) {
          return {
            id: foundDef.id,
            codigo: foundDef.codigo,
            nombre: foundDef.nombre
          };
        }
      }
      return {
        id: idOrCode || defaultCode,
        codigo: defaultCode || idOrCode || '',
        nombre: defaultName
      };
    };

    // A. Cuenta del Banco receptor (DEBE -> Ingreso neto disponible)
    const accBanco = getAccountDetails(
      bank.cuenta_contable_id || (bank as any).cuentaContableId,
      '1.1.02.01',
      `Banco ${bank.banco}`
    );

    // B. Cuenta de Comisión Bancaria asociada a la terminal (DEBE -> Gasto comisión POS)
    const accComision = getAccountDetails(
      terminalAsociada?.cuenta_comision_id,
      '6.1.01.27',
      'Comisiones Bancarias'
    );

    // C. Cuenta Transitoria asociada a la terminal (HABER -> Reverso total del lote)
    const accTransitoria = getAccountDetails(
      terminalAsociada?.cuenta_transitoria_id,
      '1.1.02.05',
      'POS Transitoria (Puntos de Venta por Liquidar)'
    );

    // D. Retenciones fiscales si aplican
    const accRetIva = getAccountDetails(
      configContable?.cuentaRetencionIvaVentas,
      '1.1.05.001',
      'Retención de IVA por Descontar (POS)'
    );
    const accRetIslr = getAccountDetails(
      configContable?.cuentaRetencionIslrVentas,
      '1.1.05.002',
      'Retención de ISLR por Descontar (POS)'
    );

    const lineasComprobante: any[] = [
      // 1. ENTRA AL BANCO (DEBE) -> Monto Neto
      {
        id: `as_${Date.now()}_1`,
        cuentaId: accBanco.id,
        cuenta_id: accBanco.id,
        cuentaCodigo: accBanco.codigo,
        nombreCuenta: `${accBanco.codigo} - ${accBanco.nombre}`,
        descripcion: `Acreditación neta Lote POS Nº ${selectedLoteForLiquidacion.lote_numero} en ${bank.banco} ($${netoUSD.toFixed(2)} / Ref Bs. ${netoBs.toFixed(2)})`,
        debe: netoUSD,
        haber: 0
      },
      // 2. ENTRA A LA CUENTA DE COMISIÓN BANCARIA DEL TERMINAL (DEBE) -> Gasto Comisión
      {
        id: `as_${Date.now()}_2`,
        cuentaId: accComision.id,
        cuenta_id: accComision.id,
        cuentaCodigo: accComision.codigo,
        nombreCuenta: `${accComision.codigo} - ${accComision.nombre}`,
        descripcion: `Comisión bancaria ${liquidacionForm.comisionPorcentaje}% POS Lote Nº ${selectedLoteForLiquidacion.lote_numero} ($${comisionMontoUSD.toFixed(2)} / Ref Bs. ${comisionMontoBs.toFixed(2)})`,
        debe: comisionMontoUSD,
        haber: 0
      }
    ];

    if (retIvaUSD > 0) {
      lineasComprobante.push({
        id: `as_${Date.now()}_3`,
        cuentaId: accRetIva.id,
        cuenta_id: accRetIva.id,
        cuentaCodigo: accRetIva.codigo,
        nombreCuenta: `${accRetIva.codigo} - ${accRetIva.nombre}`,
        descripcion: `Retención IVA POS Lote Nº ${selectedLoteForLiquidacion.lote_numero} ($${retIvaUSD.toFixed(2)} / Ref Bs. ${retIvaBs.toFixed(2)})`,
        debe: retIvaUSD,
        haber: 0
      });
    }

    if (retIslrUSD > 0) {
      lineasComprobante.push({
        id: `as_${Date.now()}_4`,
        cuentaId: accRetIslr.id,
        cuenta_id: accRetIslr.id,
        cuentaCodigo: accRetIslr.codigo,
        nombreCuenta: `${accRetIslr.codigo} - ${accRetIslr.nombre}`,
        descripcion: `Retención ISLR POS Lote Nº ${selectedLoteForLiquidacion.lote_numero} ($${retIslrUSD.toFixed(2)} / Ref Bs. ${retIslrBs.toFixed(2)})`,
        debe: retIslrUSD,
        haber: 0
      });
    }

    // 3. SALE DE LA CUENTA TRANSITORIA DEL TERMINAL (HABER) -> REVERSO TOTAL BRUTO
    lineasComprobante.push({
      id: `as_${Date.now()}_5`,
      cuentaId: accTransitoria.id,
      cuenta_id: accTransitoria.id,
      cuentaCodigo: accTransitoria.codigo,
      nombreCuenta: `${accTransitoria.codigo} - ${accTransitoria.nombre}`,
      descripcion: `Reverso y liquidación total Lote POS Nº ${selectedLoteForLiquidacion.lote_numero} (${terminalAsociada?.nombre || selectedLoteForLiquidacion.terminal_nombre}) ($${montoBrutoUSD.toFixed(2)} / Ref Bs. ${montoBrutoBs.toFixed(2)})`,
      debe: 0,
      haber: montoBrutoUSD
    });

    const comprobanteContable = {
      id: voucherId,
      empresa_id: activeCompanyId || 'default',
      numero: `CMP-POS-${Date.now().toString().slice(-6)}`,
      fecha: liquidacionForm.fechaAcreditacion,
      descripcion: `Liquidación Lote POS Nº ${selectedLoteForLiquidacion.lote_numero} (${terminalAsociada?.nombre || selectedLoteForLiquidacion.terminal_nombre}) - Acreditación en ${bank.banco}`,
      concepto: `Liquidación Lote POS Nº ${selectedLoteForLiquidacion.lote_numero} (${terminalAsociada?.nombre || selectedLoteForLiquidacion.terminal_nombre}) - Acreditación en ${bank.banco}`,
      referencia: liquidacionForm.referenciaBanco || `LOTE-${selectedLoteForLiquidacion.lote_numero}`,
      tipo: 'Diario',
      estado: 'Contabilizado',
      total: montoBrutoUSD,
      moneda: 'USD',
      tasaCambio: tasa,
      lineas: lineasComprobante,
      asientos: lineasComprobante,
      created_at: new Date().toISOString()
    };

    // Mostrar modal interactivo del asiento contable antes de persistir (al igual que Facturación y Compras)
    setPendingVoucher({
      comprobante: comprobanteContable,
      title: "Asiento Contable de Liquidación POS",
      subtitle: `Comprobante de Diario • Liquidación Lote POS Nº ${selectedLoteForLiquidacion.lote_numero} (${terminalAsociada?.nombre || selectedLoteForLiquidacion.terminal_nombre}) en ${bank.banco}`,
      onConfirm: async (finalVoucher: any) => {
        await executeCommitLiquidacion(finalVoucher, bank, calculatedLiquidacion, movBancoId, selectedLoteForLiquidacion);
      }
    });
  };

  const executeCommitLiquidacion = async (
    finalVoucher: any,
    bank: BancoModel,
    liqCalc: typeof calculatedLiquidacion,
    movBancoId: string,
    loteToLiquidate: LotePosModel
  ) => {
    try {
      const voucherIdToUse = finalVoucher?.id || `comp_liq_pos_${Date.now()}`;
      finalVoucher.id = voucherIdToUse;
      finalVoucher.empresa_id = activeCompanyId || 'default';
      finalVoucher.estado = 'Contabilizado';

      // 1. Guardar Asiento Contable
      await dbSaveComprobante(finalVoucher, activeCompanyId || 'default');
      onSave?.('comprobantes', finalVoucher);

      // 2. Crear movimiento bancario de ingreso conciliado
      const nuevoMovBanco = {
        id: movBancoId,
        empresa_id: activeCompanyId || '',
        banco_id: bank.id,
        fecha: liquidacionForm.fechaAcreditacion,
        ref: liquidacionForm.referenciaBanco || `LOTE-${loteToLiquidate.lote_numero}`,
        descripcion: `Liquidación Lote POS Nº ${loteToLiquidate.lote_numero} (${loteToLiquidate.terminal_nombre})`,
        tipo: 'ingreso',
        monto: liqCalc.netoUSD,
        montoBs: liqCalc.netoBs,
        tasa: liqCalc.tasa,
        moneda: bank.moneda || (isPrincipalUSD ? 'USD' : 'VES'),
        estado: 'conciliado',
        comprobante_id: voucherIdToUse,
        notas: `Monto Bruto: ${symbolPrincipal} ${liqCalc.montoBrutoUSD.toFixed(2)} (Ref: Bs. ${liqCalc.montoBrutoBs.toFixed(2)}) | Comisión POS: ${symbolPrincipal} ${liqCalc.comisionMontoUSD.toFixed(2)} (Ref: Bs. ${liqCalc.comisionMontoBs.toFixed(2)}) | Tasa: Bs. ${liqCalc.tasa.toFixed(2)}`,
        created_at: new Date().toISOString()
      };

      onSave?.('movimientosBancos', nuevoMovBanco);

      // 3. Actualizar estado del Lote a acreditado_conciliado
      const loteActualizado: LotePosModel = {
        ...loteToLiquidate,
        banco_id: bank.id,
        fecha_acreditacion: liquidacionForm.fechaAcreditacion,
        referencia_banco: liquidacionForm.referenciaBanco,
        tasa_cambio: liqCalc.tasa,
        monto_bruto_usd: liqCalc.montoBrutoUSD,
        comision_porcentaje: liquidacionForm.comisionPorcentaje,
        comision_monto: liqCalc.comisionMontoUSD,
        comision_monto_bs: liqCalc.comisionMontoBs,
        retencion_iva_monto: liqCalc.retIvaUSD,
        retencion_islr_monto: liqCalc.retIslrUSD,
        monto_neto_banco: liqCalc.netoUSD,
        monto_neto_banco_bs: liqCalc.netoBs,
        movimiento_banco_id: movBancoId,
        comprobante_id: voucherIdToUse,
        estado: 'acreditado_conciliado',
        notas: liquidacionForm.notas.trim() || loteToLiquidate.notas
      };

      await dbSaveLotePos(loteActualizado, activeCompanyId);
      onSave?.('lotesPos', loteActualizado);

      showToast?.(`Lote Nº ${loteActualizado.lote_numero} acreditado con éxito en ${bank.banco}. Asiento contable registrado.`, 'success');
      setPendingVoucher(null);
      setIsLiquidacionModalOpen(false);
      setSelectedLoteForLiquidacion(null);
      await loadData();
    } catch (err) {
      console.error('Error al registrar liquidación:', err);
      showToast?.('Error al registrar la liquidación y su asiento contable', 'error');
    }
  };

  const handleViewExistingVoucher = (lote: LotePosModel) => {
    if (!lote.comprobante_id) return;
    const existing = (comprobantes || []).find((c: any) => c.id === lote.comprobante_id || c.numero === lote.comprobante_id);
    if (existing) {
      setPendingVoucher({
        comprobante: existing,
        title: `Asiento Contable • ${existing.numero || 'Comprobante de Liquidación'}`,
        subtitle: `Registrado para Lote POS Nº ${lote.lote_numero} (${lote.terminal_nombre})`,
        onConfirm: async () => {
          setPendingVoucher(null);
        }
      });
      return;
    }

    // Reconstruir si no está en memoria
    const bank = bancos.find(b => b.id === lote.banco_id);
    const term = terminales.find(t => t.id === lote.terminal_id);
    const bruto = Number(lote.monto_bruto_usd || 0);
    const com = Number(lote.comision_monto || 0);
    const neto = Number(lote.monto_neto_banco || 0);
    const retIva = Number(lote.retencion_iva_monto || 0);
    const retIslr = Number(lote.retencion_islr_monto || 0);

    const reconstructedLines: any[] = [
      {
        id: 'l1',
        cuentaId: bank?.cuenta_contable_id || '1.1.02.01',
        nombreCuenta: bank ? `${bank.banco} (Cuenta Bancaria)` : 'Banco',
        descripcion: `Acreditación neta Lote POS Nº ${lote.lote_numero}`,
        debe: neto,
        haber: 0
      },
      {
        id: 'l2',
        cuentaId: term?.cuenta_comision_id || '6.1.01.27',
        nombreCuenta: 'Comisiones Bancarias POS',
        descripcion: `Comisión Lote POS Nº ${lote.lote_numero}`,
        debe: com,
        haber: 0
      }
    ];

    if (retIva > 0) {
      reconstructedLines.push({
        id: 'l3',
        cuentaId: configContable?.cuentaRetencionIvaVentas || '1.1.05.001',
        nombreCuenta: 'Retención IVA POS',
        descripcion: `Retención IVA Lote POS Nº ${lote.lote_numero}`,
        debe: retIva,
        haber: 0
      });
    }

    if (retIslr > 0) {
      reconstructedLines.push({
        id: 'l4',
        cuentaId: configContable?.cuentaRetencionIslrVentas || '1.1.05.002',
        nombreCuenta: 'Retención ISLR POS',
        descripcion: `Retención ISLR Lote POS Nº ${lote.lote_numero}`,
        debe: retIslr,
        haber: 0
      });
    }

    reconstructedLines.push({
      id: 'l5',
      cuentaId: term?.cuenta_transitoria_id || '1.1.02.05',
      nombreCuenta: term?.nombre ? `POS Transitoria (${term.nombre})` : 'POS Transitoria',
      descripcion: `Reverso total Lote POS Nº ${lote.lote_numero}`,
      debe: 0,
      haber: bruto
    });

    setPendingVoucher({
      comprobante: {
        id: lote.comprobante_id,
        numero: lote.comprobante_id.startsWith('CMP') ? lote.comprobante_id : `CMP-${lote.lote_numero}`,
        fecha: lote.fecha_acreditacion || lote.fecha_cierre || new Date().toISOString().split('T')[0],
        descripcion: `Liquidación Lote POS Nº ${lote.lote_numero} (${lote.terminal_nombre}) en ${bank?.banco || 'Banco'}`,
        tipo: 'Diario',
        estado: 'Contabilizado',
        total: bruto,
        lineas: reconstructedLines
      },
      title: `Asiento Contable de Liquidación POS`,
      subtitle: `Lote POS Nº ${lote.lote_numero} • ${lote.terminal_nombre}`,
      onConfirm: async () => {
        setPendingVoucher(null);
      }
    });
  };

  // =========================================================================
  // GESTIÓN DE TERMINALES
  // =========================================================================
  const handleOpenTerminalModal = (term?: TerminalPosModel) => {
    const defaultTransitoria = cuentasContables.find(c => c.codigo === '1.1.02.05' || c.nombre.toUpperCase().includes('POS TRANSITORIA'))?.codigo || '1.1.02.05';
    const defaultComision = cuentasContables.find(c => c.codigo === '6.1.01.27' || c.nombre.toUpperCase().includes('COMISIONES BANCARIAS'))?.codigo || '6.1.01.27';

    if (term) {
      setEditingTerminal(term);
      setTerminalForm({
        codigo: term.codigo,
        nombre: term.nombre,
        bancoId: term.banco_id,
        cuentaTransitoriaId: term.cuenta_transitoria_id || defaultTransitoria,
        cuentaComisionId: term.cuenta_comision_id || defaultComision,
        comisionEstimada: term.comision_estimada || 1.5,
        tipoCuenta: term.tipo_cuenta || (term.moneda === 'USD' ? 'internacional' : 'nacional'),
        activo: term.activo
      });
    } else {
      setEditingTerminal(null);
      const initialBank = bancos.length > 0 ? bancos[0] : null;
      const isUSD = initialBank?.moneda === 'Dolares' || (initialBank?.moneda as string) === 'USD' || initialBank?.tipo_cuenta === 'internacional';
      setTerminalForm({
        codigo: `POS-0${terminales.length + 1}`,
        nombre: '',
        bancoId: initialBank ? initialBank.id : '',
        cuentaTransitoriaId: defaultTransitoria,
        cuentaComisionId: defaultComision,
        comisionEstimada: 1.5,
        tipoCuenta: isUSD ? 'internacional' : 'nacional',
        activo: true
      });
    }
    setIsTerminalModalOpen(true);
  };

  const handleSaveTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalForm.nombre.trim() || !terminalForm.codigo.trim()) {
      showToast?.('Complete el código y nombre del punto de venta', 'error');
      return;
    }

    const findAccountUUID = (val: string) => {
      if (!val) return '';
      const found = cuentasContables.find(c => c.id === val || c.codigo === val || (c.codigo && c.codigo.replace(/\./g, '') === val.replace(/\./g, '')));
      return found ? found.id : val;
    };

    const newTerm: TerminalPosModel = {
      id: editingTerminal ? editingTerminal.id : `pos_term_${Date.now()}`,
      codigo: terminalForm.codigo.trim(),
      nombre: terminalForm.nombre.trim(),
      banco_id: terminalForm.bancoId || (bancos.length > 0 ? bancos[0].id : ''),
      cuenta_transitoria_id: findAccountUUID(terminalForm.cuentaTransitoriaId),
      cuenta_comision_id: findAccountUUID(terminalForm.cuentaComisionId),
      comision_estimada: Number(terminalForm.comisionEstimada) || 1.5,
      tipo_cuenta: terminalForm.tipoCuenta,
      moneda: terminalForm.tipoCuenta === 'internacional' ? 'USD' : 'VES',
      activo: terminalForm.activo,
      created_at: editingTerminal ? editingTerminal.created_at : new Date().toISOString()
    };

    await dbSaveTerminalPos(newTerm, activeCompanyId || 'default');
    onSave?.('terminalesPos', newTerm);
    showToast?.(`Terminal "${newTerm.nombre}" guardada con éxito`, 'success');
    setIsTerminalModalOpen(false);
    loadData();
  };

  return (
    <div className="px-3 sm:px-6 pt-2 pb-16 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Header Compacto y Botones de Acción */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <BackButton to="/banks" label="Volver" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                Lotes de Puntos de Venta (POS)
              </h1>
              <span className="text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                <CreditCard size={12} className="text-amber-600" />
                <span>Conciliación</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Control de lotes diarios, cierre con ticket y liquidación bancaria
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={() => handleOpenTerminalModal()}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-indigo-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus size={14} />
            <span>Configurar Terminal POS</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Tarjetas KPI Estilo Foto 2 (4 Tarjetas Limpias con Moneda Principal y Referencia) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3.5 animate-in fade-in">
        {/* KPI 1: Lotes Abiertos (Hoy) */}
        <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between group hover:border-amber-200 transition-all">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Lotes Abiertos (Hoy)</p>
            </div>
            <p className="text-lg sm:text-xl font-black tracking-tight mt-0.5 truncate text-slate-900 font-mono">
              {symbolPrincipal} {formatNumber(totalMontoAbiertoUSD)}
            </p>
            <span className="text-[10px] text-slate-400 font-medium truncate block">
              Ref: {symbolSecundaria} {formatNumber(totalMontoAbiertoBs)} • {openBatches.reduce((acc, l) => acc + (l.transacciones?.length || 0), 0)} vouchers
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 2: Por Acreditar en Banco */}
        <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between group hover:border-orange-200 transition-all">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Por Acreditar en Banco</p>
            </div>
            <p className="text-lg sm:text-xl font-black tracking-tight mt-0.5 truncate text-orange-700 font-mono">
              {symbolPrincipal} {formatNumber(totalMontoPendienteUSD)}
            </p>
            <span className="text-[10px] text-slate-400 font-medium truncate block">
              Ref: {symbolSecundaria} {formatNumber(totalMontoPendienteBs)} • {pendingBatches.length} lotes pendientes
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 3: Terminales POS Registradas */}
        <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between group hover:border-indigo-200 transition-all">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Terminales Registradas</p>
            </div>
            <p className="text-lg sm:text-xl font-black tracking-tight text-slate-900 mt-0.5 font-mono">
              {terminales.length} {terminales.length === 1 ? 'Terminal' : 'Terminales'}
            </p>
            <span className="text-[10px] text-slate-400 font-medium truncate block">
              Puntos de venta & datafonos operativos
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>

        {/* KPI 4: Historial Conciliado */}
        <div className="bg-white p-3 sm:px-4 sm:py-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between group hover:border-emerald-200 transition-all">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Historial Conciliado</p>
            </div>
            <p className="text-lg sm:text-xl font-black tracking-tight mt-0.5 truncate text-emerald-700 font-mono">
              {symbolPrincipal} {formatNumber(totalConciliadoUSD)}
            </p>
            <span className="text-[10px] text-slate-400 font-medium truncate block">
              Ref: {symbolSecundaria} {formatNumber(totalConciliadoBs)} • {historyBatches.length} lotes liquidados
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda Estilo Foto 2 (Limpio & Moderno) */}
      <div className="bg-white p-2.5 sm:px-4 sm:py-2.5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3 mb-4 animate-in fade-in">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Buscar terminal, lote, voucher o banco..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 outline-none transition"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Pastillas de Filtro / Pestañas */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('abiertos')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'abiertos'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Abiertos ({openBatches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pendientes')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'pendientes'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Por Acreditar ({pendingBatches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('historial')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'historial'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Conciliados ({historyBatches.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terminales')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'terminales'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Terminales POS ({terminales.length})</span>
          </button>
        </div>

        {/* Conmutador de Vista: Lista vs Tarjetas */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setPosViewMode('lista')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              posViewMode === 'lista'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Vista de tabla"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Lista</span>
          </button>
          <button
            type="button"
            onClick={() => setPosViewMode('tarjetas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
              posViewMode === 'tarjetas'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Vista de tarjetas"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Tarjetas</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: LOTES ABIERTOS DEL DÍA */}
      {/* ========================================================================= */}
      {activeTab === 'abiertos' && (
        <div className="space-y-4 animate-in fade-in">
          {openBatches.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
              <CreditCard size={36} className="mx-auto mb-2 opacity-30 text-slate-500" />
              <p className="font-bold text-sm text-slate-700">No hay terminales POS configuradas</p>
              <p className="text-xs text-slate-400 mt-0.5 max-w-md mx-auto">
                Crea una terminal de punto de venta para comenzar a agrupar los cobros por tarjeta en lotes.
              </p>
              <button
                onClick={() => handleOpenTerminalModal()}
                className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs cursor-pointer transition"
              >
                Configurar mi primera terminal POS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {openBatches.map(lote => {
                const term = terminales.find(t => t.id === lote.terminal_id);
                const assignedBank = bancos.find(b => b.id === (term?.banco_id || lote.banco_id));
                const transCount = lote.transacciones?.length || 0;
                const montoBs = lote.monto_bruto_sistema || 0;
                const montoUSD = lote.monto_bruto_usd || (lote.transacciones?.reduce((s, t) => s + (Number(t.monto_usd) || 0), 0)) || (montoBs / (currentTasa || 1));

                return (
                  <div 
                    key={lote.id}
                    onClick={() => handleOpenCierreModal(lote)}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-400 transition cursor-pointer p-4 flex flex-col justify-between group"
                  >
                    {/* Header: Identificación del Punto */}
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-black shrink-0 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition">
                            <CreditCard size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h3 className="font-black text-slate-900 text-sm truncate group-hover:text-indigo-600 transition">
                                {lote.terminal_nombre}
                              </h3>
                              <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                {term?.codigo || 'POS'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                              <Landmark size={11} className="text-slate-400 shrink-0" />
                              <span>Banco: <b className="text-slate-700">{assignedBank ? assignedBank.banco : 'No asignado'}</b></span>
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          <span>Abierto</span>
                        </span>
                      </div>

                      {/* Monto y Métricas Clave */}
                      <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 mb-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Monto Acumulado
                          </span>
                          <div className="text-right">
                            <span className="font-mono text-base sm:text-lg font-black text-slate-900 block">
                              {symbolPrincipal} {formatNumber(montoUSD)} <span className="text-[11px] font-bold text-indigo-600">{monedaPrincipal}</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              Ref: {symbolSecundaria} {formatNumber(montoBs)}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-500 mt-1 pt-1.5 border-t border-slate-200/50">
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Receipt size={12} className="text-amber-600" />
                            <span>{transCount} {transCount === 1 ? 'voucher registrado' : 'vouchers registrados'}</span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Comisión: {term?.comision_estimada || 1.5}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón de Acción Compacto */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenCierreModal(lote);
                      }}
                      className="w-full py-2 px-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Receipt size={14} />
                      <span>Conciliar Lote ({transCount})</span>
                      <ChevronRight size={13} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: LOTES PENDIENTES POR ACREDITAR EN BANCO */}
      {/* ========================================================================= */}
      {activeTab === 'pendientes' && (
        <div className="space-y-4 animate-in fade-in">
          {pendingBatches.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center text-slate-400">
              <CheckCircle2 size={44} className="mx-auto mb-3 text-emerald-400" />
              <p className="font-bold text-base text-slate-700">No hay lotes pendientes por acreditar</p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Todos los cierres de lote han sido conciliados y depositados en sus respectivas cuentas bancarias.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-amber-50/50 border-b border-amber-100 text-xs text-amber-900 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <span>
                  Estos lotes ya fueron cerrados en el punto físico. Cuando verifiques que el banco abonó el dinero en el estado de cuenta, presiona <b>"Acreditar en Banco"</b>.
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Terminal / Punto</th>
                      <th className="px-4 py-3">Nº de Lote</th>
                      <th className="px-4 py-3">Fecha de Cierre</th>
                      <th className="px-4 py-3 text-center">Operaciones</th>
                      <th className="px-4 py-3 text-right">Total Según Ticket</th>
                      <th className="px-4 py-3 text-right">Diferencia</th>
                      <th className="px-4 py-3 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingBatches.map(lote => {
                      const hasDiff = (lote.diferencia || 0) !== 0;
                      return (
                        <tr key={lote.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">{lote.terminal_nombre}</span>
                            <span className="text-[10px] text-slate-400">ID: {lote.terminal_id}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                              Lote #{lote.lote_numero}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(lote.fecha_cierre || lote.fecha_apertura)}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-700">
                            {lote.total_operaciones}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {(() => {
                              const bs = lote.monto_bruto_ticket || lote.monto_bruto_sistema || 0;
                              const usd = lote.monto_bruto_usd || (lote.transacciones?.reduce((s, t) => s + (Number(t.monto_usd) || 0), 0)) || (bs / (lote.tasa_cambio || currentTasa || 1));
                              return (
                                <div>
                                  <span className="font-mono font-black text-slate-900 text-sm block">
                                    {symbolPrincipal} {formatNumber(usd)}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500">
                                    Ref: {symbolSecundaria} {formatNumber(bs)}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">
                            {hasDiff ? (
                              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200">
                                {lote.diferencia > 0 ? '+' : ''}{Number(lote.diferencia || 0).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-[11px]">
                                Cuadrado (0,00)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenLiquidacionModal(lote)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Landmark size={13} />
                              <span>Acreditar en Banco</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: HISTORIAL DE LOTES CONCILIADOS */}
      {/* ========================================================================= */}
      {activeTab === 'historial' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
            <h3 className="font-black text-slate-900 text-sm">
              Historial de Lotes Acreditados y Conciliados en Banco
            </h3>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por lote, terminal..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:border-indigo-500 outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Lote / Terminal</th>
                  <th className="px-4 py-3">Fecha Acreditado</th>
                  <th className="px-4 py-3">Banco Destino</th>
                  <th className="px-4 py-3">Ref. Bancaria</th>
                  <th className="px-4 py-3 text-right">Monto Bruto</th>
                  <th className="px-4 py-3 text-right">Comisión POS</th>
                  <th className="px-4 py-3 text-right">Neto Acreditado</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {historyBatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No hay historial de lotes liquidados todavía.
                    </td>
                  </tr>
                ) : (
                  historyBatches
                    .filter(l => 
                      l.lote_numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      l.terminal_nombre.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .map(lote => {
                      const bank = bancos.find(b => b.id === lote.banco_id);
                      const tasa = lote.tasa_cambio || currentTasa || 1;
                      const brutoBs = lote.monto_bruto_ticket || lote.monto_bruto_sistema || 0;
                      const brutoUSD = lote.monto_bruto_usd || (brutoBs / tasa);

                      const comisionUSD = lote.comision_monto !== undefined && lote.comision_monto_bs !== undefined
                        ? lote.comision_monto
                        : (lote.comision_monto ? (lote.comision_monto > 500 ? lote.comision_monto / tasa : lote.comision_monto) : (brutoUSD * (lote.comision_porcentaje || 1.5) / 100));
                      const comisionBs = lote.comision_monto_bs !== undefined
                        ? lote.comision_monto_bs
                        : (comisionUSD * tasa);

                      const netoUSD = lote.monto_neto_banco !== undefined && lote.monto_neto_banco_bs !== undefined
                        ? lote.monto_neto_banco
                        : (lote.monto_neto_banco ? (lote.monto_neto_banco > 5000 ? lote.monto_neto_banco / tasa : lote.monto_neto_banco) : (brutoUSD - comisionUSD));
                      const netoBs = lote.monto_neto_banco_bs !== undefined
                        ? lote.monto_neto_banco_bs
                        : (netoUSD * tasa);

                      return (
                        <tr key={lote.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">Lote #{lote.lote_numero}</span>
                            <span className="text-[11px] text-slate-500">{lote.terminal_nombre}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatDate(lote.fecha_acreditacion || lote.fecha_cierre || '')}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800">
                            {bank ? bank.banco : 'Banco'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {lote.referencia_banco || '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono font-bold text-slate-800 block text-xs">
                              {symbolPrincipal} {formatNumber(brutoUSD)}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              Ref: {symbolSecundaria} {formatNumber(brutoBs)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono font-semibold text-rose-600 block text-xs">
                              -{symbolPrincipal} {formatNumber(comisionUSD)} ({lote.comision_porcentaje || 1.5}%)
                            </span>
                            <span className="font-mono text-[10px] text-rose-400">
                              Ref: -{symbolSecundaria} {formatNumber(comisionBs)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-mono font-black text-emerald-700 block text-sm">
                              {symbolPrincipal} {formatNumber(netoUSD)}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-emerald-600/80">
                              Ref: {symbolSecundaria} {formatNumber(netoBs)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              Conciliado ✓
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {lote.comprobante_id && (
                                <button
                                  onClick={() => handleViewExistingVoucher(lote)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition cursor-pointer"
                                  title="Ver Asiento Contable NIIF"
                                >
                                  <FileText size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedLoteDetail(lote);
                                  setIsDetailModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                title="Ver detalle de vouchers"
                              >
                                <Eye size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 4: GESTIÓN DE TERMINALES POS */}
      {/* ========================================================================= */}
      {activeTab === 'terminales' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-black text-slate-900 text-sm">Terminales de Punto de Venta (POS)</h3>
              <p className="text-xs text-slate-500 mt-0.5">Equipos físicos instalados en tienda o cajas registradoras</p>
            </div>
            <button
              onClick={() => handleOpenTerminalModal()}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              <span>Nueva Terminal</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Nombre del Punto</th>
                  <th className="px-4 py-3">Banco Afiliado</th>
                  <th className="px-4 py-3">Cuenta Transitoria</th>
                  <th className="px-4 py-3 text-center">% Comisión Est.</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {terminales.map(t => {
                  const b = bancos.find(bank => bank.id === t.banco_id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-600">
                        {t.codigo}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {t.nombre}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {b ? b.banco : 'No asignado'}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-500">
                        {t.cuenta_transitoria_id || '1.1.01.03 (Puntos por Liquidar)'}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-slate-800">
                        {t.comision_estimada}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          t.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {t.activo ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleOpenTerminalModal(t)}
                          className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                          title="Editar terminal"
                        >
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CONCILIACIÓN DE VOUCHERS Y CIERRE DE LOTE CON TICKET POS */}
      {/* ========================================================================= */}
      {isCierreModalOpen && selectedLoteForCierre && (() => {
        const term = terminales.find(t => t.id === selectedLoteForCierre.terminal_id);
        const assignedBank = bancos.find(b => b.id === (term?.banco_id || selectedLoteForCierre.banco_id));
        const allTxs = selectedLoteForCierre.transacciones || [];
        const isAllFilteredSelected = filteredModalTxs.length > 0 && filteredModalTxs.every(t => selectedTxIds.has(t.id));

        return (
          <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95">
              {/* Header del Modal */}
              <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base">Conciliación y Cierre de Lote POS</h3>
                      <span className="font-mono text-[10px] font-bold bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded">
                        {term?.codigo || 'POS'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Terminal: <b>{selectedLoteForCierre.terminal_nombre}</b> • Banco: <b>{assignedBank ? assignedBank.banco : 'No asignado'}</b>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCierreModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Panel Superior: Cotejo en Vivo con el Reporte del Punto */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 border-b border-slate-700/60 shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* Entrada del Monto del Ticket Físico */}
                  <div className="md:col-span-5 space-y-1.5">
                    <label className="block text-xs font-bold text-slate-200">
                      1. Monto Total del Reporte/Ticket del Punto (Bs.) *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        autoFocus
                        value={montoReporteBs}
                        onChange={(e) => setMontoReporteBs(e.target.value)}
                        placeholder="Ej: 1540.50"
                        className="w-full px-3.5 py-2.5 bg-white/10 border-2 border-amber-400/50 focus:border-amber-400 rounded-xl font-mono font-black text-lg text-white placeholder-slate-400 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMontoReporteBs((selectedLoteForCierre.monto_bruto_sistema || 0).toFixed(2))}
                      className="text-[11px] text-amber-300 hover:text-amber-200 underline cursor-pointer transition block"
                    >
                      Copiar total del sistema (Bs. {(selectedLoteForCierre.monto_bruto_sistema || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })})
                    </button>
                  </div>

                  {/* Tarjetas de Métricas de Cuadre en Vivo */}
                  <div className="md:col-span-7 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] text-slate-300 font-semibold block">Reporte POS</span>
                      <p className="text-xs sm:text-sm font-black font-mono text-white mt-0.5 truncate">
                        Bs. {formatNumber(montoReporteNum)}
                      </p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[10px] text-slate-300 font-semibold block">
                        Marcados ({selectedTxIds.size}/{allTxs.length})
                      </span>
                      <p className="text-xs sm:text-sm font-black font-mono text-white mt-0.5 truncate">
                        Bs. {formatNumber(totalSeleccionadoBs)}
                      </p>
                    </div>

                    <div className={`p-3 rounded-xl border text-center ${
                      !montoReporteBs
                        ? 'bg-white/5 border-white/10 text-slate-400'
                        : isCuadrado
                          ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                          : 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                    }`}>
                      <span className="text-[10px] font-semibold block">Diferencia</span>
                      <p className="text-xs sm:text-sm font-black font-mono mt-0.5 truncate">
                        {!montoReporteBs ? '--' : `Bs. ${diferenciaConciliacion > 0 ? '+' : ''}${diferenciaConciliacion.toFixed(2)}`}
                      </p>
                      {isCuadrado && (
                        <span className="text-[9px] font-black bg-emerald-400 text-slate-950 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                          ✓ CUADRADO
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección Central: Lista y Verificación de Vouchers */}
              <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 bg-slate-50/50">
                {/* Barra de herramientas y filtros */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
                  <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <Search size={15} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={modalVoucherSearch}
                      onChange={(e) => setModalVoucherSearch(e.target.value)}
                      placeholder="Filtrar por factura, cliente, voucher..."
                      className="w-full text-xs text-slate-800 bg-transparent outline-none"
                    />
                    {modalVoucherSearch && (
                      <button
                        type="button"
                        onClick={() => setModalVoucherSearch('')}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (isAllFilteredSelected) {
                          handleDeselectAllTxs();
                        } else {
                          handleSelectAllTxs(filteredModalTxs);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={13} className={isAllFilteredSelected ? "text-emerald-600" : "text-slate-400"} />
                      <span>{isAllFilteredSelected ? "Desmarcar Todos" : "Marcar Todos"}</span>
                    </button>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-xl">
                      {selectedTxIds.size} de {allTxs.length} seleccionados
                    </span>
                  </div>
                </div>

                {/* Tabla de Vouchers */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="max-h-56 sm:max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {filteredModalTxs.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <FileText size={32} className="mx-auto mb-2 opacity-40 text-slate-500" />
                        <p className="font-bold text-slate-600 text-xs">No hay vouchers para mostrar</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {allTxs.length === 0 
                            ? "No se han registrado cobros por punto en esta terminal hoy." 
                            : "Ninguna transacción coincide con el filtro de búsqueda."}
                        </p>
                      </div>
                    ) : (
                      filteredModalTxs.map((tx) => {
                        const isSelected = selectedTxIds.has(tx.id);
                        return (
                          <div
                            key={tx.id}
                            onClick={() => handleToggleTx(tx.id)}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                              isSelected
                                ? 'bg-emerald-50/80 border-l-4 border-l-emerald-500 font-medium'
                                : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleTx(tx.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-4 h-4 text-emerald-600 rounded cursor-pointer accent-emerald-600"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{tx.factura_numero}</span>
                                  <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">
                                    Voucher/Ref: {tx.referencia}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    {tx.hora || tx.fecha}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {tx.cliente_nombre || 'Cliente General'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 text-right">
                              <div>
                                <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm block">
                                  Bs. {Number(tx.monto_bs || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {tx.monto_usd ? (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    (${Number(tx.monto_usd).toFixed(2)})
                                  </span>
                                ) : null}
                              </div>

                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {isSelected ? (
                                  <>
                                    <Check size={11} />
                                    <span>Conciliado</span>
                                  </>
                                ) : (
                                  <span>Pendiente</span>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Panel Inferior: Cuadre y Cierre */}
              <form onSubmit={handleConfirmCierre} className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 space-y-4">
                {!isCuadrado ? (
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        {!montoReporteBs ? (
                          <p className="text-xs text-slate-600">
                            <b>Paso 1:</b> Escriba arriba el monto total del ticket de cierre emitido por el punto físico.
                          </p>
                        ) : selectedTxIds.size === 0 ? (
                          <p className="text-xs text-slate-600">
                            <b>Paso 2:</b> Marque en la lista los vouchers físicos que tiene en mano para conciliar con el reporte.
                          </p>
                        ) : (
                          <div>
                            <p className="text-xs font-bold text-amber-800">
                              Diferencia de Cuadre: Bs. {diferenciaConciliacion > 0 ? `+${diferenciaConciliacion.toFixed(2)}` : diferenciaConciliacion.toFixed(2)}
                            </p>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              {diferenciaConciliacion > 0
                                ? 'Faltan vouchers por seleccionar en el sistema para alcanzar el total del reporte del ticket.'
                                : 'El monto de vouchers seleccionados supera el reporte del ticket. Desmarque transacciones sobrantes.'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setIsCierreModalOpen(false)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled
                        className="px-4 py-2.5 bg-slate-200 text-slate-400 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-not-allowed"
                      >
                        <Receipt size={14} />
                        <span>Cerrar Lote (Requiere Cuadre)</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* CUADRADO PERFECTO: Se solicita el número del lote para proceder con el cierre */
                  <div className="bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-2.5 text-emerald-900">
                      <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="font-black text-sm text-emerald-950">
                          ¡Lote Cuadrado con el Reporte del Punto de Venta! 🎉
                        </h4>
                        <p className="text-[11px] text-emerald-800">
                          Se han conciliado exactamente <b>{selectedTxIds.size} vouchers</b> por un monto de <b>Bs. {totalSeleccionadoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</b>.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
                      <div className="sm:col-span-6">
                        <label className="block text-xs font-black text-emerald-950 mb-1">
                          👉 Ingrese el Número de Lote impreso en el Ticket POS *
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          value={loteNumeroInput}
                          onChange={(e) => setLoteNumeroInput(e.target.value)}
                          placeholder="Ej: 000145"
                          className="w-full px-3.5 py-2.5 bg-white border-2 border-emerald-400 focus:border-emerald-600 rounded-xl font-mono font-black text-base text-slate-900 outline-none shadow-xs"
                        />
                      </div>

                      <div className="sm:col-span-6">
                        <label className="block text-xs font-bold text-emerald-950 mb-1">
                          Notas / Observaciones de Cierre (Opcional)
                        </label>
                        <input
                          type="text"
                          value={notasCierre}
                          onChange={(e) => setNotasCierre(e.target.value)}
                          placeholder="Ej: Turno tarde, ticket grapado a planilla"
                          className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs text-slate-800 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-emerald-200/60">
                      <span className="text-[11px] text-emerald-800">
                        Al confirmar, este lote quedará en estado <b>"Cerrado Pendiente"</b> listo para ser liquidado en el banco.
                      </span>

                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsCierreModalOpen(false)}
                          className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={!loteNumeroInput.trim()}
                          className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                          title="Cierra el lote para liquidarlo posteriormente"
                        >
                          <Receipt size={15} />
                          <span>Cerrar Lote Pendiente</span>
                        </button>
                        <button
                          type="button"
                          disabled={!loteNumeroInput.trim()}
                          onClick={(e) => handleConfirmCierre(e, true)}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer shrink-0"
                          title="Cierra el lote y abre inmediatamente la liquidación y asiento contable"
                        >
                          <Landmark size={15} />
                          <span>Cerrar y Liquidar Ahora</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL 2: LIQUIDACIÓN Y CONCILIACIÓN BANCARIA */}
      {/* ========================================================================= */}
      {isLiquidacionModalOpen && selectedLoteForLiquidacion && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-emerald-700 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center font-bold">
                  <Landmark size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Acreditar y Conciliar en Banco</h3>
                  <p className="text-[11px] text-emerald-100">Lote Nº {selectedLoteForLiquidacion.lote_numero} • {selectedLoteForLiquidacion.terminal_nombre}</p>
                </div>
              </div>
              <button
                onClick={() => setIsLiquidacionModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmLiquidacion} className="p-6 space-y-4">
              {/* Selección de Banco */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Cuenta Bancaria donde cayó el Lote *
                </label>
                <select
                  required
                  value={liquidacionForm.bancoId}
                  onChange={(e) => setLiquidacionForm({ ...liquidacionForm, bancoId: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-800 outline-none"
                >
                  <option value="">Seleccione una cuenta bancaria...</option>
                  {bancos.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.banco} ({b.numero_cuenta}) • Saldo: Bs. {Number(b.saldo || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Fecha de Acreditación
                  </label>
                  <input
                    type="date"
                    required
                    value={liquidacionForm.fechaAcreditacion}
                    onChange={(e) => setLiquidacionForm({ ...liquidacionForm, fechaAcreditacion: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ref. Estado de Cuenta
                  </label>
                  <input
                    type="text"
                    required
                    value={liquidacionForm.referenciaBanco}
                    onChange={(e) => setLiquidacionForm({ ...liquidacionForm, referenciaBanco: e.target.value })}
                    placeholder="Ej: LIQ-000145"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Tasa de Cambio Oficial (BCV) con botón para sincronizar en vivo */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Tasa Oficial de Liquidación (Bs. / USD) *
                  </label>
                  <button
                    type="button"
                    onClick={handleSyncBcvRate}
                    disabled={isSyncingTasa}
                    className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
                    title="Consultar tasa oficial en vivo en la web del BCV"
                  >
                    <RefreshCw size={12} className={isSyncingTasa ? 'animate-spin' : ''} />
                    <span>{isSyncingTasa ? 'Sincronizando...' : 'Actualizar Tasa BCV'}</span>
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Bs.</span>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.01"
                      required
                      value={liquidacionForm.tasaCambio}
                      onChange={(e) => setLiquidacionForm({ ...liquidacionForm, tasaCambio: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-indigo-500 rounded-xl text-xs font-mono font-bold text-slate-900 outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium shrink-0">
                    por 1.00 USD
                  </span>
                </div>
              </div>

              {/* Deducción de comisiones y desglose bimonetario */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between items-start text-slate-700">
                  <span className="font-bold">Monto Bruto del Lote:</span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">
                      {symbolPrincipal} {formatNumber(calculatedLiquidacion.montoBrutoUSD)} {monedaPrincipal}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      Ref: {symbolSecundaria} {formatNumber(calculatedLiquidacion.montoBrutoBs)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">Comisión POS (%):</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={liquidacionForm.comisionPorcentaje}
                      onChange={(e) => setLiquidacionForm({ ...liquidacionForm, comisionPorcentaje: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-1.5 py-0.5 text-center font-bold bg-white border border-slate-300 rounded text-xs"
                    />
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-rose-600 font-bold block">
                      -{symbolPrincipal} {formatNumber(calculatedLiquidacion.comisionMontoUSD)}
                    </span>
                    <span className="font-mono text-[10px] text-rose-400">
                      Ref: -{symbolSecundaria} {formatNumber(calculatedLiquidacion.comisionMontoBs)}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-start pt-2 border-t border-slate-900/15 text-emerald-900">
                  <span className="font-black text-xs sm:text-sm">Neto Acreditado en Banco:</span>
                  <div className="text-right">
                    <span className="font-mono text-base font-black text-emerald-700 block">
                      {symbolPrincipal} {formatNumber(calculatedLiquidacion.netoUSD)} {monedaPrincipal}
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-600">
                      Ref: {symbolSecundaria} {formatNumber(calculatedLiquidacion.netoBs)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Explicación contable y bancaria automatizada */}
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-950 leading-relaxed">
                <b>Efecto en Finanzas y Bancos:</b> Se ingresará al banco un monto de <b>{symbolPrincipal} {formatNumber(calculatedLiquidacion.netoUSD)} {monedaPrincipal}</b> (equivalente a <b>{symbolSecundaria} {calculatedLiquidacion.netoBs.toFixed(2)}</b> a tasa BCV {calculatedLiquidacion.tasa.toFixed(2)}), incrementando el saldo disponible del sistema en moneda principal.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsLiquidacionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <FileText size={15} />
                  <span>Continuar a Asiento Contable →</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREAR / EDITAR TERMINAL POS */}
      {/* ========================================================================= */}
      {isTerminalModalOpen && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-amber-400" />
                <h3 className="font-bold text-sm">
                  {editingTerminal ? 'Editar Terminal POS' : 'Nueva Terminal de Punto de Venta'}
                </h3>
              </div>
              <button
                onClick={() => setIsTerminalModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTerminal} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Código *</label>
                  <input
                    type="text"
                    required
                    value={terminalForm.codigo}
                    onChange={(e) => setTerminalForm({ ...terminalForm, codigo: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-xs outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nombre / Ubicación *</label>
                  <input
                    type="text"
                    required
                    value={terminalForm.nombre}
                    onChange={(e) => setTerminalForm({ ...terminalForm, nombre: e.target.value })}
                    placeholder="Ej: Punto Banesco Caja 1"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Banco Receptor Asignado</label>
                <select
                  value={terminalForm.bancoId}
                  onChange={(e) => {
                    const bId = e.target.value;
                    const selB = bancos.find(b => b.id === bId);
                    const isUSD = selB?.moneda === 'Dolares' || (selB?.moneda as string) === 'USD' || selB?.tipo_cuenta === 'internacional';
                    setTerminalForm({
                      ...terminalForm,
                      bancoId: bId,
                      tipoCuenta: isUSD ? 'internacional' : 'nacional'
                    });
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="">Seleccione un banco...</option>
                  {bancos.map(b => (
                    <option key={b.id} value={b.id}>{b.banco} ({b.moneda || 'USD'}) - {b.numero_cuenta}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tipo de Cuenta / Procesamiento *
                </label>
                <select
                  value={terminalForm.tipoCuenta}
                  onChange={(e) => setTerminalForm({ ...terminalForm, tipoCuenta: e.target.value as any })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                >
                  <option value="nacional">Cuenta Nacional (VES / Bolívares - Maneja Tasa Oficial BCV)</option>
                  <option value="internacional">Cuenta Internacional (USD - Sin Tasa de Cambio)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  {terminalForm.tipoCuenta === 'internacional'
                    ? '⚡ Terminal para cuenta internacional USD: no maneja tasas (cobro directo en divisas).'
                    : '🇻🇪 Terminal para cuenta nacional: liquida en bolívares calculados a tasa oficial BCV.'}
                </p>
              </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">% Comisión Estimada</label>
                    <input
                      type="number"
                      step="0.1"
                      value={terminalForm.comisionEstimada}
                      onChange={(e) => setTerminalForm({ ...terminalForm, comisionEstimada: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta Transitoria</label>
                    <CuentaSelectorTrigger
                      value={terminalForm.cuentaTransitoriaId}
                      cuentasContables={cuentasContables}
                      placeholder="Ej: 1.1.01.03..."
                      onClick={() => {
                        setActiveAccountKey('transitoria');
                        setShowCuentaModal(true);
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cuenta de Comisión</label>
                    <CuentaSelectorTrigger
                      value={terminalForm.cuentaComisionId}
                      cuentasContables={cuentasContables}
                      placeholder="Ej: 6.1.02.01..."
                      onClick={() => {
                        setActiveAccountKey('comision');
                        setShowCuentaModal(true);
                      }}
                    />
                  </div>
                </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={terminalForm.activo}
                    onChange={(e) => setTerminalForm({ ...terminalForm, activo: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span>Terminal Activa para Facturación</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsTerminalModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  Guardar Terminal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DETALLE DE VOUCHERS DE UN LOTE */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedLoteDetail && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2.5">
                <Receipt size={18} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Detalle del Lote #{selectedLoteDetail.lote_numero}</h3>
                  <p className="text-[11px] text-slate-300">{selectedLoteDetail.terminal_nombre}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {(() => {
                const tasa = selectedLoteDetail.tasa_cambio || currentTasa || 1;
                const brutoBs = selectedLoteDetail.monto_bruto_ticket || selectedLoteDetail.monto_bruto_sistema || 0;
                const brutoUSD = selectedLoteDetail.monto_bruto_usd || (brutoBs / tasa);

                const netoUSD = selectedLoteDetail.monto_neto_banco !== undefined && selectedLoteDetail.monto_neto_banco_bs !== undefined
                  ? selectedLoteDetail.monto_neto_banco
                  : (selectedLoteDetail.monto_neto_banco ? (selectedLoteDetail.monto_neto_banco > 5000 ? selectedLoteDetail.monto_neto_banco / tasa : selectedLoteDetail.monto_neto_banco) : 0);
                const netoBs = selectedLoteDetail.monto_neto_banco_bs !== undefined
                  ? selectedLoteDetail.monto_neto_banco_bs
                  : (netoUSD * tasa);

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Estado</span>
                      <span className="font-bold text-slate-900">{selectedLoteDetail.estado}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Operaciones</span>
                      <span className="font-bold text-slate-900">{selectedLoteDetail.total_operaciones} vouchers</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Monto Bruto</span>
                      <span className="font-mono font-bold text-slate-900 block">
                        {symbolPrincipal} {formatNumber(brutoUSD)}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        Ref: {symbolSecundaria} {formatNumber(brutoBs)}
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Neto Acreditado</span>
                      <span className="font-mono font-bold text-emerald-700 block">
                        {symbolPrincipal} {formatNumber(netoUSD)}
                      </span>
                      <span className="font-mono text-[10px] text-emerald-600">
                        Ref: {symbolSecundaria} {formatNumber(netoBs)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <h4 className="font-bold text-xs text-slate-700 mb-2">Vouchers / Facturas Asociadas</h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Factura</th>
                        <th className="px-3 py-2">Cliente</th>
                        <th className="px-3 py-2">Ref / Voucher</th>
                        <th className="px-3 py-2 text-right">Monto ({symbolPrincipal})</th>
                        <th className="px-3 py-2 text-right">Monto ({symbolSecundaria})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!selectedLoteDetail.transacciones || selectedLoteDetail.transacciones.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-4 text-center text-slate-400 italic">
                            No se registraron transacciones individuales en este lote.
                          </td>
                        </tr>
                      ) : (
                        selectedLoteDetail.transacciones.map((tx, i) => {
                          const tasa = selectedLoteDetail.tasa_cambio || currentTasa || 1;
                          const usd = tx.monto_usd || (Number(tx.monto_bs || 0) / (tx.tasa || tasa));
                          return (
                            <tr key={i}>
                              <td className="px-3 py-2 font-bold text-indigo-700">{tx.factura_numero}</td>
                              <td className="px-3 py-2 text-slate-700">{tx.cliente_nombre}</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{tx.referencia}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                                {symbolPrincipal} {formatNumber(usd)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-medium text-slate-600">
                                {symbolSecundaria} {formatNumber(tx.monto_bs)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedLoteDetail.notas && (
                <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600">
                  <span className="font-bold block text-slate-700 mb-0.5">Observaciones:</span>
                  {selectedLoteDetail.notas}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SELECCIÓN DE CUENTAS CONTABLES */}
      <CuentaContableModal
        isOpen={showCuentaModal}
        onClose={() => setShowCuentaModal(false)}
        cuentasContables={cuentasContables}
        onSelect={(cuenta) => {
          if (activeAccountKey === 'transitoria') {
            setTerminalForm({ ...terminalForm, cuentaTransitoriaId: cuenta.codigo || cuenta.id });
          } else if (activeAccountKey === 'comision') {
            setTerminalForm({ ...terminalForm, cuentaComisionId: cuenta.codigo || cuenta.id });
          }
        }}
      />

      {/* MODAL DE PREVISUALIZACIÓN Y REGISTRO DE ASIENTO CONTABLE */}
      {pendingVoucher && (
        <VoucherPreviewModal
          isOpen={!!pendingVoucher}
          onClose={() => setPendingVoucher(null)}
          initialComprobante={pendingVoucher.comprobante}
          cuentasContables={cuentasContables}
          onConfirm={pendingVoucher.onConfirm}
          showToast={showToast}
          title={pendingVoucher.title || "Asiento Contable de Liquidación POS"}
          subtitle={pendingVoucher.subtitle || "Comprobante de Diario • Verifique las cuentas contables, glosas y cuadre de partida doble antes de registrar."}
          tasaCambio={calculatedLiquidacion.tasa}
        />
      )}

    </div>
  );
}
