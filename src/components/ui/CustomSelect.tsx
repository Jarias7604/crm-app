import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
    const [maxListHeight, setMaxListHeight] = useState<number>(240);

    const ref = useRef<HTMLDivElement>(null);
    const portalRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Auto-enable search if there are 6 or more options unless explicitly disabled
    const isSearchEnabled = searchable !== undefined ? searchable : options.length >= 6;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const inTrigger = ref.current?.contains(event.target as Node);
            const inPortal = portalRef.current?.contains(event.target as Node);
            if (!inTrigger && !inPortal) {
                setIsOpen(false);
                setSearchTerm('');
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const updatePosition = useCallback(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const MARGIN = 8;
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const shouldOpenUpward = spaceBelow < 280 && spaceAbove > spaceBelow;

        const availableSpace = shouldOpenUpward ? spaceAbove - 16 : spaceBelow - 16;
        const listSpace = isSearchEnabled ? availableSpace - 56 : availableSpace - 16;
        const computedMaxList = Math.max(130, Math.min(260, listSpace));
        setMaxListHeight(computedMaxList);

        const menuWidth = Math.min(
            Math.max(rect.width, 240),
            window.innerWidth - MARGIN * 2
        );
        const left = Math.max(
            MARGIN,
            Math.min(rect.left, window.innerWidth - menuWidth - MARGIN)
        );

        if (shouldOpenUpward) {
            setPopoverStyle({
                position: 'fixed',
                bottom: `${Math.max(MARGIN, window.innerHeight - rect.top + 6)}px`,
                left: `${left}px`,
                width: `${menuWidth}px`,
                zIndex: 10005,
            });
        } else {
            setPopoverStyle({
                position: 'fixed',
                top: `${Math.max(MARGIN, rect.bottom + 6)}px`,
                left: `${left}px`,
                width: `${menuWidth}px`,
                zIndex: 10005,
            });
        }
    }, [isSearchEnabled]);

    useEffect(() => {
        if (!isOpen) return;
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [isOpen, updatePosition]);

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
                className={buttonClassName || `w-full h-9 flex items-center justify-between bg-white border ${isOpen ? 'border-blue-600 ring-1 ring-blue-500' : 'border-slate-300 hover:border-slate-400'} shadow-2xs rounded-md px-3 text-left transition-all outline-none cursor-pointer`}
            >
                <span className="flex items-center gap-2 text-xs font-semibold text-slate-800 truncate">
                    {selectedOption?.icon && <span className="flex-shrink-0 text-base leading-none">{selectedOption.icon}</span>}
                    <span className="truncate">{selectedOption ? (selectedOption.shortLabel || selectedOption.label) : placeholder}</span>
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
            </button>

            {isOpen &&
                createPortal(
                    <div
                        ref={portalRef}
                        style={popoverStyle}
                        className="bg-white rounded-xl shadow-[0_16px_44px_rgba(15,23,42,0.22)] border border-slate-200 overflow-hidden py-1 animate-in fade-in duration-100 font-sans"
                    >
                        {/* Buscador con lupa */}
                        {isSearchEnabled && (
                            <div className="p-2 border-b border-slate-100 bg-slate-50/80">
                                <div className="relative flex items-center">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="Buscar opción..."
                                        className="w-full h-7.5 pl-8 pr-7 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 placeholder:text-slate-400 placeholder:font-normal"
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
                                            className="absolute right-2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div
                            style={{ maxHeight: `${maxListHeight}px` }}
                            className="overflow-y-auto overscroll-contain custom-scrollbar py-1"
                        >
                            {filteredOptions.length === 0 ? (
                                <div className="px-3 py-5 text-center text-xs font-semibold text-slate-400">
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
                                            className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer
                                                ${isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 font-medium'}
                                            `}
                                        >
                                            <span className={`flex items-center gap-2 ${option.color || ''}`}>
                                                {option.icon && <span className="flex-shrink-0 text-base leading-none">{option.icon}</span>}
                                                <span className="whitespace-normal leading-snug">{option.label}</span>
                                            </span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 ml-2" />}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>,
                    document.body
                )}
        </div>
    );
};
