import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string | React.ReactNode;
    shortLabel?: string;
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
    searchable?: boolean;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Seleccionar...',
    className = '',
    buttonClassName = '',
    searchable,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Auto-enable search if there are 6 or more options unless explicitly disabled
    const isSearchEnabled = searchable !== undefined ? searchable : options.length >= 6;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (isOpen && isSearchEnabled) {
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 60);
            return () => clearTimeout(timer);
        } else {
            setSearchTerm('');
        }
    }, [isOpen, isSearchEnabled]);

    // Flexible match: match by value OR match by label (case-insensitive)
    const selectedOption = options.find(opt => {
        const strVal = String(value || '').toLowerCase().trim();
        if (!strVal) return !opt.value;
        const optVal = String(opt.value || '').toLowerCase().trim();
        const optLabel = typeof opt.label === 'string' ? opt.label.toLowerCase().trim() : '';
        return optVal === strVal || (optLabel && optLabel === strVal);
    });

    const filteredOptions = useMemo(() => {
        const query = searchTerm.toLowerCase().trim();
        if (!query) return options;
        return options.filter(opt => {
            const valStr = String(opt.value || '').toLowerCase();
            const labelStr = typeof opt.label === 'string' ? opt.label.toLowerCase() : '';
            return valStr.includes(query) || labelStr.includes(query);
        });
    }, [options, searchTerm]);

    return (
        <div className={`relative ${className}`} ref={ref}>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(!isOpen);
                }}
                className={buttonClassName || `w-full h-11 flex items-center justify-between bg-white border ${isOpen ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'} shadow-2xs rounded-xl px-3.5 text-left transition-all outline-none cursor-pointer`}
            >
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 truncate">
                    {selectedOption?.icon && <span className="flex-shrink-0 text-base leading-none">{selectedOption.icon}</span>}
                    <span className="truncate">{selectedOption ? (selectedOption.shortLabel || selectedOption.label) : placeholder}</span>
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 mt-1.5 w-full min-w-[280px] sm:min-w-[320px] max-w-[420px] bg-white rounded-2xl shadow-[0_12px_36px_rgb(0,0,0,0.15)] border border-slate-200 overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Buscador con lupa */}
                    {isSearchEnabled && (
                        <div className="p-2 border-b border-gray-100 bg-slate-50/70">
                            <div className="relative flex items-center">
                                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Buscar opción..."
                                    className="w-full h-8 pl-8 pr-7 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-400 placeholder:font-normal"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {searchTerm && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                             e.stopPropagation();
                                             setSearchTerm('');
                                             searchInputRef.current?.focus();
                                        }}
                                        className="absolute right-2 p-0.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 cursor-pointer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto overscroll-contain custom-scrollbar py-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs font-bold text-gray-400">
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredOptions.map((option) => {
                                const isSelected = selectedOption?.value === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            onChange(option.value);
                                            setIsOpen(false);
                                            setSearchTerm('');
                                        }}
                                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-indigo-50/60 active:bg-indigo-100/70 cursor-pointer
                                            ${isSelected ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700 font-medium'}
                                        `}
                                    >
                                        <span className={`flex items-center gap-2.5 ${option.color || ''}`}>
                                            {option.icon && <span className="flex-shrink-0 text-base leading-none">{option.icon}</span>}
                                            <span className="whitespace-normal leading-snug">{option.label}</span>
                                        </span>
                                        {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
