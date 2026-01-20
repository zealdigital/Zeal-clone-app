import React, { useState } from 'react';

interface ExpandableNoteProps {
  text?: string;
  maxLength?: number;
  className?: string;
}

const ExpandableNote: React.FC<ExpandableNoteProps> = ({ text, maxLength = 50, className = "" }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return <span className="text-gray-300 italic">No notes</span>;

  // If text is short enough, just show it
  if (text.length <= maxLength) {
      return <span className={`whitespace-pre-wrap break-words ${className}`}>{text}</span>;
  }

  return (
    <div className={`flex flex-col items-start ${className}`}>
      <span className="whitespace-pre-wrap break-words">
        {isExpanded ? text : `${text.substring(0, maxLength)}...`}
      </span>
      <button 
        type="button"
        onClick={(e) => {
            e.preventDefault();
            e.stopPropagation(); // Prevent row click events
            setIsExpanded(!isExpanded);
        }} 
        className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold mt-1 hover:underline focus:outline-none"
      >
        {isExpanded ? 'Show Less' : 'Read More'}
      </button>
    </div>
  );
};

export default ExpandableNote;