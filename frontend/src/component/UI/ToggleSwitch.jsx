import React from "react";

const ToggleSwitch = ({ checked = false, onChange, disabled = false }) => {
  return (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="peer sr-only"
      />

      <span className="h-6 w-11 rounded-full bg-surface-container-highest transition-colors peer-checked:bg-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-60" />

      <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
    </label>
  );
};

export default ToggleSwitch;
