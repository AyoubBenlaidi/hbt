// Animation utilities for micro-interactions
import { CSSProperties } from "react";

export const animations = {
  // Keyframe animations
  ripple: `
    @keyframes ripple {
      0% {
        transform: scale(0);
        opacity: 1;
      }
      100% {
        transform: scale(4);
        opacity: 0;
      }
    }
  `,

  shake: `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }
  `,

  slideUp: `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,

  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `,

  fadeIn: `
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `,

  scaleIn: `
    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  `,

  // Utility styles
  errorShake: {
    animation: "shake 0.4s ease-in-out",
  } as CSSProperties,

  successPulse: {
    animation: "pulse 0.6s ease-in-out",
  } as CSSProperties,

  slideUpAnimation: {
    animation: "slideUp 0.3s ease-out",
  } as CSSProperties,

  fadeInAnimation: {
    animation: "fadeIn 0.3s ease-out",
  } as CSSProperties,

  scaleInAnimation: {
    animation: "scaleIn 0.3s ease-out",
  } as CSSProperties,

  loadingPulse: {
    animation: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  } as CSSProperties,
};

// Ripple effect hook utilities
export const createRipple = (event: React.MouseEvent<HTMLElement>) => {
  const button = event.currentTarget;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const ripple = document.createElement("span");
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = x + "px";
  ripple.style.top = y + "px";
  ripple.className = "ripple";

  button.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
};

// Toast notification types
export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
}

// Success/error animations for expense creation
export const successAnimation = (element: HTMLElement) => {
  element.style.animation = "none";
  setTimeout(() => {
    element.style.animation = "scaleIn 0.3s ease-out";
  }, 10);
};
