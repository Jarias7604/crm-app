import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableOption {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  secondaryBadge?: string;
  secondaryBadgeColor?: string;
}

interface SearchableSelectProps {
  label: string;
  icon?: any;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  noneOptionLabel?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  popoverWidthClass?: string;
  className?: string;
}

export default function SearchableSelect({
  label,
  icon: Icon,
  placeholder = 'Seleccionar...',
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'No se encontraron resultados',
  options,
  value,
  onChange,
  noneOptionLabel = '(Opcional) Ninguno / General',
  disabled = false,
  align = 'left',
  popoverWidthClass,
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.id === value);

  const filteredOptions = options.filter((opt) => {
    const term = searchTerm.toLowerCase();
    return (
      opt.title.toLowerCase().includes(term) ||
      (opt.subtitle && opt.subtitle.toLowerCase().includes(term)) ||
      (opt.badge && opt.badge.toLowerCase().includes(term)) ||
      (opt.secondaryBadge && opt.secondaryBadge.toLowerCase().includes(term))
    );
  });

  return (
    <div className={`relative space-y-1.5 ${className}`} ref={containerRef}>
      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] px-3.5 py-2 border rounded-xl text-left text-xs transition flex items-center justify-between gap-2 shadow-2xs ${
          disabled
            ? 'opacity-60 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-500'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-white cursor-pointer'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedOption ? (
            <div className="min-w-0 flex-1 py-0.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-800 text-xs truncate" title={selectedOption.title}>
                  {selectedOption.title}
                </span>
                {selectedOption.badge && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${selectedOption.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {selectedOption.badge}
                  </span>
                )}
              </div>
              {selectedOption.subtitle && (
                <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">
                  {selectedOption.subtitle}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-medium text-xs">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && !disabled && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Floating Menu Popover (Amplio y sin textos truncados) */}
      {isOpen && (
        <div
          className={`absolute top-full mt-1.5 ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${
            popoverWidthClass || 'w-full min-w-[320px] sm:min-w-[480px] md:min-w-[540px]'
          } max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-3 space-y-2.5 animate-scaleUp`}
        >
          {/* Search Box con contador */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-24 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5">
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="p-1 hover:bg-slate-200 rounded-md text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                {filteredOptions.length}
              </span>
            </div>
          </div>

          {/* Listado con Cards Completas */}
          <div className="max-h-72 overflow-y-auto overscroll-contain divide-y divide-slate-100 text-xs custom-scrollbar pr-0.5">
            {/* Opción Ninguno / General */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 rounded-xl text-left transition flex items-center justify-between gap-2 mb-1 cursor-pointer ${
                !value ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="italic">{noneOptionLabel}</span>
              {!value && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold text-slate-400 space-y-1">
                <p>{emptyLabel}</p>
                <p className="text-[10px] text-slate-400 font-normal">Intenta buscar con otra palabra clave</p>
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-xl text-left transition flex items-start justify-between gap-3 cursor-pointer my-0.5 ${
                      isSelected
                        ? 'bg-indigo-50/90 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs'
                        : 'text-slate-800 hover:bg-indigo-50/50 hover:border-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Título Completo sin Truncar */}
                      <div className="font-bold text-slate-900 text-xs leading-snug whitespace-normal break-words">
                        {opt.title}
                      </div>

                      {/* Badges y Subtítulo / Cliente */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {opt.badge && (
                          <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border ${opt.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {opt.badge}
                          </span>
                        )}
                        {opt.secondaryBadge && (
                          <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md border ${opt.secondaryBadgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                            {opt.secondaryBadge}
                          </span>
                        )}
                        {opt.subtitle && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            {opt.subtitle}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-1" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
