import { useCallback, useLayoutEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

export function useElementSize<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  size: ElementSize;
} {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 });
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!node) return;

    const measure = (): void => {
      const rect = node.getBoundingClientRect();
      setSize((current) =>
        Math.abs(current.width - rect.width) < 1 &&
        Math.abs(current.height - rect.height) < 1
          ? current
          : { width: rect.width, height: rect.height },
      );
    };

    measure();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  useLayoutEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  return { ref, size };
}
