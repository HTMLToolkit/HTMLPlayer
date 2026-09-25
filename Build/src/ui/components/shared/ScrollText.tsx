import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
} from "react";
import Marquee from "react-fast-marquee";
import DOMPurify from "dompurify";
import { useTranslation } from "react-i18next";
import styles from "./ScrollText.module.css";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";

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

const OVERFLOW_START_THRESHOLD = 14;
const OVERFLOW_STOP_THRESHOLD = 6;

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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [scrollState, setScrollState] = useState({
    shouldScroll: false,
    contentWidth: 0,
  });

  const safeText = useMemo(
    () => (allowHTML ? DOMPurify.sanitize(text) : text),
    [text, allowHTML],
  );

  const measure = useCallback(() => {
    const wrapper = wrapperRef.current;
    const span = wrapper?.querySelector(
      "[data-scroll-text]",
    ) as HTMLElement | null;
    if (!wrapper || !span) return;

    const viewport = wrapper.clientWidth;
    if (viewport <= 0) {
      setScrollState({ shouldScroll: false, contentWidth: 0 });
      return;
    }

    const contentWidth = span.scrollWidth;
    const overflow = contentWidth - viewport;

    setScrollState((prev) => ({
      shouldScroll: prev.shouldScroll
        ? overflow > OVERFLOW_STOP_THRESHOLD
        : overflow > OVERFLOW_START_THRESHOLD,
      contentWidth,
    }));
  }, []);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    if (typeof ResizeObserver === "undefined") {
      measure();
      return;
    }

    resizeObserverRef.current = new ResizeObserver(() => measure());
    resizeObserverRef.current.observe(wrapper);
    measure();

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [measure, safeText]);

  const wrapperClasses = useMemo(
    () =>
      [styles.wrapper, className, containerClassName].filter(Boolean).join(" "),
    [className, containerClassName],
  );

  const innerClasses = useMemo(
    () => [styles.inner, textClassName].filter(Boolean).join(" "),
    [textClassName],
  );

  const textProps = useMemo(
    () =>
      allowHTML
        ? { dangerouslySetInnerHTML: { __html: safeText } }
        : { children: text },
    [allowHTML, safeText, text],
  );

  const reducedMotion = prefersReducedMotion();
  const shouldScroll = scrollState.shouldScroll && !reducedMotion;

  const copyWidth = scrollState.contentWidth + gap;
  const effectiveSpeed = Math.max(
    1,
    Math.min(speed, copyWidth / Math.max(1, minDuration)),
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
      {shouldScroll ? (
        <Marquee
          className={textClassName}
          style={textStyle}
          speed={effectiveSpeed}
          autoFill
          pauseOnHover={pauseOnHover}
          loop={0}
          gradient={false}
        >
          <span
            data-scroll-text
            className={styles.text}
            style={{ marginRight: `${gap}px` }}
            {...textProps}
          />
        </Marquee>
      ) : (
        <div className={innerClasses} style={textStyle}>
          <span data-scroll-text className={styles.text} {...textProps} />
        </div>
      )}
    </div>
  );
};