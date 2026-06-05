import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function FloatingTooltip({
  label,
  children,
  placement = "right",
  disabled = false,
  offset = 12,
}) {
  const triggerRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState(null);

  const updatePosition = () => {
    const trigger = triggerRef.current;

    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();

    if (placement === "right") {
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + offset,
        transform: "translateY(-50%)",
      });

      return;
    }

    if (placement === "left") {
      setPosition({
        top: rect.top + rect.height / 2,
        left: rect.left - offset,
        transform: "translate(-100%, -50%)",
      });

      return;
    }

    if (placement === "top") {
      setPosition({
        top: rect.top - offset,
        left: rect.left + rect.width / 2,
        transform: "translate(-50%, -100%)",
      });

      return;
    }

    setPosition({
      top: rect.bottom + offset,
      left: rect.left + rect.width / 2,
      transform: "translateX(-50%)",
    });
  };

  const showTooltip = () => {
    if (disabled || !label) return;

    updatePosition();
    setIsVisible(true);
  };

  const hideTooltip = () => {
    setIsVisible(false);
  };

  useEffect(() => {
    if (!isVisible) return;

    updatePosition();

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isVisible]);

  return (
    <>
      <span
        ref={triggerRef}
        className="block"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </span>

      {isVisible && position
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-9999 whitespace-nowrap rounded-lg bg-on-surface px-3 py-2 text-xs font-bold text-surface-container-lowest"
              style={position}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
