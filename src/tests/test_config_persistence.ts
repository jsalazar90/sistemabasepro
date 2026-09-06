import * as dotenv from 'dotenv';
dotenv.config();

import {
  dbSaveEmpresa,
  dbFetchEmpresas,
  dbSaveConfiguracionContable,
  dbFetchConfiguracionContable
} from '../services/db';

async function testConfig() {
  console.log('Testing Accounting Config, Series, Correlatives and Tax Regime...');
  const testCompanyId = 'comp_test_config_' + Date.now();

  // 1. Create company
  const empRes = await dbSaveEmpresa({
    id: testCompanyId,
    nombre: 'Empresa Test Configuración',
    rif: 'J-' + Date.now().toString().slice(-8) + '-9',
    tipoContribuyente: 'especial',
    monedaPrincipal: 'USD',
    monedaSecundaria: 'VES'
  });
  console.log('Empresa guardada:', empRes);

  // 2. Save Configuración Contable, Series y Correlativos, Impuestos
  const configToSave = {
    cuentaCxc: '1.1.4',
    cuentaCxp: '2.1.1',
    cuentaDebitoFiscal: '2.1.2',
    cuentaCreditoFiscal: '1.1.5',
    cuentaVentas: '4.1.01',
    cuentaGastos: '5.1.02',
    cuentaGananciaDiferencialCambiario: '4.1.1',
    cuentaPerdidaDiferencialCambiario: '5.2.1',
    mesCierre: '12',
    iva: 16,
    igtf: 3,
    retencionIva: 75,
    retencionIslr: 2,
    prefijoFactura: 'FAC-ELECT-',
    correlativoFactura: '00540',
    prefijoCotizacion: 'COT-',
    correlativoCotizacion: '00120',
    prefijoNotaEntrega: 'NE-',
    correlativoNotaEntrega: '00035',
    prefijoRecibo: 'REC-',
    correlativoRecibo: '00900',
    diasVencimientoDefault: 30,
    notasDefault: 'Tasa oficial BCV a la fecha de pago.',
    usaMaquinaFiscal: true,
    marcaMaquinaFiscal: 'bixolon'
  };

  const saveConfigRes = await dbSaveConfiguracionContable(configToSave, testCompanyId);
  console.log('Configuración Contable guardada:', saveConfigRes);

  // 3. Fetch from Supabase
  const fetchedConfig = await dbFetchConfiguracionContable(testCompanyId);
  console.log('Configuración recuperada de Supabase:', fetchedConfig);

  if (
    fetchedConfig &&
    fetchedConfig.correlativoFactura === '00540' &&
    fetchedConfig.retencionIva === 75 &&
    fetchedConfig.cuentaCxc === '1.1.4'
  ) {
    console.log('✅ TEST SUPERADO: Todos los campos contables, fiscales, series y correlativos persisten en Supabase!');
  } else {
    console.log('❌ FALLÓ la verificación de los datos');
  }
}

testConfig();
