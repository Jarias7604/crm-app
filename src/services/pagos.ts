import { supabase } from './supabase';

export type TipoPago = 'anticipo' | 'cuota' | 'mensualidad' | 'otro';
export type MetodoPago = 'transferencia' | 'efectivo' | 'cheque' | 'tarjeta' | 'otro';

export interface Pago {
  id: string;
  company_id: string;
  cotizacion_id: string;
  lead_id: string | null;
  monto: number;
  fecha_pago: string;
  tipo: TipoPago;
  numero_cuota: number | null;
  metodo_pago: MetodoPago | null;
  registrado_por: string | null;
  notas: string | null;
  comprobante_url?: string | null;
  comprobante_path?: string | null;
  created_at: string;
}

export interface PanoramaFinanciero {
  cotizacion_id: string;
  nombre_cliente: string;
  plan_nombre: string;
  tipo_pago: string | null;
  venta_total: number;
  anticipo_acordado: number | null;
  total_cuotas: number | null;
  plazo_meses: number | null;
  total_cobrado: number;
  total_pendiente: number;
  cuotas_pagadas: number;
  cuotas_restantes: number;
  valor_por_cuota: number;
  ultimo_pago: string | null;
  cotizacion_fecha: string;
}

export const pagosService = {
  /** Obtener todos los pagos de una cotización */
  async getByCotizacion(cotizacionId: string): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('cotizacion_id', cotizacionId)
      .order('fecha_pago', { ascending: false });
    if (error) throw error;
    return data as Pago[];
  },

  /** Obtener todos los pagos de un lead (vía cotizaciones) */
  async getByLead(leadId: string): Promise<Pago[]> {
    const { data, error } = await supabase
      .from('pagos')
      .select('*')
      .eq('lead_id', leadId)
      .order('fecha_pago', { ascending: false });
    if (error) throw error;
    return data as Pago[];
  },

  /** Registrar un nuevo pago */
  async create(pago: {
    cotizacion_id: string;
    lead_id?: string | null;
    monto: number;
    fecha_pago: string;
    tipo: TipoPago;
    numero_cuota?: number | null;
    metodo_pago?: MetodoPago | null;
    notas?: string | null;
  }): Promise<Pago> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    const { data, error } = await supabase
      .from('pagos')
      .insert({
        ...pago,
        company_id: profile!.company_id,
        registrado_por: user!.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Pago;
  },

  /** Eliminar un pago (solo admin) */
  async delete(pagoId: string): Promise<void> {
    const { error } = await supabase.from('pagos').delete().eq('id', pagoId);
    if (error) throw error;
  },

  /** Panorama financiero completo desde la vista */
  async getPanorama(companyId: string, startDate?: string, endDate?: string): Promise<PanoramaFinanciero[]> {
    let query = supabase
      .from('panorama_financiero')
      .select('*')
      .eq('company_id', companyId)
      .order('cotizacion_fecha', { ascending: false });
      
    if (startDate) {
      query = query.gte('cotizacion_fecha', startDate);
    }
    if (endDate) {
      query = query.lte('cotizacion_fecha', endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as PanoramaFinanciero[];
  },

  /**
   * Cuentas por Cobrar — Vista jerárquica por CLIENTE
   * Retorna cotizaciones aceptadas con sus pagos recibidos y cuotas esperadas (si las tiene),
   * agrupadas por nombre_cliente.
   */
  async getClientesCuentas(companyId: string): Promise<ClienteCuenta[]> {
    // 1. Cotizaciones activas (query simple, sin joins anidados para evitar errores silenciosos de FK)
    const { data: cotizaciones, error: cotError } = await supabase
      .from('cotizaciones')
      .select('id, nombre_cliente, lead_id, plan_nombre, tipo_pago, total_anual, monto_anticipo, cuotas, plazo_meses, estado, created_at')
      .eq('company_id', companyId)
      .in('estado', ['aceptada', 'ganado', 'aprobada', 'pagado', 'activo'])
      .order('created_at', { ascending: false });

    if (cotError) throw cotError;
    if (!cotizaciones || cotizaciones.length === 0) return [];

    const cotIds = cotizaciones.map(c => c.id);

    // 2. Pagos recibidos por cotización (query separado — más robusto que nested select)
    const { data: todosLosPagos } = await supabase
      .from('pagos')
      .select('id, cotizacion_id, monto, fecha_pago, tipo, metodo_pago, numero_cuota, notas, comprobante_url, comprobante_path, created_at')
      .in('cotizacion_id', cotIds)
      .order('fecha_pago', { ascending: false });

    const pagosByCot: Record<string, any[]> = {};
    (todosLosPagos || []).forEach(p => {
      if (!pagosByCot[p.cotizacion_id]) pagosByCot[p.cotizacion_id] = [];
      pagosByCot[p.cotizacion_id].push(p);
    });

    // 3. Planes de pago activos con sus cuotas esperadas (query separado)
    const { data: planes } = await supabase
      .from('planes_pago')
      .select('id, cotizacion_id, estado, monto_total, plazo_meses, sistema_amortizacion')
      .in('cotizacion_id', cotIds)
      .eq('estado', 'activo');

    const planIds = (planes || []).map(p => p.id);
    const planByCot: Record<string, string> = {};
    (planes || []).forEach(p => { planByCot[p.cotizacion_id] = p.id; });

    let cuotasByCot: Record<string, any[]> = {};
    if (planIds.length > 0) {
      const { data: todasLasCuotas } = await supabase
        .from('cuotas_esperadas')
        .select('id, plan_pago_id, numero_cuota, fecha_vencimiento, monto_total_cuota, monto_capital, monto_interes, monto_pagado, saldo_restante_capital, estado')
        .in('plan_pago_id', planIds)
        .order('numero_cuota', { ascending: true });

      // Mapear cuotas por cotizacion_id (a través del plan)
      const cotByPlan: Record<string, string> = {};
      Object.entries(planByCot).forEach(([cotId, planId]) => { cotByPlan[planId] = cotId; });

      (todasLasCuotas || []).forEach(ce => {
        const cotId = cotByPlan[ce.plan_pago_id];
        if (cotId) {
          if (!cuotasByCot[cotId]) cuotasByCot[cotId] = [];
          cuotasByCot[cotId].push(ce);
        }
      });
    }

    // 4. Construir contratos enriquecidos
    const contratos: ContratoCuenta[] = cotizaciones.map(cot => {
      const pagosRecibidos = pagosByCot[cot.id] || [];
      const totalCobrado = pagosRecibidos.reduce((s: number, p: any) => s + Number(p.monto), 0);
      const totalContrato = Number(cot.total_anual) || 0;
      const totalPendiente = Math.max(0, totalContrato - totalCobrado);
      const cuotas = cuotasByCot[cot.id] || [];

      return {
        cotizacion_id: cot.id,
        nombre_cliente: cot.nombre_cliente,
        lead_id: cot.lead_id,
        plan_nombre: cot.plan_nombre,
        tipo_pago: cot.tipo_pago,
        total_contrato: totalContrato,
        total_cobrado: totalCobrado,
        total_pendiente: totalPendiente,
        anticipo: Number(cot.monto_anticipo) || 0,
        cuotas_pactadas: cot.cuotas || 0,
        plazo_meses: cot.plazo_meses || 0,
        estado_contrato: cot.estado,
        fecha_contrato: cot.created_at,
        pagos_recibidos: pagosRecibidos,
        schedule: cuotas,
        tiene_plan_amortizacion: cuotas.length > 0,
      };
    });

    // 5. Agrupar por cliente
    const clienteMap: Record<string, ClienteCuenta> = {};
    contratos.forEach(contrato => {
      const key = contrato.nombre_cliente;
      if (!clienteMap[key]) {
        clienteMap[key] = {
          nombre_cliente: contrato.nombre_cliente,
          lead_id: contrato.lead_id,
          contratos: [],
          total_cobrado: 0,
          total_pendiente: 0,
          total_contratos: 0,
        };
      }
      clienteMap[key].contratos.push(contrato);
      clienteMap[key].total_cobrado += contrato.total_cobrado;
      clienteMap[key].total_pendiente += contrato.total_pendiente;
      clienteMap[key].total_contratos += contrato.total_contrato;
    });

    return Object.values(clienteMap).sort((a, b) => b.total_pendiente - a.total_pendiente);
  },

  /** Subir un comprobante (Recibo/Factura) */
  async uploadComprobante(companyId: string, file: File): Promise<{ url: string; path: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${companyId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('receipts').getPublicUrl(filePath);
    return { url: data.publicUrl, path: filePath };
  },

  /** Resumen financiero agregado para KPI cards */
  async getResumen(companyId: string): Promise<{
    ventaTotal: number;
    totalCobrado: number;
    totalPendiente: number;
    cotizacionesActivas: number;
  }> {
    const panorama = await pagosService.getPanorama(companyId);
    return {
      ventaTotal: panorama.reduce((s, p) => s + (p.venta_total || 0), 0),
      totalCobrado: panorama.reduce((s, p) => s + (p.total_cobrado || 0), 0),
      totalPendiente: panorama.reduce((s, p) => s + (p.total_pendiente || 0), 0),
      cotizacionesActivas: panorama.length,
    };
  },
};

// ─── Types for hierarchical AR view ───────────────────────────────────────────

export interface ContratoCuenta {
  cotizacion_id: string;
  nombre_cliente: string;
  lead_id: string | null;
  plan_nombre: string;
  tipo_pago: string | null;
  total_contrato: number;
  total_cobrado: number;
  total_pendiente: number;
  anticipo: number;
  cuotas_pactadas: number;
  plazo_meses: number;
  estado_contrato: string;
  fecha_contrato: string;
  pagos_recibidos: any[];
  schedule: any[]; // cuotas_esperadas rows
  tiene_plan_amortizacion: boolean;
}

export interface ClienteCuenta {
  nombre_cliente: string;
  lead_id: string | null;
  contratos: ContratoCuenta[];
  total_cobrado: number;
  total_pendiente: number;
  total_contratos: number;
}

export interface Gasto {
  id: string;
  company_id: string;
  concepto: string;
  categoria: string;
  monto: number;
  fecha: string;
  notas: string | null;
  comprobante_url?: string | null;
  comprobante_path?: string | null;
  registrado_por: string | null;
  created_at: string;
}

export const gastosService = {
  async getGastos(companyId: string, startDate?: string, endDate?: string): Promise<Gasto[]> {
    let query = supabase
      .from('gastos')
      .select('*')
      .eq('company_id', companyId)
      .order('fecha', { ascending: false });

    if (startDate) query = query.gte('fecha', startDate);
    if (endDate) query = query.lte('fecha', endDate);

    const { data, error } = await query;
    if (error) throw error;
    return data as Gasto[];
  },

  async create(gasto: Partial<Gasto>): Promise<Gasto> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user!.id)
      .single();

    const { data, error } = await supabase
      .from('gastos')
      .insert({
        ...gasto,
        company_id: profile!.company_id,
        registrado_por: user!.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Gasto;
  },

  async delete(gastoId: string): Promise<void> {
    const { error } = await supabase.from('gastos').delete().eq('id', gastoId);
    if (error) throw error;
  }
};

export interface PlanPago {
  id: string;
  company_id: string;
  lead_id: string;
  cotizacion_id: string | null;
  monto_total: number;
  monto_anticipo: number;
  saldo_a_financiar: number;
  plazo_meses: number;
  tasa_interes_anual: number;
  sistema_amortizacion: 'flat' | 'frances' | 'unico';
  fecha_inicio: string;
  estado: 'borrador' | 'activo' | 'pagado' | 'mora' | 'cancelado';
  created_at?: string;
}

export interface CuotaEsperada {
  id: string;
  plan_pago_id: string;
  company_id: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto_capital: number;
  monto_interes: number;
  monto_total_cuota: number;
  saldo_restante_capital: number;
  monto_pagado: number;
  estado: 'pendiente' | 'parcial' | 'pagada' | 'vencida';
  fecha_ultimo_pago?: string;
  created_at?: string;
}

export const planPagoService = {
  async getPlanesByLead(leadId: string): Promise<PlanPago[]> {
    const { data, error } = await supabase.from('planes_pago').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    if (error) throw error;
    return data as PlanPago[];
  },

  async getCuotasByPlan(planId: string): Promise<CuotaEsperada[]> {
    const { data, error } = await supabase.from('cuotas_esperadas').select('*').eq('plan_pago_id', planId).order('numero_cuota', { ascending: true });
    if (error) throw error;
    return data as CuotaEsperada[];
  },

  async generarPlanAmortizacion(plan: Partial<PlanPago>): Promise<{ plan: PlanPago, cuotas: CuotaEsperada[] }> {
    // Call Supabase RPC or do math locally. Since we need to insert rows safely, we can calculate locally and insert in batch.
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user!.id).single();
    
    // 1. Calculate the Amortization Table
    const cuotas: Partial<CuotaEsperada>[] = [];
    const saldoInicial = Number(plan.saldo_a_financiar);
    const plazo = Number(plan.plazo_meses);
    const tasaAnual = Number(plan.tasa_interes_anual) || 0;
    
    let saldoRestante = saldoInicial;
    const tasaMensual = (tasaAnual / 100) / 12;
    
    // Calcular cuota fija y total de interes si aplica
    let cuotaFija = 0;
    let interesTotalFlat = 0;

    if (plan.sistema_amortizacion === 'frances' && tasaMensual > 0) {
      cuotaFija = saldoInicial * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1);
    } else if (plan.sistema_amortizacion === 'flat' && tasaMensual > 0) {
      // Flat rate: interes sobre el capital original por el plazo
      interesTotalFlat = saldoInicial * tasaMensual * plazo;
      cuotaFija = (saldoInicial + interesTotalFlat) / plazo;
      saldoRestante = saldoInicial; // Capital restante
    } else {
      // Sin interés
      cuotaFija = saldoInicial / plazo;
    }

    // Parse YYYY-MM-DD reliably sin timezone shift
    const [year, month, day] = plan.fecha_inicio!.split('-').map(Number);

    for (let i = 1; i <= plazo; i++) {
      let interes = 0;
      let capital = 0;

      if (plan.sistema_amortizacion === 'frances' && tasaMensual > 0) {
        interes = saldoRestante * tasaMensual;
        capital = cuotaFija - interes;
      } else if (plan.sistema_amortizacion === 'flat' && tasaMensual > 0) {
        interes = interesTotalFlat / plazo;
        capital = saldoInicial / plazo;
      } else {
        capital = cuotaFija;
        interes = 0;
      }

      saldoRestante -= capital;
      if (Math.abs(saldoRestante) < 0.01) saldoRestante = 0; // Fix floating point issues

      // Calculate date without timezone shift
      const fechaVencimiento = new Date(Date.UTC(year, month - 1 + (i - 1), day));
      const fechaVencimientoStr = fechaVencimiento.toISOString().split('T')[0];

      cuotas.push({
        numero_cuota: i,
        fecha_vencimiento: fechaVencimientoStr,
        monto_capital: Number(capital.toFixed(2)),
        monto_interes: Number(interes.toFixed(2)),
        monto_total_cuota: Number(cuotaFija.toFixed(2)),
        saldo_restante_capital: Number(saldoRestante.toFixed(2)),
        monto_pagado: 0,
        estado: 'pendiente'
      });
    }

    // 2. Insert Plan
    const { data: planData, error: planError } = await supabase.from('planes_pago').insert({
      ...plan,
      company_id: profile!.company_id,
      estado: 'activo'
    }).select().single();
    if (planError) throw planError;

    // 3. Insert Cuotas
    const cuotasToInsert = cuotas.map(c => ({ ...c, plan_pago_id: planData.id, company_id: profile!.company_id }));
    const { data: cuotasData, error: cuotasError } = await supabase.from('cuotas_esperadas').insert(cuotasToInsert).select();
    if (cuotasError) throw cuotasError;

    // 4. Sync cotizacion: update tipo_pago, cuotas, plazo_meses so Finanzas module shows it correctly
    if (plan.cotizacion_id) {
      await supabase.from('cotizaciones').update({
        tipo_pago: 'credito',
        cuotas: plan.plazo_meses,
        plazo_meses: plan.plazo_meses,
        monto_anticipo: plan.monto_anticipo || 0,
      }).eq('id', plan.cotizacion_id);
    }

    return { plan: planData as PlanPago, cuotas: cuotasData as CuotaEsperada[] };
  }
};
