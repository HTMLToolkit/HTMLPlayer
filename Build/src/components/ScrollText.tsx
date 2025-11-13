import {
  useMemo,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
  useEffect,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import styles from "./ScrollText.module.css";

interface ScrollTextProps extends HTMLAttributes<HTMLDivElement> {
  text: string;
  textClassName?: string;
  textStyle?: CSSProperties;
  speed?: number;
  gap?: number;
  minDuration?: number;
  pauseOnHover?: boolean;
  allowHTML?: boolean;
  containerClassName?: string;
  wrapperStyle?: CSSProperties;
}

export const ScrollText = ({
  text,
  className,
  textClassName,
  textStyle,
  speed = 30,
  gap = 24,
  minDuration = 10,
  pauseOnHover = true,
  allowHTML = true,
  containerClassName,
  wrapperStyle,
  ...rest
}: ScrollTextProps) => {
  const { t } = useTranslation();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const rafRef = useRef<number | null>(null);

  // Combined state for better performance
  const [scrollState, setScrollState] = useState({
    shouldScroll: false,
    distance: 0,
    duration: minDuration,
  });

  const safeText = useMemo(
    () => (allowHTML ? DOMPurify.sanitize(text) : text),
    [text, allowHTML],
  );

  // Memoize the span props to avoid recreating on every render
  const spanProps = useMemo(() => {
    const baseProps = {
      className: styles.text,
      style: scrollState.shouldScroll ? { marginRight: `${gap}px` } : undefined,
    };

    return allowHTML
      ? { ...baseProps, dangerouslySetInnerHTML: { __html: safeText } }
      : { ...baseProps, children: text };
  }, [allowHTML, safeText, text, gap, scrollState.shouldScroll]);

  // Optimized measure function with debouncing
  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const base = inner.querySelector(
      "[data-scroll-text='primary']",
    ) as HTMLElement | null;
    if (!base) return;

    const contentWidth = base.scrollWidth;
    const wrapperWidth = wrapper.clientWidth;

    if (wrapperWidth <= 0) {
      if (typeof window !== "undefined") {
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        rafRef.current = window.requestAnimationFrame(() => {
          rafRef.current = null;
          measure();
        });
      }
      return;
    }

    const overflow = contentWidth - wrapperWidth;
    const startThreshold = 14;
    const stopThreshold = 6;

    setScrollState((prev) => {
      const shouldScroll = prev.shouldScroll
        ? overflow > stopThreshold
        : overflow > startThreshold;

      if (shouldScroll) {
        const loopDistance = contentWidth + gap;
        const derivedDuration = Math.max(minDuration, loopDistance / speed);

        if (
          prev.shouldScroll &&
          Math.abs(prev.distance - loopDistance) < 1 &&
          Math.abs(prev.duration - derivedDuration) < 0.1
        ) {
          return prev;
        }

        return {
          shouldScroll: true,
          distance: loopDistance,
          duration: derivedDuration,
        };
      }

      if (!prev.shouldScroll && Math.abs(prev.distance - contentWidth) < 1) {
        return prev;
      }

      return {
        shouldScroll: false,
        distance: contentWidth,
        duration: minDuration,
      };
    });
  }, [gap, minDuration, speed]);

  // Initialize resize observer once
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;

    resizeObserverRef.current = new ResizeObserver(() => measure());

    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, [measure]);

  // Observe both elements with the same observer
  useLayoutEffect(() => {
    if (!resizeObserverRef.current) return;

    const wrapper = wrapperRef.current;
    const inner = innerRef.current;

    if (wrapper) resizeObserverRef.current.observe(wrapper);
    if (inner) resizeObserverRef.current.observe(inner);
    measure();

    return () => {
      if (wrapper) resizeObserverRef.current?.unobserve(wrapper);
      if (inner) resizeObserverRef.current?.unobserve(inner);
    };
  }, [measure, safeText]);

  useEffect(() => {
    return () => {
      if (rafRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Memoize class names to avoid recalculating on every render
  const wrapperClasses = useMemo(
    () =>
      [
        styles.wrapper,
        pauseOnHover && scrollState.shouldScroll ? styles.pauseOnHover : "",
        className,
        containerClassName,
      ]
        .filter(Boolean)
        .join(" "),
    [className, containerClassName, pauseOnHover, scrollState.shouldScroll],
  );

  const innerClasses = useMemo(
    () =>
      [
        styles.inner,
        textClassName,
        scrollState.shouldScroll ? styles.scrolling : "",
      ]
        .filter(Boolean)
        .join(" "),
    [textClassName, scrollState.shouldScroll],
  );

  // Memoize combined text style
  const combinedTextStyle = useMemo(
    () =>
      ({
        ...(scrollState.shouldScroll
          ? {
              "--scroll-distance": `${scrollState.distance}px`,
              "--scroll-duration": `${scrollState.duration}s`,
              "--scroll-gap": `${gap}px`,
            }
          : {}),
        ...textStyle,
      }) as CSSProperties,
    [scrollState, gap, textStyle],
  );

  return (
    <div
      ref={wrapperRef}
      className={wrapperClasses}
      style={wrapperStyle}
      role="region"
      aria-label={t("accessibility.scrollingText")}
      {...rest}
    >
      <div ref={innerRef} className={innerClasses} style={combinedTextStyle}>
        <span data-scroll-text="primary" {...spanProps} />
        {scrollState.shouldScroll && (
          <span data-scroll-text="clone" aria-hidden="true" {...spanProps} />
        )}
      </div>
    </div>
  );
};
