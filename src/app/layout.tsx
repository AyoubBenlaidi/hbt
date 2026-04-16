import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { animations } from "@/lib/animations";

export const metadata: Metadata = {
  title: "Home Budget Tracker",
  description: "Manage shared household expenses",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          ${animations.ripple}
          ${animations.shake}
          ${animations.slideUp}
          ${animations.pulse}
          ${animations.fadeIn}
          ${animations.scaleIn}

          .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
          }

          * {
            box-sizing: border-box;
          }
        `}</style>
      </head>
      <body>
        <ToastProvider>
          <div className="min-h-screen">
            {children}
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
