import React, { useState, useRef, useEffect } from "react";
import { Button } from "./Button";
import styles from "./PersistentDropdownMenu.module.css";

interface CustomDropdownMenuProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  onClose: () => void;
}

const PersistentDropdownMenu: React.FC<CustomDropdownMenuProps> = ({
  children,
  trigger,
  onClose,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  // Close the dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        // setIsOpen(false);
        // onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [children, toggleOpen, onClose]);

  return (
    <div className={styles.persistentDropdown} ref={dropdownRef}>
      <div
        onClick={() => {
          toggleOpen();
        }}
      >
        {trigger}
      </div>
      {isOpen && <div className={styles.content}>{children}</div>}
    </div>
  );
};

export default PersistentDropdownMenu;
