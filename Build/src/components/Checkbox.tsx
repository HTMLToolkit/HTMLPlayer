import { InputHTMLAttributes, forwardRef } from "react";
import styles from "./Checkbox.module.css";
import { Icon } from "./Icon";
export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={styles.checkboxWrapper}>
        <input
          {...props}
          type="checkbox"
          ref={ref}
          className={`${styles.checkbox} ${className || ""}`}
        />
        <Icon
          name="check"
          className={styles.checkmark}
          size="1rem"
          decorative
        />
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";
