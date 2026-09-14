        {/* Cerramos la columna izquierda */}
        </div>

        {/* COLUMNA DERECHA: GRILLA DE RENGLONES */}
        <div className="w-full lg:w-[55%] xl:w-[65%] flex flex-col min-h-[500px] lg:h-full bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden relative">
          {/* Sub-barra de Grilla */}
          <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Package size={15} className="text-indigo-600" />
                Renglones de la Factura
              </span>
              <span className="text-[10px] bg-slate-200/80 text-slate-700 font-bold px-2 py-0.5 rounded-full font-mono">
                {items.length} {items.length === 1 ? 'renglón' : 'renglones'}
              </span>

              {/* Alerta de Stock 0 */}
              {zeroStockItems.length > 0 && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isZeroStockAuthorized
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse'
                }`}>
                  <ShieldAlert size={11} />
                  <span>{zeroStockItems.length} en Stock 0: {isZeroStockAuthorized ? 'AUTORIZADO' : 'REQUIERE CLAVE MASTER'}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleOpenProductModal(null)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                title="Abrir catálogo de inventario (F3)"
              >
                <Search size={13} />
                <span>Catálogo de Inventario (F3)</span>
              </button>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                title="Añadir renglón vacío"
              >
                <Plus size={13} />
                <span>Fila Vacía</span>
              </button>
            </div>
          </div>

          {/* Tabla de Artículos: Renglones de la Factura en Media Pantalla con Scroll Interno */}
          <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0 border-b border-slate-200/80">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 select-none sticky top-0 z-10 shadow-xs">
                <tr>
                  <th className="px-3 py-2 w-10 text-center">#</th>
                  <th className="px-3 py-2 w-28">Código / SKU</th>
                  <th className="px-3 py-2">Descripción / Concepto</th>
                  <th className="px-2 py-2 w-28 text-center">Stock</th>
                  <th className="px-2 py-2 w-20 text-center">Cant.</th>
                  <th className="px-2 py-2 w-28 text-right">P. Unitario ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-2 py-2 w-20 text-center">IVA</th>
                  <th className="px-3 py-2 w-28 text-right">Total ({currency === 'USD' ? '$' : 'Bs.'})</th>
                  <th className="px-2 py-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {items.map((item, idx) => {
                  const selectedProd = products.find(p => p.id === item.producto_id);
                  const isStockWarning = selectedProd && (Number(item.cantidad) > Number(selectedProd.stock_actual));
                  const isZeroStock = selectedProd && selectedProd.stock_actual <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-indigo-50/20 transition-colors">
                      {/* # Índice */}
                      <td className="px-3 py-2 text-center text-slate-400 font-mono font-bold text-[11px] align-middle">
                        {idx + 1}
                      </td>

                      {/* Código SKU */}
                      <td className="px-3 py-2 align-middle font-mono font-bold text-[11px] text-indigo-700">
                        {item.codigo || selectedProd?.codigo || (
                          <span className="text-slate-300 italic font-normal">S/C</span>
                        )}
                      </td>

                      {/* Descripción */}
                      <td className="px-3 py-2 align-middle">
                        {!item.producto_id ? (
                          <button
                            type="button"
                            onClick={() => handleOpenProductModal(idx)}
                            className="w-full px-2.5 py-1.5 bg-indigo-50/50 hover:bg-indigo-50 border border-dashed border-indigo-200 hover:border-indigo-400 rounded-lg text-left transition flex items-center justify-between gap-1.5 text-xs text-indigo-700 font-semibold cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Search size={12} className="text-indigo-500" />
                              <span>Buscar o seleccionar artículo...</span>
                            </span>
                            <span className="text-[10px] bg-indigo-600 text-white font-bold px-1.5 py-0.2 rounded">
                              F3 Catálogo
                            </span>
                          </button>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900 text-xs truncate">
                              {item.descripcion || selectedProd?.nombre}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenProductModal(idx)}
                              title="Cambiar artículo"
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-100 transition shrink-0 cursor-pointer"
                            >
                              <RefreshCw size={11} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="px-2 py-2 text-center align-middle">
                        {selectedProd ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                            isZeroStock
                              ? isZeroStockAuthorized
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isStockWarning
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            <span>{selectedProd.stock_actual} disp.</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Cantidad */}
                      <td className="px-2 py-2 text-center align-middle">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.cantidad === 0 ? '' : item.cantidad}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            handleItemFieldChange(idx, 'cantidad', isNaN(val) ? 0 : val);
                          }}
                          onBlur={() => {
                            if (!item.cantidad || item.cantidad <= 0) {
                              handleItemFieldChange(idx, 'cantidad', 1);
                            }
                          }}
                          className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-center text-slate-900 focus:border-indigo-600 outline-none font-mono"
                        />
                      </td>

                      {/* Precio Unitario */}
                      <td className="px-2 py-2 text-right align-middle">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.precio_unitario === 0 ? '' : item.precio_unitario}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                            handleItemFieldChange(idx, 'precio_unitario', isNaN(val) ? 0 : val);
                          }}
                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-black text-right text-slate-900 focus:border-indigo-600 outline-none font-mono"
                        />
                      </td>

                      {/* IVA (Toggle 16% / Exento E) */}
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleItemFieldChange(idx, 'exento', !item.exento)}
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition cursor-pointer ${
                            item.exento
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                          title={item.exento ? 'Haga clic para aplicar IVA 16%' : 'Haga clic para marcar como Exento (E)'}
                        >
                          {item.exento ? 'EXENTO (E)' : '16%'}
                        </button>
                      </td>

                      {/* Total Renglón */}
                      <td className="px-3 py-2 text-right align-middle font-mono font-black text-slate-900 whitespace-nowrap">
                        {formatMoney(item.total, currency)}
                      </td>

                      {/* Acciones */}
                      <td className="px-2 py-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition rounded-md cursor-pointer"
                          title="Eliminar renglón"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pie de Grilla */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500 font-medium">
            <div>
              <span>Total Items: <b className="text-slate-800">{items.length}</b></span>
              <span className="mx-2">•</span>
              <span>Total Unidades: <b className="text-slate-800">{items.reduce((s, i) => s + (Number(i.cantidad) || 0), 0)}</b></span>
            </div>
            <button
              type="button"
              onClick={handleAddItem}
              className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} />
              <span>Añadir otro renglón</span>
            </button>
          </div>
        </div>
      </form>
