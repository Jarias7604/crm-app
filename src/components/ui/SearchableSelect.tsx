import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableOption {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
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
  noneOptionLabel = '(Opcional) Ninguno / General'
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
      (opt.badge && opt.badge.toLowerCase().includes(term))
    );
  });

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        {label}
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 bg-slate-50 hover:bg-slate-100/80 border rounded-xl text-left text-xs transition flex items-center justify-between gap-2 shadow-2xs ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/10 bg-white' : 'border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {selectedOption ? (
            <div className="truncate">
              <span className="font-bold text-slate-800 block truncate">
                {selectedOption.title}
              </span>
              {selectedOption.subtitle && (
                <span className="text-[10px] text-slate-400 block truncate">
                  {selectedOption.subtitle}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:text-slate-600 rounded transition"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[280px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 space-y-2 animate-scaleUp">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 text-xs">
            {/* None Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-left transition flex items-center justify-between gap-2 ${
                !value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <span className="italic">{noneOptionLabel}</span>
              {!value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
            </button>

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-[11px] text-slate-400">
                {emptyLabel}
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
                    className={`w-full px-2.5 py-2 rounded-lg text-left transition flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-900 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate block font-medium">{opt.title}</span>
                        {opt.badge && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${opt.badgeColor || 'bg-slate-100 text-slate-600'}`}>
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.subtitle && (
                        <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
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
