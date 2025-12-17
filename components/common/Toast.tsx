import React, { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  icon?: string;
  onDismiss: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  icon,
  onDismiss,
  duration = 4000,
}) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, duration - 300); // Start exit animation 300ms before dismissal

    const dismissTimer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [duration, onDismiss]);

  return (
    <div
      className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 bg-gray-900 text-white rounded-full shadow-lg flex items-center gap-2 transition-all duration-300 ${
        isExiting ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0 animate-slide-up'
      }`}
    >
      {icon && <span className="text-xl">{icon}</span>}
      <span className="font-medium">{message}</span>

      {/* CSS for slide-up animation */}
      <style>{`
        @keyframes slideUp {
          0% { transform: translateX(-50%) translateY(100%); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Toast;
