'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DemoContextType {
  isDemo: boolean;
  enableDemo: () => void;
  disableDemo: () => void;
}

const DemoContext = createContext<DemoContextType>({ isDemo: false, enableDemo: () => {}, disableDemo: () => {} });

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('helm_demo_mode') === '1';
  });

  const enableDemo = useCallback(() => {
    sessionStorage.setItem('helm_demo_mode', '1');
    setIsDemo(true);
  }, []);

  const disableDemo = useCallback(() => {
    sessionStorage.removeItem('helm_demo_mode');
    setIsDemo(false);
  }, []);

  return <DemoContext.Provider value={{ isDemo, enableDemo, disableDemo }}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  return useContext(DemoContext);
}
