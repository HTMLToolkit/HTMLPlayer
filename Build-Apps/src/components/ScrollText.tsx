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
  ...rest
}: ScrollTextProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const [shouldScroll, setShouldScroll] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(minDuration);

  const safeText = useMemo(() => (allowHTML ? DOMPurify.sanitize(text) : text), [text, allowHTML]);

  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const inner = innerRef.current;
    if (!wrapper || !inner) return;

    const base = inner.querySelector("[data-scroll-text='primary']") as HTMLElement | null;
    if (!base) return;

    const contentWidth = base.scrollWidth;
    const wrapperWidth = wrapper.clientWidth;

    if (contentWidth > wrapperWidth + 1) {
      const loopDistance = contentWidth + gap;
      const derivedDuration = Math.max(minDuration, loopDistance / speed);
      setShouldScroll(true);
      setDistance(loopDistance);
      setDuration(derivedDuration);
    } else {
      setShouldScroll(false);
      setDistance(contentWidth);
      setDuration(minDuration);
    }
  }, [gap, minDuration, speed]);

  useLayoutEffect(() => {
    measure();
  }, [measure, safeText]);

  useEffect(() => {
    if (!wrapperRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(wrapperRef.current);

    return () => observer.disconnect();
  }, [measure]);

  useEffect(() => {
    if (!innerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(() => measure());
    observer.observe(innerRef.current);

    return () => observer.disconnect();
  }, [measure]);

  const wrapperClasses = [styles.wrapper, pauseOnHover && shouldScroll ? styles.pauseOnHover : "", className]
    .filter(Boolean)
    .join(" ");

  const innerClasses = [styles.inner, textClassName, shouldScroll ? styles.scrolling : ""]
    .filter(Boolean)
    .join(" ");

  const combinedTextStyle = {
    ...(shouldScroll
      ? {
          "--scroll-distance": `${distance}px`,
          "--scroll-duration": `${duration}s`,
          "--scroll-gap": `${gap}px`,
        }
      : {}),
    ...textStyle,
  } as CSSProperties;

  const primarySpanProps = allowHTML
    ? { dangerouslySetInnerHTML: { __html: safeText } }
    : { children: text };

  return (
    <div ref={wrapperRef} className={wrapperClasses} {...rest}>
      <div ref={innerRef} className={innerClasses} style={combinedTextStyle}>
        <span className={styles.text} data-scroll-text="primary" {...primarySpanProps} />
        {shouldScroll && (
          <span
            className={styles.text}
            data-scroll-text="clone"
            aria-hidden="true"
            {...primarySpanProps}
          />
        )}
      </div>
    </div>
  );
};
