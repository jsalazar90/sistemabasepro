const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/pages/InvoiceForm.tsx');
let code = fs.readFileSync(filePath, 'utf8');

// The outer return wrapping
const returnStartRegex = /return \(\s*<div className="px-2 sm:px-4 lg:px-6 pt-1 pb-16 max-w-\\[1400px\\] mx-auto animate-in fade-in duration-300 text-slate-800">/;
code = code.replace(returnStartRegex, 
eturn (
    <div className={isModal ? "fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200" : "px-2 sm:px-4 lg:px-6 pt-1 pb-16 max-w-[1400px] mx-auto animate-in fade-in duration-300 text-slate-800"}>
      <div className={isModal ? "bg-slate-50 w-full max-w-[1600px] h-[96vh] rounded-3xl shadow-2xl overflow-y-auto relative animate-in zoom-in-95 duration-300 p-4 sm:p-6 flex flex-col" : "text-slate-800"}>
        {isModal && (
          <button type="button" onClick={onClose} className="absolute top-4 right-4 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition cursor-pointer z-[450] shadow-sm">
            <X size={20} />
          </button>
        )}
);

code = code.replace(/    <\/div>\n  \);\n}\n$/,       </div>\n    </div>\n  );\n}\n);

// I need to extract the Items Grid
const itemsGridStart = code.indexOf('{/* 3. GRILLA DE RENGLONES / ARTÍCULOS (HIGH-DENSITY ERP GRID) */}');
const itemsGridEnd = code.indexOf('{/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}');
if (itemsGridStart === -1 || itemsGridEnd === -1) { console.error('Could not find items grid'); process.exit(1); }

let itemsGridCode = code.substring(itemsGridStart, itemsGridEnd);
// Remove items grid from original position
code = code.substring(0, itemsGridStart) + code.substring(itemsGridEnd);

// Now change the form structure
const formStartRegex = /<form id="invoice-main-form" onSubmit={handleStartEmission} className="space-y-3">/;
code = code.replace(formStartRegex, <form id="invoice-main-form" onSubmit={handleStartEmission} className="flex flex-col lg:flex-row gap-4 flex-1 items-stretch min-h-0">
        <div className="w-full lg:w-[45%] xl:w-[35%] flex flex-col gap-3.5 shrink-0 pr-1">);

code = code.replace(/<div className="bg-white p-3\\.5 sm:p-4 rounded-2xl border border-slate-200\\/90 shadow-xs">\\s*<div className="grid grid-cols-1 md:grid-cols-12 gap-3\\.5 text-xs">/, 
  \<div className="flex flex-col gap-3.5 text-xs">\);

code = code.replace(/<div className="md:col-span-4 bg-slate-50\\/70 p-3 rounded-xl border border-slate-200\\/80 space-y-2\\.5">/g, 
  \<div className="w-full bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2.5">\);

code = code.replace(/<div className="md:col-span-5 bg-slate-50\\/70 p-3 rounded-xl border border-slate-200\\/80 space-y-2">/g, 
  \<div className="w-full bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">\);

code = code.replace(/<div className="md:col-span-3 bg-slate-50\\/70 p-3 rounded-xl border border-slate-200\\/80 space-y-2">/g, 
  \<div className="w-full bg-slate-50/70 p-3 rounded-xl border border-slate-200/80 space-y-2">\);

code = code.replace(/          <\\/div>\\s*<\\/div>\\s*{\\/\\* ========================================================================= \\*\\/\\s*{\\/\\* 4\\. SECCIÓN INFERIOR DUAL: RETENCIONES \\/ NOTAS \\(IZQ\\) vs TOTALES ERP \\(DER\\) \\*\\/\\s*{\\/\\* ========================================================================= \\*\\/\\s*<div className="grid grid-cols-1 lg:grid-cols-12 gap-3\\.5 items-start">\\s*{\\/\\* COLUMNA IZQUIERDA \\(7 COLS\\): TRIBUTOS FISCALES SENIAT, RETENCIONES Y NOTAS \\*\\/\\s*<div className="lg:col-span-7 space-y-3">/,
\          </div>

        {/* ========================================================================= */}
        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}
        {/* ========================================================================= */}
        <div className="w-full flex flex-col gap-3.5 items-stretch">
          
          {/* COLUMNA IZQUIERDA (7 COLS): TRIBUTOS FISCALES SENIAT, RETENCIONES Y NOTAS */}
          <div className="w-full space-y-3">\);

code = code.replace(/          <\\/div>\\s*{\\/\\* COLUMNA DERECHA \\(5 COLS\\): RESUMEN FISCAL DUAL MULTIMONEDA \\(USD vs VES\\) \\*\\/\\s*<div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200\\/90 shadow-md space-y-3 text-xs">/,
\          </div>

          {/* COLUMNA DERECHA (5 COLS): RESUMEN FISCAL DUAL MULTIMONEDA (USD vs VES) */}
          <div className="w-full bg-white p-4 rounded-2xl border border-slate-200/90 shadow-md space-y-3 text-xs">\);

code = code.replace(/          <\\/div>\\s*<\\/div>\\s*<\\/form>/,
\          </div>

        </div>
        </div>

        {/* COLUMNA DERECHA: GRILLA DE RENGLONES */}
        <div className="w-full lg:w-[55%] xl:w-[65%] flex flex-col min-h-[500px] bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden h-[85vh]">
          \
        </div>
      </form>\);

// make it actually fill the vertical space
code = code.replace('<div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">', '');
code = code.replace('        {/* ========================================================================= */\\n        {/* 3. GRILLA DE RENGLONES / ARTÍCULOS (HIGH-DENSITY ERP GRID) */}', '');

fs.writeFileSync(filePath, code);
console.log('Successfully refactored InvoiceForm layout!');
