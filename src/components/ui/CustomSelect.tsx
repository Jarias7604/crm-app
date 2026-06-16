import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string | React.ReactNode;
    icon?: React.ReactNode | string;
    color?: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (val: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ value, onChange, options, placeholder = 'Seleccionar...', className = '', buttonClassName = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => String(opt.value) === String(value));

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                className={buttonClassName || `w-full flex items-center justify-between bg-white border ${isOpen ? 'border-indigo-300 ring-4 ring-indigo-50/50' : 'border-gray-200 hover:border-gray-300'} shadow-sm rounded-xl px-3 py-2.5 text-left transition-all outline-none`}
            >
                <span className="flex items-center gap-2 text-sm font-bold text-gray-700 truncate">
                    {selectedOption?.icon && <span className="flex-shrink-0">{selectedOption.icon}</span>}
                    <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1.5 w-full bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-60 overflow-y-auto overscroll-contain custom-scrollbar">
                        {options.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 active:bg-gray-100
                                    ${String(value) === String(option.value) ? 'bg-indigo-50/50 text-indigo-700' : 'text-gray-700'}
                                `}
                            >
                                <span className={`flex items-center gap-2 font-bold truncate ${option.color || ''}`}>
                                    {option.icon && <span className="flex-shrink-0 text-[16px] leading-none">{option.icon}</span>}
                                    <span className="truncate">{option.label}</span>
                                </span>
                                {String(value) === String(option.value) && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
