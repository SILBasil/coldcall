import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomSelect = ({ 
  value, 
  onChange, 
  options = [], 
  className = '', 
  placeholder = 'เลือก...', 
  disabled = false,
  dropdownClassName = '',
  dropdownZIndex = 50,
  containerClassName = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val) => {
    if (disabled) return;
    onChange({ target: { value: val } });
    setIsOpen(false);
  };

  // Find selected option
  const selectedOption = options.find(opt => 
    typeof opt === 'object' && opt !== null ? opt.value === value : opt === value
  );
  
  const displayLabel = selectedOption !== undefined
    ? (typeof selectedOption === 'object' && selectedOption !== null ? selectedOption.label : selectedOption)
    : placeholder;
    
  const displayColorClass = (selectedOption && typeof selectedOption === 'object')
    ? selectedOption.color || ''
    : '';

  // Determine sizing:
  // - If containerClassName specifies a width (w-56, w-60 etc.), use that width and don't add w-full
  // - Otherwise fill the parent block (w-full)
  const hasWidth = containerClassName && containerClassName.includes('w-');
  const widthClass = hasWidth ? '' : 'w-full';

  return (
    // Outer div: locks the width — block (not inline-block) so it never sizes to content.
    // NO overflow-hidden here so the dropdown panel (absolute) can overflow.
    <div className={`relative ${widthClass} ${containerClassName} min-w-[200px] font-sans`}>
      {/* Inner wrapper with ref — this is what we track for click-outside */}
      <div ref={containerRef} className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          className={`w-full flex items-center pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-700 hover:bg-slate-100 transition-all outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 disabled:opacity-50 disabled:cursor-not-allowed select-none text-left relative shadow-sm overflow-hidden ${displayColorClass} ${className}`}
        >
          {/* Text fills the button but is clipped to the button width */}
          <span className="block truncate w-full pr-2">{displayLabel}</span>
          <ChevronDown 
            size={14} 
            className={`absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>

        {isOpen && (
          <div
            role="listbox"
            className={`absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1.5 animate-in fade-in slide-in-from-top-1 duration-150 ${dropdownClassName}`}
            style={{ zIndex: dropdownZIndex }}
          >
            {options.length === 0 ? (
              <div className="px-4 py-2 text-xs font-medium text-slate-400 text-center">ไม่มีตัวเลือก</div>
            ) : (
              options.map((opt, index) => {
                const optValue = typeof opt === 'object' && opt !== null ? opt.value : opt;
                const optLabel = typeof opt === 'object' && opt !== null ? opt.label : opt;
                const optColor = typeof opt === 'object' && opt !== null ? opt.color : '';
                const isSelected = optValue === value;
                
                return (
                  <button
                    key={index}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(optValue)}
                    className={`w-full text-left px-4 py-2 text-xs font-semibold transition-all hover:bg-slate-50 flex items-center justify-between ${optColor} ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-900 font-bold'
                        : 'text-slate-700'
                    }`}
                  >
                    <span className="truncate">{optLabel}</span>
                    {isSelected && <span className="text-indigo-700 font-bold shrink-0">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomSelect;
