import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useIconRegistry } from "../helpers/iconLoader";
import type { IconLookupOptions, ResolvedIcon } from "../types/icons";

interface IconFallbackState {
  isLoading: boolean;
  error: string | null;
}

export type IconFallback = React.ReactNode | ((state: IconFallbackState) => React.ReactNode);

export interface IconProps {
  name: string;
  setId?: string;
  fallback?: IconFallback;
  fallbackOrder?: string[];
  className?: string;
  style?: React.CSSProperties;
  size?: number | string;
  color?: string;
  stroke?: string;
  strokeWidth?: number;
  fill?: string;
  inline?: boolean;
  decorative?: boolean;
  alt?: string;
  title?: string;
  role?: string;
  onClick?: React.MouseEventHandler<any>;
  onMouseEnter?: React.MouseEventHandler<any>;
  onMouseLeave?: React.MouseEventHandler<any>;
  onFocus?: React.FocusEventHandler<any>;
  onBlur?: React.FocusEventHandler<any>;
}

const renderFallback = (fallback: IconFallback | undefined, state: IconFallbackState) => {
  if (typeof fallback === "function") {
    return fallback(state);
  }
  return fallback ?? null;
};

export const Icon: React.FC<IconProps> = ({
  name,
  setId,
  fallback,
  fallbackOrder,
  className,
  style,
  size = 20,
  color,
  stroke,
  strokeWidth,
  fill,
  inline = false,
  decorative = false,
  alt,
  title,
  role,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
}) => {
  const { t } = useTranslation();
  const { loadIcon } = useIconRegistry();
  const [resolvedIcon, setResolvedIcon] = useState<ResolvedIcon | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const dimensionStyle = useMemo(() => {
    if (size === undefined) return {};
    return {
      width: size,
      height: size,
    } as React.CSSProperties;
  }, [size]);

  useEffect(() => {
    let cancelled = false;

    const fetchIcon = async () => {
      if (!name) {
        setResolvedIcon(null);
        setIsLoading(false);
        setError(t('icon.nameNotProvided'));
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const options: IconLookupOptions | undefined = (() => {
          const hasSet = Boolean(setId);
          const hasFallbacks = Boolean(fallbackOrder && fallbackOrder.length > 0);
          if (!hasSet && !hasFallbacks) {
            return undefined;
          }
          const opts: IconLookupOptions = {};
          if (hasSet && setId) {
            opts.setId = setId;
          }
          if (hasFallbacks) {
            opts.fallbackOrder = fallbackOrder;
          }
          return opts;
        })();

        const icon = await loadIcon(name, options);
        if (cancelled) return;
        setResolvedIcon(icon);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : t('icon.failedToLoad');
        setError(message);
        setResolvedIcon(null);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchIcon();

    return () => {
      cancelled = true;
    };
  }, [name, setId, fallbackOrder, loadIcon]);

  const ariaProps = useMemo(() => {
    if (decorative) {
      return {
        role: role ?? "presentation",
        "aria-hidden": "true" as const,
        "aria-label": undefined,
      };
    }

    return {
      role: role ?? "img",
      "aria-hidden": undefined,
      "aria-label": alt ?? title ?? name,
    };
  }, [alt, decorative, name, role, title]);

  if (isLoading) {
    return renderFallback(fallback, { isLoading: true, error: null });
  }

  if (error || !resolvedIcon) {
    return renderFallback(fallback, { isLoading: false, error: error ?? t('icon.notFound') });
  }

  switch (resolvedIcon.type) {
    case "component": {
          const { Component, defaultProps, propTransformer } = resolvedIcon;

          // Apply prop transformer if available
          const transformedProps = propTransformer
            ? propTransformer({
                size,
                color,
                stroke,
                strokeWidth,
                fill,
                className,
                style,
              })
            : {};

          // Build props object with proper typing
          const componentProps: Record<string, any> = {
            className,
            style: {
              display: inline ? "inline-flex" : "inline-flex",
              verticalAlign: inline ? "middle" : "middle",
              // Only apply dimensionStyle if no prop transformer (library doesn't handle sizing)
              ...(propTransformer ? {} : dimensionStyle),
              ...style,
            },
            ...ariaProps,
            ...(defaultProps as Record<string, unknown>),
            ...transformedProps, // Apply transformed props
          };

          // Add optional props only if defined and not already handled by transformer
          if (!propTransformer) {
            if (size !== undefined) componentProps.size = size;
            if (color !== undefined) componentProps.color = color;
            if (stroke !== undefined) componentProps.stroke = stroke;
            if (strokeWidth !== undefined) componentProps.strokeWidth = strokeWidth;
            if (fill !== undefined) componentProps.fill = fill;
          }
          
          // Always add event handlers
          if (onClick) componentProps.onClick = onClick;
          if (onMouseEnter) componentProps.onMouseEnter = onMouseEnter;
          if (onMouseLeave) componentProps.onMouseLeave = onMouseLeave;
          if (onFocus) componentProps.onFocus = onFocus;
          if (onBlur) componentProps.onBlur = onBlur;

          return <Component {...componentProps} />;
    }
    case "image": {
      return (
        <img
          className={className}
          style={{ display: inline ? "inline-block" : "block", ...dimensionStyle, ...style }}
          src={resolvedIcon.src}
          alt={decorative ? "" : alt ?? resolvedIcon.alt ?? name}
          title={title ?? resolvedIcon.title ?? undefined}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocus={onFocus}
          onBlur={onBlur}
          {...ariaProps}
        />
      );
    }
    case "svg-inline": {
      return (
        <span
          className={className}
          style={{ display: inline ? "inline-block" : "block", ...dimensionStyle, ...style }}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onFocus={onFocus}
          onBlur={onBlur}
          title={title ?? resolvedIcon.title ?? undefined}
          {...ariaProps}
          dangerouslySetInnerHTML={{ __html: resolvedIcon.content }}
        />
      );
    }
    default:
      return renderFallback(fallback, { isLoading: false, error: t('icon.unsupportedType') });
  }
};

export default Icon;
