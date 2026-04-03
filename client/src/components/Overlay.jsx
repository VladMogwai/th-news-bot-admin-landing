import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Overlay({ isOpen, onClose, children }) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible]   = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (isOpen) {
      setMounted(true);
      // two rAF so the browser paints the initial state before transitioning
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      // wait for exit transition before unmounting
      timer.current = setTimeout(() => setMounted(false), 300);
    }
    return () => clearTimeout(timer.current);
  }, [isOpen]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`overlay-backdrop${visible ? ' overlay-visible' : ''}`}
      onClick={onClose ?? undefined}
    >
      <div
        className={`overlay-card${visible ? ' overlay-card-visible' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ripple" />
        {children && <span className="overlay-label">{children}</span>}
      </div>
    </div>,
    document.body
  );
}
