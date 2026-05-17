import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Persistent theme storage check
    const stored = localStorage.getItem('erp-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'system'; // Default to System Theme Mode out-of-the-box
  });

  const [systemIsDark, setSystemIsDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Monitor dynamic OS preference changes reactively
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      setSystemIsDark(e.matches);
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  // Derived state value that is fully reactive to theme state and OS switches
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemIsDark);

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Smooth transition class to prevent flashes
    root.classList.add('theme-transitioning');
    
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    localStorage.setItem('erp-theme', theme);

    // Release transition constraints
    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 150);

    return () => clearTimeout(timer);
  }, [theme, isDarkMode]);

  const toggleTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider wrapper.');
  }
  return context;
}
