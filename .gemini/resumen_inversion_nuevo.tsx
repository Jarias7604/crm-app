{/* Resumen de Inversión - Profesional y Compacto */ }
{
    totales && (
        <div className="mt-6">
            <h3 className="font-bold text-xl text-gray-900 mb-4">Resumen de Inversión</h3>

            <div className="space-y-3">
                {/* PAGO INICIAL (ANTICIPO) - SI EXISTE */}
                {totales.total_pagos_unicos > 0 && (
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-l-4 border-orange-500 rounded-xl p-4 shadow-sm">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-lg">💰</span>
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">Pago Inicial</h4>
                                    <p className="text-[10px] text-gray-600">Requerido antes de activar</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-gray-700">
                                <span>Implementación + servicios únicos</span>
                                <span className="font-semibold">${totales.subtotal_pagos_unicos.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-gray-700">
                                <span>IVA ({formData.iva_porcentaje}%)</span>
                                <span className="font-semibold text-orange-700">+${totales.iva_pagos_unicos.toFixed(2)}</span>
                            </div>
                            <div className="border-t border-orange-200 pt-2 mt-2">
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-gray-900">Total a pagar hoy</span>
                                    <span className="text-2xl font-black text-orange-600">${totales.total_pagos_unicos.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* PAGO RECURRENTE (MENSUAL/ANUAL) */}
                <div className={`bg-gradient-to-br rounded-xl p-4 shadow-sm border-l-4 ${formData.forma_pago === 'anual'
                        ? 'from-green-50 to-green-100/50 border-green-500'
                        : 'from-blue-50 to-blue-100/50 border-blue-500'
                    }`}>
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.forma_pago === 'anual' ? 'bg-green-500' : 'bg-blue-500'
                                }`}>
                                <span className="text-white text-lg">
                                    {formData.forma_pago === 'anual' ? '💰' : '📅'}
                                </span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 text-sm">
                                    {formData.forma_pago === 'anual' ? 'Pago Anual' : `Pago en ${formData.meses_pago} ${formData.meses_pago === 1 ? 'Mes' : 'Meses'}`}
                                </h4>
                                <p className="text-[10px] text-gray-600">
                                    {formData.forma_pago === 'anual'
                                        ? 'Pago completo anual'
                                        : `${formData.meses_pago} cuota${formData.meses_pago === 1 ? '' : 's'} ${formData.meses_pago === 3 ? 'trimestrales' :
                                            formData.meses_pago === 6 ? 'semestrales' :
                                                formData.meses_pago === 9 ? 'cada 4 meses' :
                                                    'mensuales'
                                        }`
                                    }
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between text-gray-700">
                            <span>Licencia + Módulos + Servicios</span>
                            <span className="font-semibold">${totales.subtotal_recurrente_base.toFixed(2)}</span>
                        </div>

                        {formData.forma_pago === 'mensual' && totales.recargo_mensual_monto > 0 && (
                            <div className="flex justify-between text-blue-700">
                                <span className="text-[11px]">
                                    + Recargo financiamiento ({
                                        formData.meses_pago === 1 ? formData.recargo_mensual_porcentaje :
                                            formData.meses_pago === 3 ? Math.round(formData.recargo_mensual_porcentaje * 0.75) :
                                                formData.meses_pago === 6 ? Math.round(formData.recargo_mensual_porcentaje * 0.5) :
                                                    Math.round(formData.recargo_mensual_porcentaje * 0.25)
                                    }%)
                                </span>
                                <span className="font-semibold">+${totales.recargo_mensual_monto.toFixed(2)}</span>
                            </div>
                        )}

                        {formData.forma_pago === 'anual' && totales.ahorro_pago_anual > 0 && (
                            <div className="flex justify-between text-green-700">
                                <span className="text-[11px]">✓ Ahorro pago anual ({formData.recargo_mensual_porcentaje}%)</span>
                                <span className="font-semibold">-${totales.ahorro_pago_anual.toFixed(2)}</span>
                            </div>
                        )}

                        {totales.descuento_monto > 0 && (
                            <div className="flex justify-between text-green-700">
                                <span className="text-[11px]">- Descuento especial ({formData.descuento_porcentaje}%)</span>
                                <span className="font-semibold">-${totales.descuento_monto.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-gray-700">
                            <span>IVA ({formData.iva_porcentaje}%)</span>
                            <span className={`font-semibold ${formData.forma_pago === 'anual' ? 'text-green-700' : 'text-blue-700'}`}>
                                +${totales.iva_monto_recurrente.toFixed(2)}
                            </span>
                        </div>

                        <div className={`border-t pt-2 mt-2 ${formData.forma_pago === 'anual' ? 'border-green-200' : 'border-blue-200'}`}>
                            {formData.forma_pago === 'mensual' ? (
                                <>
                                    <div className="flex justify-between items-baseline mb-1.5">
                                        <span className="font-bold text-gray-900 text-xs">
                                            Cuota {formData.meses_pago === 3 ? 'trimestral' : formData.meses_pago === 6 ? 'semestral' : formData.meses_pago === 9 ? 'cada 4 meses' : 'mensual'}
                                        </span>
                                        <span className="text-2xl font-black text-blue-600">
                                            ${totales.cuota_mensual.toFixed(2)}
                                            <span className="text-xs text-gray-500 font-normal">
                                                /{formData.meses_pago === 3 ? 'trim' : formData.meses_pago === 6 ? 'sem' : formData.meses_pago === 9 ? '4m' : 'mes'}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="bg-blue-50/50 rounded-lg px-2 py-1.5 flex justify-between items-center">
                                        <span className="text-[10px] text-gray-600">Total en {formData.meses_pago} {formData.meses_pago === 1 ? 'mes' : 'meses'}</span>
                                        <span className="font-bold text-gray-900 text-sm">${totales.total_recurrente.toFixed(2)}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between items-baseline">
                                    <span className="font-bold text-gray-900 text-xs">Total anual</span>
                                    <span className="text-2xl font-black text-green-600">${totales.total_recurrente.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* INVERSIÓN TOTAL - Estilo Compacto y Profesional */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl p-4 shadow-lg text-white">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-90 mb-0.5">Inversión Total</p>
                            <p className="text-[10px] opacity-75">
                                {totales.total_pagos_unicos > 0
                                    ? `Incluye pago inicial + ${formData.forma_pago === 'anual' ? 'pago anual' : `${formData.meses_pago} cuotas`}`
                                    : `${formData.forma_pago === 'anual' ? 'Pago anual completo' : `${formData.meses_pago} cuotas`}`
                                }
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-3xl font-black">${totales.total_general.toFixed(2)}</p>
                            {formData.forma_pago === 'mensual' && (
                                <p className="text-xs opacity-75 mt-0.5">
                                    ${totales.cuota_mensual.toFixed(2)}/mes
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Nota de validez */}
                <div className="text-center mt-3">
                    <p className="text-[10px] text-gray-500 italic">
                        Todos los valores expresados en USD
                    </p>
                </div>
            </div>
        </div>
    )
}
