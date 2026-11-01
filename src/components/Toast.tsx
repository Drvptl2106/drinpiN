// Short messages at the bottom of the screen, optionally with a button like "Undo".
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastOptions {
  action?: { label: string; onClick: () => void };
  duration?: number;
}
interface ToastData extends ToastOptions {
  id: number;
  message: string;
}

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((message: string, options: ToastOptions = {}) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, ...options });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), options.duration ?? 3000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div role="status" aria-live="polite">
        {toast && (
          <div className="toast" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  setToast(null);
                  toast.action!.onClick();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
