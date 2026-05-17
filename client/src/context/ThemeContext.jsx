import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // Persistent theme storage check
    const stored = localStorage.getItem('erp-theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
    return 'light'; // Default Light Mode
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Smooth transition control class addition (preventing visual layout shift or transition flashing on initial load)
    root.classList.add('theme-transitioning');
    
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else if (theme === 'light') {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      } else if (theme === 'system') {
        const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemIsDark) {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }
      }
    };

    applyTheme();
    localStorage.setItem('erp-theme', theme);

    // Timeout to release transition limit
    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 150);

    // Dynamic OS preference listener
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = () => {
        applyTheme();
      };
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
        clearTimeout(timer);
      };
    }

    return () => clearTimeout(timer);
  }, [theme]);

  const toggleTheme = (newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      setTheme(newTheme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
