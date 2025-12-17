import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ConnectionErrorModalProps {
  error: string;
  onRetry: () => void;
  onLeave: () => void;
  retryLabel?: string;
  leaveLabel?: string;
}

export const ConnectionErrorModal: React.FC<ConnectionErrorModalProps> = ({
  error,
  onRetry,
  onLeave,
  retryLabel = 'Try Again',
  leaveLabel = 'Back to Menu',
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
        <div className="text-red-500 mb-4">
          <AlertCircle size={48} className="mx-auto" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">Connection Error</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <div className="flex gap-3">
          <button
            onClick={onLeave}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all"
          >
            {leaveLabel}
          </button>
          <button
            onClick={onRetry}
            className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-semibold transition-all"
          >
            {retryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionErrorModal;
