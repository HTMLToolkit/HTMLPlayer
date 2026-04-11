import React from "react";
import { Slot } from "@radix-ui/react-slot";
import styles from "./Button.module.css";

type ButtonVariant =
  | "primary"
  | "outline"
  | "ghost"
  | "link"
  | "secondary"
  | "destructive";

type ButtonSize =
  | "sm"
  | "md"
  | "lg"
  | "icon"
  | "icon-sm"
  | "icon-md"
  | "icon-lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const {
      children,
      variant = "primary",
      size = "md",
      asChild = false,
      className = "",
      disabled,
      type = "button",
      ...restProps
    } = props;

    const Component = asChild ? Slot : "button";

    const classNames = [
      styles.button,
      styles[variant],
      styles[size],
      disabled && styles.disabled,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        ref={ref}
        type={type}
        className={classNames}
        disabled={disabled}
        {...restProps}
      >
        {children}
      </Component>
    );
  },
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
