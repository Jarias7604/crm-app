import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  value?: string;
  onChange?: (value: string) => void;
  /** Multi-select mode */
  multiple?: boolean;
  values?: string[];
  onChangeMultiple?: (values: string[]) => void;
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
  value = '',
  onChange,
  multiple = false,
  values = [],
  onChangeMultiple,
  noneOptionLabel = '(Opcional) Ninguno / General',
  disabled = false,
  align = 'left',
  className = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [maxListHeight, setMaxListHeight] = useState<number>(260);

  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside (checking both trigger and portal)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const inTrigger = containerRef.current?.contains(event.target as Node);
      const inPortal = portalRef.current?.contains(event.target as Node);
      if (!inTrigger && !inPortal) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const MARGIN = 12;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Open upward if less than 320px below and more space above
    const shouldOpenUpward = spaceBelow < 320 && spaceAbove > spaceBelow;
    const availableSpace = shouldOpenUpward ? spaceAbove - 16 : spaceBelow - 16;
    const reservedChrome = multiple ? 120 : 80;
    const computedMaxList = Math.max(140, Math.min(310, availableSpace - reservedChrome));
    setMaxListHeight(computedMaxList);

    const desiredWidth = Math.max(rect.width, Math.min(540, window.innerWidth - MARGIN * 2));
    const menuWidth = Math.min(desiredWidth, window.innerWidth - MARGIN * 2);

    let left = align === 'right' ? rect.right - menuWidth : rect.left;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - menuWidth - MARGIN));

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
  }, [align, multiple]);

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

  // Focus search input on open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  const selectedIds = multiple ? values : value ? [value] : [];
  const selectedOption = !multiple ? options.find((opt) => opt.id === value) : undefined;
  const selectedOptionsList = multiple ? options.filter((opt) => values.includes(opt.id)) : [];

  const filteredOptions = options.filter((opt) => {
    const term = searchTerm.toLowerCase();
    return (
      opt.title.toLowerCase().includes(term) ||
      (opt.subtitle && opt.subtitle.toLowerCase().includes(term)) ||
      (opt.badge && opt.badge.toLowerCase().includes(term)) ||
      (opt.secondaryBadge && opt.secondaryBadge.toLowerCase().includes(term))
    );
  });

  const handleToggleOption = (optId: string) => {
    if (multiple) {
      const exists = values.includes(optId);
      const next = exists ? values.filter((id) => id !== optId) : [...values, optId];
      onChangeMultiple?.(next);
      // Also notify single onChange with primary (first) item for backward compatibility
      onChange?.(next[0] || '');
    } else {
      onChange?.(optId);
      setIsOpen(false);
    }
  };

  const handleClearAll = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (multiple) {
      onChangeMultiple?.([]);
      onChange?.('');
    } else {
      onChange?.('');
    }
  };

  return (
    <div className={`relative space-y-1.5 ${className}`} ref={containerRef}>
      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between gap-1.5">
        <span className="flex items-center gap-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
          {label}
        </span>
        {multiple && selectedIds.length > 0 && (
          <span className="text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded-full normal-case">
            {selectedIds.length} {selectedIds.length === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
        )}
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
          {multiple ? (
            selectedOptionsList.length > 0 ? (
              <div className="min-w-0 flex-1 py-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md text-[11px] shrink-0">
                    {selectedOptionsList.length} {selectedOptionsList.length === 1 ? 'seleccionada' : 'seleccionadas'}
                  </span>
                  <span className="font-bold text-slate-800 text-xs truncate">
                    {selectedOptionsList.map((o) => o.title).join(', ')}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-slate-400 font-medium text-xs">{placeholder}</span>
            )
          ) : selectedOption ? (
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
          {selectedIds.length > 0 && !disabled && (
            <span
              onClick={handleClearAll}
              className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </button>

      {/* Floating Menu Popover Rendered via Portal (Never clipped by parent or screen bottom) */}
      {isOpen &&
        createPortal(
          <div
            ref={portalRef}
            style={popoverStyle}
            className="bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(15,23,42,0.25)] p-3 space-y-2.5 animate-in fade-in duration-100 font-sans"
          >
            {/* Search Box con contador */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
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
            <div
              style={{ maxHeight: `${maxListHeight}px` }}
              className="overflow-y-auto overscroll-contain divide-y divide-slate-100 text-xs custom-scrollbar pr-0.5"
            >
              {/* Opción Ninguno / General */}
              <button
                type="button"
                onClick={() => {
                  handleClearAll();
                  if (!multiple) setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-xl text-left transition flex items-center justify-between gap-2 mb-1 cursor-pointer ${
                  selectedIds.length === 0
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <span className="italic">{noneOptionLabel}</span>
                {selectedIds.length === 0 && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
              </button>

              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-xs font-semibold text-slate-400 space-y-1">
                  <p>{emptyLabel}</p>
                  <p className="text-[10px] text-slate-400 font-normal">Intenta buscar con otra palabra clave</p>
                </div>
              ) : (
                filteredOptions.map((opt) => {
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleOption(opt.id)}
                      className={`w-full px-3.5 py-2.5 rounded-xl text-left transition flex items-start justify-between gap-3 cursor-pointer my-0.5 ${
                        isSelected
                          ? 'bg-indigo-50/90 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs'
                          : 'text-slate-800 hover:bg-indigo-50/50 hover:border-slate-200'
                      }`}
                    >
                      {multiple && (
                        <div
                          className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
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
                      {!multiple && isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-1" />}
                    </button>
                  );
                })
              )}
            </div>

            {multiple && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {selectedIds.length === 0
                    ? 'Puedes marcar varias opciones'
                    : `${selectedIds.length} ${selectedIds.length === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleClearAll()}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    >
                      Limpiar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Listo ({selectedIds.length})
                  </button>
                </div>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
