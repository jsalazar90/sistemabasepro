const fs = require('fs');
let code = fs.readFileSync('src/pages/InvoiceForm.tsx', 'utf8');

const gridStartStr = '{/* ========================================================================= */}\n        {/* 3. GRILLA DE RENGLONES / ARTÍCULOS (HIGH-DENSITY ERP GRID) */}';
const gridEndStr = '{/* ========================================================================= */}\n        {/* 4. SECCIÓN INFERIOR DUAL: RETENCIONES / NOTAS (IZQ) vs TOTALES ERP (DER) */}';

const gridStart = code.indexOf(gridStartStr);
const gridEnd = code.indexOf(gridEndStr);

let itemsGridCode = code.substring(gridStart, gridEnd);
code = code.substring(0, gridStart) + code.substring(gridEnd);

itemsGridCode = itemsGridCode.replace('max-h-[42vh] min-h-[190px]', 'flex-1 h-full min-h-0');
itemsGridCode = itemsGridCode.replace('<div className=\"bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden\">', '');
itemsGridCode = itemsGridCode.replace(gridStartStr, '');

const endStr = '          </div>\\n\\n        </div>\\n\\n      </form>';
const replaceEndStr = '          </div>\\n\\n        </div>\\n        </div>\\n\\n        {/* COLUMNA DERECHA: GRILLA DE RENGLONES */}\\n        <div className=\"w-full lg:w-[55%] xl:w-[65%] flex flex-col min-h-[500px] lg:h-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden relative\">\\n          ' + itemsGridCode + '\\n        </div>\\n      </form>';

code = code.replace(endStr, replaceEndStr);
fs.writeFileSync('src/pages/InvoiceForm.tsx', code);

