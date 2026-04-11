import { forwardRef, InputHTMLAttributes } from "react";
import { Icon } from "../shared/Icon";
import styles from "./SearchInput.module.css";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ icon = "search", className, ...props }, ref) => {
    return (
      <div className={`${styles.wrapper} search-wrapper`}>
        <Icon name={icon} size={16} className={`${styles.icon} search-icon`} decorative />
        <input
          ref={ref}
          type="text"
          className={`${styles.input} search-input ${className || ""}`}
          {...props}
        />
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";
