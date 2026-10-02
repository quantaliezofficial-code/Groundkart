import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Option {
  value: string;
  label: string;
  isGroupHeader?: boolean;
}

interface GroundSelectProps {
  value: string;
  onValueChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  icon?: React.ReactNode;
  label?: string;
  labelIcon?: React.ReactNode;
}

export default function GroundSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
  triggerClassName = "",
  dropdownClassName = "",
  icon,
  label,
  labelIcon
}: GroundSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom');
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex(opt => opt.value === value);
      setFocusedIndex(idx >= 0 ? idx : 0);
      
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const requiredSpace = Math.min(options.length * 44 + 16, 300);
        
        if (spaceBelow < requiredSpace && spaceAbove > spaceBelow) {
          setDropdownPosition('top');
        } else {
          setDropdownPosition('bottom');
        }
      }
    }
  }, [isOpen, value, options]);

  useEffect(() => {
    if (isOpen && listboxRef.current && focusedIndex >= 0) {
      const element = listboxRef.current.children[focusedIndex] as HTMLElement;
      if (element) {
        element.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (isOpen) {
          if (focusedIndex >= 0 && focusedIndex < options.length) {
            onValueChange(options[focusedIndex].value);
            setIsOpen(false);
          }
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        if (isOpen) {
          setIsOpen(false);
          e.stopPropagation();
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex(prev => {
          let next = prev < options.length - 1 ? prev + 1 : prev;
          while (next < options.length - 1 && options[next].isGroupHeader) next++;
          return next;
        });
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setFocusedIndex(prev => {
          let prevIdx = prev > 0 ? prev - 1 : prev;
          while (prevIdx > 0 && options[prevIdx].isGroupHeader) prevIdx--;
          return prevIdx;
        });
        }
        break;
      case 'Tab':
        if (isOpen) setIsOpen(false);
        break;
    }
  };

  const popoverVariants = {
    hidden: { opacity: 0, y: dropdownPosition === 'bottom' ? -4 : 4, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: dropdownPosition === 'bottom' ? -4 : 4, scale: 0.98 }
  };

  // If label is provided, use the complex hero-style layout
  // Otherwise, use a standard select button layout
  return (
    <div 
      className={`relative ${className}`} 
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left transition-colors focus:outline-none ease-out cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          label 
            ? `h-full px-4 py-3 rounded-xl bg-mist/50 hover:bg-mist focus:bg-white focus:ring-2 focus:ring-pitch/20 flex flex-col items-start ${triggerClassName}`
            : `flex items-center justify-between px-3.5 py-2.5 bg-white border border-ink/10 rounded-xl hover:bg-mist/30 focus:ring-2 focus:ring-pitch/20 ${triggerClassName}`
        }`}
      >
        {label ? (
          <>
            <div className="flex items-center gap-1.5 mb-1.5 w-full">
              {labelIcon}
              <span className="font-sans text-[11px] font-semibold text-pitch/80 uppercase tracking-wide">{label}</span>
            </div>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 truncate">
                {icon && <span className="flex-shrink-0">{icon}</span>}
                <span className={`truncate font-sans font-medium text-[15px] ${!selectedOption ? 'text-ink/40' : 'text-ink'}`}>
                  {selectedOption ? selectedOption.label : placeholder}
                </span>
              </div>
              <ChevronDown size={16} className={`text-ink/40 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 truncate">
              {icon && <span className="flex-shrink-0">{icon}</span>}
              <span className={`truncate font-sans text-[14px] ${!selectedOption ? 'text-ink/40' : 'text-ink'}`}>
                {selectedOption ? selectedOption.label : placeholder}
              </span>
            </div>
            <ChevronDown size={16} className={`text-ink/40 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            variants={popoverVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={`absolute z-[100] w-full min-w-[max-content] left-0 ${dropdownPosition === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}`}
          >
            <div className={`bg-chalk/98 backdrop-blur-xl border border-ink/5 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden ${dropdownClassName}`}>
              <ul
                ref={listboxRef}
                role="listbox"
                aria-activedescendant={focusedIndex >= 0 ? `option-${focusedIndex}` : undefined}
                className="max-h-[300px] overflow-y-auto p-1.5 focus:outline-none no-scrollbar"
                tabIndex={-1}
              >
                {options.length === 0 ? (
                   <li className="px-3.5 py-3 text-sm text-ink/50 text-center font-sans">No options</li>
                ) : options.map((option, index) => {
                  const isSelected = option.value === value;
                  const isFocused = index === focusedIndex;

                  if (option.isGroupHeader) {
                    return (
                      <li
                        key={`group-${option.label}-${index}`}
                        className="px-3.5 py-2 mt-2 first:mt-0 font-sans text-[11px] font-bold text-ink/40 uppercase tracking-wider select-none pointer-events-none"
                      >
                        {option.label}
                      </li>
                    );
                  }

                  return (
                    <li
                      key={option.value}
                      id={`option-${index}`}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onValueChange(option.value);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg cursor-pointer font-sans text-sm transition-colors ${
                        isSelected 
                          ? 'bg-pitch/10 text-pitch font-semibold' 
                          : isFocused 
                            ? 'bg-mist text-ink' 
                            : 'text-ink/80 hover:bg-mist'
                      }`}
                    >
                      <span className="truncate pr-4 pl-2">{option.label}</span>
                      {isSelected && <Check size={14} className="text-pitch flex-shrink-0" />}
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
