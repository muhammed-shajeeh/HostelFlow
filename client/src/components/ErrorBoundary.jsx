import React from 'react';
import { ShieldAlert, RefreshCw, LogOut, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-150 font-sans transition-colors duration-150">
          <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 md:p-8 shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Header Shield Alert Icon */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/20 flex items-center justify-center text-rose-500 shadow-inner">
              <ShieldAlert size={36} className="animate-bounce" />
            </div>

            {/* Error Message & Details */}
            <div className="space-y-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                HostelFlow Crash Recovered
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                An unexpected runtime component exception occurred. Our fail-safe boundary successfully intercepted the failure to preserve your active operational session.
              </p>
            </div>

            {/* Collapsible details panel */}
            <div className="bg-slate-50 dark:bg-zinc-950 p-4 rounded-2xl border border-slate-100 dark:border-zinc-850 text-left">
              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-zinc-500">
                Diagnostic Signature
              </p>
              <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
                {this.state.error?.toString() || 'Unknown Runtime Exception'}
              </p>
            </div>

            {/* Recovery Actions */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 active:scale-[0.98] transition-all text-xs flex justify-center items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <RefreshCw size={14} />
                Reload Portal
              </button>

              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-350 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all text-xs flex justify-center items-center gap-1.5 cursor-pointer"
              >
                <LogOut size={14} className="text-rose-500" />
                Sign Out & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
