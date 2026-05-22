/**
 * NativeSelect — Android-safe custom dropdown component
 *
 * Wraps a native <select> in a styled container so it renders
 * correctly inside Capacitor's Android WebView without triggering
 * broken OS-level styling (white bg, invisible text).
 */
import { useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export default function NativeSelect({
  children,
  value,
  onChange,
  name,
  required = false,
  disabled = false,
  className = '',
  id,
  ...rest
}) {
  const selectRef = useRef(null);

  const defaultClass =
    'w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none';

  return (
    <div className="relative w-full">
      <select
        ref={selectRef}
        value={value}
        onChange={onChange}
        name={name}
        required={required}
        disabled={disabled}
        id={id}
        className={`appearance-none pr-8 ${className || defaultClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ colorScheme: 'light', backgroundColor: 'white', color: '#1e293b' }}
        {...rest}
      >
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
        <ChevronDown size={14} className="text-slate-400" />
      </div>
    </div>
  );
}
