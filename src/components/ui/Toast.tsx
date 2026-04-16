"use client";

import React, { useState, useCallback, useEffect } from "react";
import { colors, spacing, transitions } from "@/lib/designSystem";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type: "success" | "error" | "info", duration?: number) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error" | "info" = "info", duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: Toast = { id, message, type, duration };
    setToasts((prev) => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div
      style={{
        position: "fixed",
        bottom: spacing.lg,
        right: spacing.lg,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = React.useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(handleClose, toast.duration);
      return () => clearTimeout(timer);
    }
    return;
  }, [toast.duration, toast.id]);

  const bgColor =
    toast.type === "success"
      ? `${colors.success}15`
      : toast.type === "error"
      ? `${colors.danger}15`
      : `${colors.primary}15`;

  const borderColor =
    toast.type === "success"
      ? colors.success
      : toast.type === "error"
      ? colors.danger
      : colors.primary;

  const textColor =
    toast.type === "success"
      ? "#166534"
      : toast.type === "error"
      ? "#991B1B"
      : "#1F2937";

  const icon =
    toast.type === "success"
      ? "✓"
      : toast.type === "error"
      ? "✕"
      : "ⓘ";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: "8px",
        backgroundColor: bgColor,
        border: `1px solid ${borderColor}30`,
        color: textColor,
        fontSize: "14px",
        fontWeight: "500",
        pointerEvents: "all",
        animation: isExiting ? "slideUp 0.2s ease-out reverse" : "slideUp 0.3s ease-out",
        opacity: isExiting ? 0 : 1,
        transition: `opacity ${transitions.fast}`,
        minWidth: "300px",
        maxWidth: "400px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
      }}
    >
      <span style={{ fontSize: "16px", fontWeight: "700" }}>{icon}</span>
      <div style={{ flex: 1 }}>{toast.message}</div>
      <button
        onClick={handleClose}
        style={{
          background: "none",
          border: "none",
          color: textColor,
          cursor: "pointer",
          fontSize: "16px",
          opacity: 0.6,
          transition: `opacity ${transitions.fast}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "0.6";
        }}
      >
        ✕
      </button>
    </div>
  );
};
