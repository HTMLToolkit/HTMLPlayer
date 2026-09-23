import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type TouchEvent,
  type RefObject,
} from "react";

interface UseDragControlResult {
  ref: RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  handleClick: (e: MouseEvent<HTMLDivElement>) => void;
  handleMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
  handleTouchStart: (e: TouchEvent<HTMLDivElement>) => void;
}

export function useDragControl(
  onMove: (fraction: number) => void,
): UseDragControlResult {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  });

  const updatePosition = useCallback((clientX: number) => {
    const track = ref.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const fraction = rect.width
      ? Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      : 0;
    onMoveRef.current(fraction);
  }, []);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      updatePosition(e.clientX);
    },
    [isDragging, updatePosition],
  );

  const handleMouseDown = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      setIsDragging(true);
      updatePosition(e.clientX);
    },
    [updatePosition],
  );

  const handleTouchStart = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const touch = e.touches[0];
      if (!touch) return;
      setIsDragging(true);
      updatePosition(touch.clientX);
    },
    [updatePosition],
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) =>
      updatePosition(e.clientX);
    const handleTouchMove = (e: globalThis.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      updatePosition(touch.clientX);
    };
    const handleMouseUp = () => setIsDragging(false);
    const handleTouchEnd = () => setIsDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, updatePosition]);

  return { ref, isDragging, handleClick, handleMouseDown, handleTouchStart };
}