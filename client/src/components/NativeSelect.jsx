import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * NativeSelect — A 100% custom styled simulated select dropdown component.
 *
 * Replaces standard HTML native <select> elements which suffer from rendering
 * glitches (white blank screens or non-clickable choices) inside Android Capacitor WebViews.
 * Compatible with standard React onChange handles.
 */
export default function NativeSelect({
  name,
  value,
  onChange,
  className = '',
  disabled = false,
  placeholder = 'Select option',
  children
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  // Parse children options dynamically
  const options = [];
  React.Children.forEach(children, (child) => {
    if (!child) return;
    if (child.type === 'option') {
      options.push({
        value: child.props.value !== undefined ? child.props.value : child.props.children,
        label: child.props.children || child.props.value || '',
        disabled: child.props.disabled || false
      });
    } else if (child.props && child.props.children) {
      React.Children.forEach(child.props.children, (nestedChild) => {
        if (nestedChild && nestedChild.type === 'option') {
          options.push({
            value: nestedChild.props.value !== undefined ? nestedChild.props.value : nestedChild.props.children,
            label: nestedChild.props.children || nestedChild.props.value || '',
            disabled: nestedChild.props.disabled || false
          });
        }
      });
    }
  });

  // Identify active selection
  const activeOption = options.find((opt) => String(opt.value) === String(value));
  const activeLabel = activeOption ? activeOption.label : (placeholder || (options[0]?.label || ''));

  const handleSelect = (val) => {
    if (disabled) return;
    if (onChange) {
      onChange({
        target: { name, value: val },
        currentTarget: { name, value: val }
      });
    }
    setOpen(false);
  };

  const defaultClass =
    'w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-950 font-bold text-xs text-slate-800 dark:text-zinc-100 flex items-center justify-between gap-2 cursor-pointer';

  const triggerClass = className || defaultClass;

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${triggerClass} flex items-center justify-between gap-2 select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="truncate">{activeLabel}</span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown Panel overlay */}
      {open && (
        <div className="absolute z-50 mt-2 left-0 right-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-xl max-h-60 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {options.length === 0 ? (
            <div className="p-3 text-xs text-slate-400 text-center italic">No options available</div>
          ) : (
            options.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={String(opt.value)}
                  onClick={() => !opt.disabled && handleSelect(opt.value)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition select-none ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer'
                  }`}
                >
                  {opt.label}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
