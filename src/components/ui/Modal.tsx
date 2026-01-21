import { X } from 'lucide-react';
import { cn } from '../../lib/utils'; // fix format if needed

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity">
            <div className={cn("bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 flex flex-col max-h-[90vh]", className)}>
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-500 focus:outline-none"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
