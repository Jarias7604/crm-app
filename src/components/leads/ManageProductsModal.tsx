import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Box, Info } from 'lucide-react';
import { leadProductsService } from '../../services/leadProducts';
import type { LeadProduct } from '../../types';
import toast from 'react-hot-toast';

interface ManageProductsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onProductsChanged?: () => void;
}

export function ManageProductsModal({ isOpen, onClose, onProductsChanged }: ManageProductsModalProps) {
    const [products, setProducts] = useState<LeadProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadProducts();
        }
    }, [isOpen]);

    const loadProducts = async () => {
        setLoading(true);
        try {
            const data = await leadProductsService.getAllProducts();
            setProducts(data);
        } catch (error) {
            toast.error('Error al cargar los productos');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return toast.error('El nombre es obligatorio');

        setSaving(true);
        try {
            await leadProductsService.createProduct(name, description);
            setName('');
            setDescription('');
            toast.success('✅ Producto de interés creado');
            await loadProducts();
            if (onProductsChanged) onProductsChanged();
        } catch (error: any) {
            toast.error(`Error al crear: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, productName: string) => {
        if (!confirm(`¿Estás seguro de que deseas eliminar "${productName}"? Los leads asociados ya no mostrarán este producto.`)) return;

        try {
            await leadProductsService.deleteProduct(id);
            toast.success('🗑️ Producto de interés eliminado');
            await loadProducts();
            if (onProductsChanged) onProductsChanged();
        } catch (error: any) {
            toast.error(`Error al eliminar: ${error.message}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center animate-in fade-in duration-200">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal Box */}
            <div className="relative w-full max-w-[520px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 m-4">
                
                {/* Header */}
                <div className="h-16 bg-gradient-to-r from-indigo-600 to-blue-600 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Box className="w-4.5 h-4.5 text-white" />
                        </div>
                        <h3 className="text-base font-bold text-white tracking-tight">Productos de Interés</h3>
                    </div>
                    <button
                        onClick={onClose}
                        type="button"
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors text-white"
                    >
                        <X className="w-4.5 h-4.5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Add Form */}
                    <form onSubmit={handleCreate} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3.5">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Agregar Nuevo Producto</h4>
                        
                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nombre *</label>
                            <input
                                required
                                type="text"
                                placeholder="Ej: Licencia SaaS Anual, Soporte Técnico, etc."
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full h-11 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-semibold text-gray-900 bg-white px-4 outline-none transition-all text-sm placeholder:text-gray-300"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Descripción</label>
                            <input
                                type="text"
                                placeholder="Breve nota del producto..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full h-11 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 font-medium text-gray-700 bg-white px-4 outline-none transition-all text-sm placeholder:text-gray-300"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar Producto
                        </button>
                    </form>

                    {/* Products List */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Productos Existentes</h4>
                        
                        {loading ? (
                            <div className="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando productos...</div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-10 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center p-4">
                                <Info className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-xs font-bold text-slate-400">Aún no hay productos de interés agregados</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">Agrega el primero usando el formulario de arriba.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto border border-slate-200/60 rounded-2xl bg-white shadow-sm">
                                {products.map((prod) => (
                                    <div key={prod.id} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 transition-colors">
                                        <div className="min-w-0 pr-4">
                                            <p className="text-sm font-bold text-slate-800 truncate">{prod.name}</p>
                                            {prod.description && (
                                                <p className="text-xs text-slate-500 truncate mt-0.5">{prod.description}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(prod.id, prod.name)}
                                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-all shrink-0 active:scale-95"
                                            title="Eliminar producto"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
