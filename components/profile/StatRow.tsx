import React from 'react';

interface StatRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
}

const StatRow: React.FC<StatRowProps> = ({ label, value, highlight = false }) => {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-600 text-sm">{label}</span>
      <span className={`font-medium ${highlight ? 'text-indigo-600' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
};

export default StatRow;
