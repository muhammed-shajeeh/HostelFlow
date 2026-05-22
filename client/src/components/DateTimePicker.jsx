/**
 * DateTimePicker — Dependency-free custom date/time picker
 *
 * Uses styled native <input type="date"> and <input type="time"> elements
 * wrapped in a custom trigger UI. Works correctly in Android Capacitor
 * WebView without the broken OS native date dialog styling.
 */
import { useState, useRef, useEffect } from 'react';
import { Calendar, Clock, X } from 'lucide-react';

export default function DateTimePicker({
  value,
  onChange,
  name,
  type = 'datetime-local',
  required = false,
  min,
  max,
  className = '',
  placeholder,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [dateVal, setDateVal] = useState('');
  const [timeVal, setTimeVal] = useState('');
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!value) { setDateVal(''); setTimeVal(''); return; }
    if (type === 'date') {
      setDateVal(value.slice(0, 10));
      setTimeVal('');
    } else {
      const parts = value.split('T');
      setDateVal(parts[0] || '');
      setTimeVal(parts[1] ? parts[1].slice(0, 5) : '');
    }
  }, [value, type]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('touchstart', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, []);

  const fireChange = (newDate, newTime) => {
    let formattedValue = '';
    if (type === 'date') {
      formattedValue = newDate;
    } else {
      if (newDate && newTime) formattedValue = `${newDate}T${newTime}`;
      else if (newDate) formattedValue = `${newDate}T00:00`;
    }
    if (onChange) onChange({ target: { name, value: formattedValue }, currentTarget: { name, value: formattedValue } });
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setDateVal(newDate);
    fireChange(newDate, timeVal);
    if (type === 'date') setOpen(false);
  };

  const handleTimeChange = (e) => {
    const newTime = e.target.value;
    setTimeVal(newTime);
    fireChange(dateVal, newTime);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setDateVal(''); setTimeVal('');
    if (onChange) onChange({ target: { name, value: '' }, currentTarget: { name, value: '' } });
  };

  const displayLabel = () => {
    if (!dateVal) return null;
    const d = new Date(dateVal + 'T00:00');
    const dateStr = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    if (type === 'date') return dateStr;
    return timeVal ? `${dateStr}, ${timeVal}` : dateStr;
  };

  const label = displayLabel();
  const defaultClass = 'w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-950 font-bold text-xs text-slate-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';
  const triggerClass = className || defaultClass;

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div
        onClick={() => !disabled && setOpen(v => !v)}
        className={`${triggerClass} flex items-center justify-between gap-2 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={label ? 'text-slate-800 dark:text-zinc-100' : 'text-slate-400 dark:text-zinc-500'}>
          {label || (placeholder || (type === 'date' ? 'Select date' : 'Select date & time'))}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {label && !disabled && (
            <button type="button" onClick={handleClear} className="text-slate-400 hover:text-red-500 transition" tabIndex={-1}>
              <X size={12} />
            </button>
          )}
          <Calendar size={14} className="text-slate-400 dark:text-zinc-500" />
        </div>
      </div>

      <input type="hidden" name={name} value={value || ''} required={required} />

      {open && (
        <div className="absolute z-50 mt-2 left-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl shadow-xl p-4 w-full min-w-[260px] space-y-3">
          <div>
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1.5 tracking-wider">
              <Calendar size={11} /> Date
            </label>
            <input
              type="date" value={dateVal} onChange={handleDateChange}
              min={min ? (type === 'date' ? min : min.split('T')[0]) : undefined}
              max={max ? (type === 'date' ? max : max.split('T')[0]) : undefined}
              className="w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              style={{ colorScheme: 'light' }}
            />
          </div>
          {type === 'datetime-local' && (
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 mb-1.5 tracking-wider">
                <Clock size={11} /> Time
              </label>
              <input
                type="time" value={timeVal} onChange={handleTimeChange}
                className="w-full p-2.5 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-100 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ colorScheme: 'light' }}
              />
            </div>
          )}
          <button type="button" onClick={() => setOpen(false)} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
