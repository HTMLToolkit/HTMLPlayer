import { InputHTMLAttributes, forwardRef, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import styles from "./Checkbox.module.css";
import { Icon } from "../shared/Icon";
import { prefersReducedMotion } from "../../../helpers/reducedMotion";

gsap.registerPlugin(useGSAP);

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const setRefs = (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
    };

    useGSAP(
      () => {
        const input = inputRef.current;
        const isChecked = checked ?? input?.checked;
        if (!input || !isChecked || prefersReducedMotion()) return;
        gsap.fromTo(
          input,
          { scale: 0.9 },
          { scale: 1, duration: 0.25, ease: "back.out(2.5)" },
        );
      },
      { dependencies: [checked], scope: inputRef },
    );

    return (
      <div className={styles.checkboxWrapper}>
        <input
          {...props}
          type="checkbox"
          checked={checked}
          ref={setRefs}
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
  },
);

Checkbox.displayName = "Checkbox";
