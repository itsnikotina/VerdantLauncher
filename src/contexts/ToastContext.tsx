import React, { createContext, useContext, useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration: number;
}

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration + 300); // give time for fade out
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [width, setWidth] = useState('100%');
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    let frame: number;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        setWidth('0%');
      });
    });
    
    const hideTimer = setTimeout(() => {
      setOpacity(0);
    }, toast.duration);
    
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(hideTimer);
    }
  }, [toast.duration]);

  return (
    <div 
      className="bg-[#1e1e1e] border border-[#3a3a3a] rounded-sm p-4 w-72 shadow-xl relative overflow-hidden transition-opacity duration-300 pointer-events-auto"
      style={{ opacity }}
    >
      <div className="flex items-center gap-3">
        {toast.type === 'success' && <Icon icon="mdi:check-circle" className="text-[#1db868] w-6 h-6 shrink-0" />}
        {toast.type === 'error' && <Icon icon="mdi:close-circle" className="text-red-500 w-6 h-6 shrink-0" />}
        {toast.type === 'info' && <Icon icon="mdi:information" className="text-[#00a4ef] w-6 h-6 shrink-0" />}
        <p className="text-white font-sans text-sm">{toast.message}</p>
      </div>
      <div 
        className="absolute bottom-0 left-0 h-1 ease-linear" 
        style={{ 
            width: width, 
            transitionProperty: 'width',
            transitionDuration: `${toast.duration}ms`,
            backgroundColor: toast.type === 'success' ? '#1db868' : toast.type === 'error' ? '#ef4444' : '#00a4ef' 
        }} 
      />
    </div>
  );
}

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};
