const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/pages/InvoiceForm.tsx');
let code = fs.readFileSync(filePath, 'utf8');

const returnStartRegex = /return \(\s*<div className="px-2 sm:px-4 lg:px-6 pt-1 pb-16 max-w-\[1400px\] mx-auto animate-in fade-in duration-300 text-slate-800">/;
code = code.replace(returnStartRegex, 
  'return (\\n' +
  '    <div className={isModal ? "fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200" : "px-2 sm:px-4 lg:px-6 pt-1 pb-16 max-w-[1400px] mx-auto animate-in fade-in duration-300 text-slate-800"}>\\n' +
  '      <div className={isModal ? "bg-slate-50 w-full max-w-[1600px] h-[96vh] rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-300 p-4 sm:p-6 flex flex-col" : "text-slate-800"}>\\n' +
  '        {isModal && (\\n' +
  '          <button type="button" onClick={onClose} className="absolute top-4 right-4 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer z-[450] shadow-sm">\\n' +
  '            <X size={20} />\\n' +
  '          </button>\\n' +
  '        )}\\n'
);

code = code.replace(/    <\/div>\n  \);\n}\n$/, '      </div>\n    </div>\n  );\n}\n');

const gridStart = code.indexOf('{/* 3. GRILLA DE RENGLONES / ARTÍCULOS (HIGH-DENSITY ERP GRID) */}');
const gridEnd = code.indexOf('{/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}');
if (gridStart === -1 || gridEnd === -1) {
    console.error('Grid not found');
    process.exit(1);
}

let itemsGridCode = code.substring(gridStart, gridEnd);
code = code.substring(0, gridStart) + code.substring(gridEnd);

code = code.replace(
    '<form id="invoice-main-form" onSubmit={handleStartEmission} className="space-y-3">',
    '<form id="invoice-main-form" onSubmit={handleStartEmission} className="flex flex-col lg:flex-row gap-4 flex-1 items-stretch min-h-0 overflow-y-auto lg:overflow-hidden">\\n        <div className="w-full lg:w-[45%] xl:w-[35%] flex flex-col gap-3.5 shrink-0 overflow-y-auto pr-1 pb-20 lg:pb-0">'
);

code = code.replace(
    /<div className="bg-white p-3\\.5 sm:p-4 rounded-2xl border border-slate-200\\/90 shadow-xs">\\s*<div className="grid grid-cols-1 md:grid-cols-12 gap-3\\.5 text-xs">/,
    '<div className="flex flex-col gap-3.5 text-xs">'
);

code = code.replace(/<div className="md:col-span-4 bg-slate-50\\/70 p-3 rounded-xl border border-slate-200\\/80 space-y-2\\.5">/g, '<div className="w-full bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">');
code = code.replace(/<div className="md:col-span-5 bg-slate-50\\/70 p-3 rounded-xl border border-slate-200\\/80 space-y-2">/g, '<div className="w-full bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">');
code = code.replace(/<div className="md:col-span-3 bg-slate-50\\/70 p-3 rounded-xl border border-slate-200\\/80 space-y-2">/g, '<div className="w-full bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">');

const oldBottom = '          </div>\\n        </div>\\n\\n        {/* ========================================================================= */}\\n        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}\\n        {/* ========================================================================= */}\\n        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">\\n          \\n          {/* COLUMNA IZQUIERDA (7 COLS): TRIBUTOS FISCALES SENIAT, RETENCIONES Y NOTAS */}\\n          <div className="lg:col-span-7 space-y-3">';
const newBottom = '          </div>\\n\\n        {/* ========================================================================= */}\\n        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}\\n        {/* ========================================================================= */}\\n        <div className="w-full flex flex-col gap-3.5 items-stretch">\\n          \\n          {/* COLUMNA IZQUIERDA (7 COLS): TRIBUTOS FISCALES SENIAT, RETENCIONES Y NOTAS */}\\n          <div className="w-full space-y-3">';
code = code.replace(oldBottom, newBottom);

const oldTotals = '          </div>\\n\\n          {/* COLUMNA DERECHA (5 COLS): RESUMEN FISCAL DUAL MULTIMONEDA (USD vs VES) */}\\n          <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200/90 shadow-md space-y-3 text-xs">';
const newTotals = '          </div>\\n\\n          {/* COLUMNA DERECHA (5 COLS): RESUMEN FISCAL DUAL MULTIMONEDA (USD vs VES) */}\\n          <div className="w-full bg-white p-4 rounded-2xl border border-slate-200/90 shadow-md space-y-3 text-xs">';
code = code.replace(oldTotals, newTotals);

const oldFormClose = '          </div>\\n\\n        </div>\\n\\n      </form>';
const newFormClose = '          </div>\\n\\n        </div>\\n        </div>\\n\\n        {/* COLUMNA DERECHA: GRILLA DE RENGLONES */}\\n        <div className="w-full lg:w-[55%] xl:w-[65%] flex flex-col min-h-[500px] lg:h-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden relative">\\n          ' + itemsGridCode.replace('overflow-x-auto overflow-y-auto max-h-[42vh] min-h-[190px]', 'overflow-x-auto overflow-y-auto flex-1 min-h-0').replace('<div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">\\n          \\n', '') + '\\n        </div>\\n      </form>';
code = code.replace(oldFormClose, newFormClose);

fs.writeFileSync(filePath, code);
console.log('Success');
