import * as dotenv from 'dotenv';
dotenv.config();

import {
  dbSaveEmpresa,
  dbFetchEmpresas,
  dbSaveUsuario,
  dbFetchUsuarios,
  dbSaveUsuarioEmpresa,
  dbFetchUsuarioEmpresas,
  dbSaveCuentaContable,
  dbFetchCuentasContables,
  dbSaveBanco,
  dbFetchBancos,
  dbSaveMovimientoBanco,
  dbFetchMovimientosBancos,
  dbSaveContacto,
  dbFetchContactos,
  dbSaveCxc,
  dbFetchCxc,
  dbSaveCxp,
  dbFetchCxp,
  dbSaveCobranza,
  dbFetchCobranzas,
  dbSavePagoRealizado,
  dbFetchPagosRealizados,
  dbSaveComprobante,
  dbFetchComprobantes,
  dbSaveServicio,
  dbFetchServicios
} from '../services/db';

async function runE2ETest() {
  console.log('================================================================');
  console.log('  TEST END-TO-END: PERSISTENCIA SISTEMA BASE EN SUPABASE');
  console.log('================================================================\n');

  const testCompanyId = `comp_test_${Date.now()}`;
  const results: { module: string; test: string; status: 'SUCCESS' | 'FAILED'; details: string }[] = [];

  const logResult = (module: string, test: string, success: boolean, details: string) => {
    results.push({
      module,
      test,
      status: success ? 'SUCCESS' : 'FAILED',
      details
    });
    const icon = success ? '✅' : '❌';
    console.log(`${icon} [${module.toUpperCase()}] ${test}: ${details}`);
  };

  try {
    // ------------------------------------------------------------------------
    // 1. MÓDULO: EMPRESAS & ORGANIZACIÓN
    // ------------------------------------------------------------------------
    const newEmpresa = {
      id: testCompanyId,
      nombre: 'Empresa Base Demo C.A.',
      rif: `J-${Date.now().toString().slice(-8)}-1`,
      direccion: 'Zona Industrial, Caracas',
      telefono: '+58 212 8889900',
      email: 'operaciones@empresabase.com',
      monedaPrincipal: 'USD',
      monedaSecundaria: 'VES',
      tipoContribuyente: 'especial',
      tipoEmpresa: 'comercial',
      habilitarPOS: true,
      habilitarVendedores: true,
      habilitarPedidos: true
    };
    const empSaveRes = await dbSaveEmpresa(newEmpresa);
    const empresasList = await dbFetchEmpresas();
    const empFound = empresasList.find(e => e.id === testCompanyId);
    logResult(
      'Empresas',
      'Crear y consultar Empresa en BD',
      empSaveRes.success && !!empFound,
      empFound ? `Guardada "${empFound.name}" (RIF: ${empFound.taxId})` : (empSaveRes.error || 'No encontrada')
    );

    // ------------------------------------------------------------------------
    // 2. MÓDULO: USUARIOS Y PERMISOS (RBAC)
    // ------------------------------------------------------------------------
    const testUserId = `usr_${Date.now()}`;
    const testUser = {
      id: testUserId,
      email: `admin_${Date.now()}@empresabase.com`,
      name: 'Administrador Base',
      password: 'SecurePassword2026!',
      role: 'SuperAdmin',
      activo: true
    };
    const userSaveRes = await dbSaveUsuario(testUser);
    const userPermRes = await dbSaveUsuarioEmpresa({
      id: `ue_${testUserId}_${testCompanyId}`,
      usuario_id: testUserId,
      empresa_id: testCompanyId,
      role: 'SuperAdmin',
      activo: true
    });
    const usersList = await dbFetchUsuarios();
    const userFound = usersList.find(u => u.id === testUserId);
    logResult(
      'Usuarios & RBAC',
      'Crear Usuario y Asignar Membresía a Empresa',
      userSaveRes && userPermRes && !!userFound,
      userFound ? `Usuario ${userFound.email} [Rol: ${userFound.role}]` : 'Error en usuario'
    );

    // ------------------------------------------------------------------------
    // 3. MÓDULO: PLAN DE CUENTAS NIIF
    // ------------------------------------------------------------------------
    const testCuenta = {
      id: `cta_${Date.now()}`,
      codigo: '1.1.03.01.99',
      nombre: 'Cuenta Transitoria de Prueba',
      tipo: 'activo',
      nivel: 4,
      naturaleza: 'Deudora',
      grupo: 'Activo Corriente',
      activo: true
    };
    const cuentaSaveRes = await dbSaveCuentaContable(testCuenta, testCompanyId);
    const cuentasList = await dbFetchCuentasContables(testCompanyId);
    const cuentaFound = cuentasList.find(c => c.codigo === testCuenta.codigo);
    logResult(
      'Contabilidad - Plan de Cuentas',
      'Crear Cuenta Contable NIIF',
      cuentaSaveRes && !!cuentaFound,
      cuentaFound ? `Cuenta ${cuentaFound.codigo} - ${cuentaFound.nombre}` : 'Error en cuenta'
    );

    // ------------------------------------------------------------------------
    // 4. MÓDULO: BANCOS & CUENTAS BANCARIAS
    // ------------------------------------------------------------------------
    const testBanco = {
      id: `bnk_${Date.now()}`,
      banco: 'Banco Banesco Universal',
      numeroCuenta: '0134-0992-81-0001928374',
      tipo: 'Corriente',
      moneda: 'USD',
      saldo: 15000.0,
      cuentaContableId: testCuenta.id,
      activo: true
    };
    const bancoSaveRes = await dbSaveBanco(testBanco, testCompanyId);
    const bancosList = await dbFetchBancos(testCompanyId);
    const bancoFound = bancosList.find(b => b.id === testBanco.id);
    logResult(
      'Bancos & Tesorería',
      'Crear Cuenta Bancaria Vinculada',
      bancoSaveRes && !!bancoFound,
      bancoFound ? `${bancoFound.banco} (${bancoFound.moneda}) - Saldo: $${bancoFound.saldo}` : 'Error en banco'
    );

    // ------------------------------------------------------------------------
    // 5. MÓDULO: MOVIMIENTOS BANCARIOS
    // ------------------------------------------------------------------------
    const testMovBanco = {
      id: `mov_${Date.now()}`,
      bancoId: testBanco.id,
      fecha: '2026-08-15',
      tipo: 'ingreso',
      monto: 2500.0,
      descripcion: 'Cobro de Factura FAC-001',
      referencia: 'REF-TRF-99120',
      conciliado: true
    };
    const movSaveRes = await dbSaveMovimientoBanco(testMovBanco, testCompanyId);
    const movList = await dbFetchMovimientosBancos(testCompanyId);
    const movFound = movList.find(m => m.id === testMovBanco.id);
    logResult(
      'Bancos - Movimientos',
      'Registrar Movimiento de Banco',
      movSaveRes && !!movFound,
      movFound ? `Movimiento ${movFound.referencia} ($${movFound.monto})` : 'Error en movimiento'
    );

    // ------------------------------------------------------------------------
    // 6. MÓDULO: CONTACTOS (CLIENTES & PROVEEDORES)
    // ------------------------------------------------------------------------
    const testContacto = {
      id: `cont_${Date.now()}`,
      name: 'Distribuidora Global Alpha C.A.',
      taxId: `J-${Date.now().toString().slice(-8)}-9`,
      type: 'both',
      email: 'contacto@distribuidoraglobal.com',
      phone: '+58 212 9991122',
      address: 'Caracas, Distrito Capital',
      activo: true
    };
    const contSaveRes = await dbSaveContacto(testContacto, testCompanyId);
    const contList = await dbFetchContactos(testCompanyId);
    const contFound = contList.find(c => c.taxId === testContacto.taxId);
    logResult(
      'Contactos',
      'Registrar Cliente / Proveedor Comercial',
      contSaveRes && !!contFound,
      contFound ? `Contacto "${contFound.name}" (${contFound.taxId})` : 'Error en contacto'
    );

    // ------------------------------------------------------------------------
    // 7. MÓDULO: SERVICIOS Y ARTÍCULOS
    // ------------------------------------------------------------------------
    const testServicio = {
      id: `srv_${Date.now()}`,
      codigo: 'SERV-BASE-01',
      nombre: 'Servicio de Consultoría Administrativa',
      descripcion: 'Asesoría y gestión operativa',
      precioBase: 250.0,
      cuentaContableId: testCuenta.id
    };
    const srvSaveRes = await dbSaveServicio(testServicio, testCompanyId);
    const srvList = await dbFetchServicios(testCompanyId);
    const srvFound = srvList.find(s => s.codigo === testServicio.codigo);
    logResult(
      'Servicios & Catálogo',
      'Registrar Producto/Servicio en BD',
      srvSaveRes && !!srvFound,
      srvFound ? `Servicio ${srvFound.nombre} ($${srvFound.precioBase})` : 'Error en servicio'
    );

    // ------------------------------------------------------------------------
    // 8. MÓDULO: CUENTAS POR COBRAR (CXC)
    // ------------------------------------------------------------------------
    const testCxc = {
      id: `cxc_${Date.now()}`,
      numeroDocumento: `FAC-${Date.now().toString().slice(-5)}`,
      clienteId: testContacto.id,
      clienteNombre: testContacto.name,
      clienteRif: testContacto.taxId,
      fechaEmision: '2026-08-15',
      fechaVencimiento: '2026-08-30',
      totalUsd: 1160.0,
      saldoPendienteUsd: 1160.0,
      estado: 'Pendiente'
    };
    const cxcSaveRes = await dbSaveCxc(testCxc, testCompanyId);
    const cxcList = await dbFetchCxc(testCompanyId);
    const cxcFound = cxcList.find(c => c.id === testCxc.id);
    logResult(
      'Cuentas por Cobrar',
      'Registrar Documento por Cobrar en BD',
      cxcSaveRes && !!cxcFound,
      cxcFound ? `Factura ${cxcFound.numeroDocumento} - Saldo: $${cxcFound.saldoPendienteUsd}` : 'Error en CxC'
    );

    // ------------------------------------------------------------------------
    // 9. MÓDULO: COMPROBANTES DE DIARIO
    // ------------------------------------------------------------------------
    const testComp = {
      id: `comp_${Date.now()}`,
      numero: `DIAR-${Date.now().toString().slice(-6)}`,
      fecha: '2026-08-15',
      tipo: 'Diario',
      descripcion: 'Asiento contable de operaciones base',
      referencia: 'REF-DIAR-001',
      total: 500.0,
      estado: 'Contabilizado',
      lineas: [
        { cuentaId: testCuenta.id, descripcion: 'Débito prueba', debe: 500.0, haber: 0 },
        { cuentaId: testCuenta.id, descripcion: 'Crédito prueba', debe: 0, haber: 500.0 }
      ]
    };
    const compSaveRes = await dbSaveComprobante(testComp, testCompanyId);
    const compList = await dbFetchComprobantes(testCompanyId);
    const compFound = compList.find(c => c.id === testComp.id);
    logResult(
      'Contabilidad - Comprobantes',
      'Registrar Asiento Contable Balanceado',
      compSaveRes && !!compFound,
      compFound ? `Comprobante ${compFound.numero} ($${compFound.total})` : 'Error en comprobante'
    );

    console.log('\n================================================================');
    const allPassed = results.every(r => r.status === 'SUCCESS');
    if (allPassed) {
      console.log('🎉 TODOS LOS MÓDULOS DEL SISTEMA BASE PERSISTEN SATISFACTORIAMENTE');
    } else {
      console.log('⚠️ ALGUNOS MÓDULOS PRESENTARON FALLAS EN LA PERSISTENCIA');
    }
    console.log('================================================================\n');

  } catch (error: any) {
    console.error('Error en test E2E:', error);
  }
}

runE2ETest();
