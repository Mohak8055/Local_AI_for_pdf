// frontend/src/components/LanguagePopover.jsx

import React from 'react';

function LanguagePopover({ isOpen, onSelectLanguage }) {
  if (!isOpen) {
    return null;
  }

  const handleSelect = (language) => {
    onSelectLanguage(language);
  };

  return (
    <div className="language-popover">
      <div className="flex justify-around">
        <button onClick={() => handleSelect('indian')} className="popover-option">
          Indian
        </button>
        <button onClick={() => handleSelect('foreign')} className="popover-option">
          Foreign
        </button>
      </div>
    </div>
  );
}

export default LanguagePopover;