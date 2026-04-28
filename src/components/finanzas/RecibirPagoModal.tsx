import React, { useState } from 'react';
import { X, Upload, CheckCircle2, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { pagosService, type PanoramaFinanciero, type CuotaEsperada } from '../../services/pagos';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/AuthProvider';

interface RecibirPagoModalProps {
  cuenta: PanoramaFinanciero;
  cuotaEsperada?: CuotaEsperada;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecibirPagoModal({ cuenta, cuotaEsperada, onClose, onSuccess }: RecibirPagoModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [monto, setMonto] = useState(cuotaEsperada ? cuotaEsperada.monto_total_cuota.toString() : cuenta.valor_por_cuota.toString());
  const [metodo, setMetodo] = useState<'transferencia' | 'efectivo' | 'cheque' | 'tarjeta' | 'otro' | 'zelle' | 'ach'>('transferencia');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.company_id) return;
    
    setLoading(true);
    try {
      let comprobante_url = null;
      let comprobante_path = null;

      if (file) {
        toast.loading('Subiendo comprobante...', { id: 'upload' });
        const upload = await pagosService.uploadComprobante(profile.company_id, file);
        comprobante_url = upload.url;
        comprobante_path = upload.path;
        toast.dismiss('upload');
      }

      await pagosService.create({
        cotizacion_id: cuenta.cotizacion_id,
        monto: Number(monto),
        fecha_pago: fecha,
        tipo: cuotaEsperada ? 'cuota' : (cuenta.tipo_pago?.toLowerCase() === 'mensual' ? 'mensualidad' : 'otro'),
        numero_cuota: cuotaEsperada ? cuotaEsperada.numero_cuota : null,
        metodo_pago: metodo as any,
        notas,
        comprobante_url,
        comprobante_path
      } as any);

      toast.success('Pago registrado exitosamente');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Error al registrar el pago');
      toast.dismiss('upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Recibir Pago</h2>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{cuenta.nombre_cliente}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="pago-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Monto a Recibir ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="font-mono text-lg font-bold text-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Fecha del Pago</label>
                <Input
                  type="date"
                  required
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Método de Pago</label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as any)}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl px-4 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              >
                <option value="transferencia">Transferencia Bancaria</option>
                <option value="zelle">Zelle</option>
                <option value="ach">ACH / Wire</option>
                <option value="tarjeta">Tarjeta de Crédito / Débito</option>
                <option value="cheque">Cheque</option>
                <option value="efectivo">Efectivo</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Comprobante (Recibo / Factura)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  id="receipt-upload"
                  className="hidden"
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="receipt-upload" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                  {file ? (
                    <>
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <span className="text-sm font-medium text-slate-700">{file.name}</span>
                      <span className="text-xs text-indigo-600 hover:underline">Cambiar archivo</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400" />
                      <span className="text-sm font-medium text-slate-600">Haz clic para subir un comprobante</span>
                      <span className="text-xs text-slate-400">PDF, JPG, PNG (Max 5MB)</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notas / Referencia</label>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Número de confirmación, notas internas..."
                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none h-20"
              />
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" form="pago-form" disabled={loading}>
            {loading ? 'Procesando...' : 'Registrar Pago'}
          </Button>
        </div>
      </div>
    </div>
  );
}
