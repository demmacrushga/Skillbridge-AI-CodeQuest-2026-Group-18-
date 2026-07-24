import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createThemeColors, type ThemeColors } from '@/constants/theme';

const THEME_STORAGE_KEY = '@skillbridge/theme-mode';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDarkMode: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') {
          setModeState(stored);
        }
      } catch {
        // ignore load errors
      } finally {
        setIsLoaded(true);
      }
    }
    loadTheme();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(async () => {
    const next = mode === 'light' ? 'dark' : 'light';
    await setMode(next);
  }, [mode, setMode]);

  const isDarkMode = mode === 'dark';
  const colors = useMemo(() => createThemeColors(isDarkMode), [isDarkMode]);

  const value = useMemo(
    () => ({ mode, isDarkMode, colors, setMode, toggleTheme }),
    [mode, isDarkMode, colors, setMode, toggleTheme]
  );

  if (!isLoaded) {
    // Prevent flash of default light theme while loading
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

/**
 * Helper to create theme-aware StyleSheet objects.
 * Re-computes styles when the theme changes.
 *
 * Example:
 *   const styles = useThemeStyles((colors) => StyleSheet.create({
 *     container: { backgroundColor: colors.surface }
 *   }));
 */
export function useThemeStyles<T>(createStyles: (colors: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}

export { createThemeColors };
export type { ThemeColors };
