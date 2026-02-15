import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';

export const PWAInstallPrompt: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'other' | null>(null);

    useEffect(() => {
        // 1. Detect platform
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

        // 2. Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

        if (isIOS && !isStandalone) {
            setPlatform('ios');
            // Show prompt after a short delay
            const timer = setTimeout(() => setShowPrompt(true), 3000);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-6 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-5 duration-500">
            <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 overflow-hidden">
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Download className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">Instalar Arias CRM</h3>
                            <p className="text-indigo-100 text-[11px]">Accede más rápido desde tu inicio</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowPrompt(false)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white/70" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {platform === 'ios' && (
                        <div className="space-y-3">
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 font-bold text-indigo-600 text-sm">1</div>
                                <p className="text-sm text-gray-600 font-medium">
                                    Toca el botón <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 rounded text-indigo-600"><Share className="w-3 h-3 mr-1" /> Compartir</span> en la barra inferior de Safari.
                                </p>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0 font-bold text-indigo-600 text-sm">2</div>
                                <p className="text-sm text-gray-600 font-medium">
                                    Busca y selecciona <span className="font-bold text-gray-900">"Agregar a la pantalla de inicio"</span>.
                                </p>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-3 text-indigo-600 text-[11px] font-bold uppercase tracking-wider justify-center">
                                <span>RÁPIDO</span>
                                <span className="w-1 h-1 bg-indigo-200 rounded-full"></span>
                                <span>SEGURO</span>
                                <span className="w-1 h-1 bg-indigo-200 rounded-full"></span>
                                <span>PROFESIONAL</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
