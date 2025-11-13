import React, {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import styles from "./PersistentDropdownMenu.module.css";

interface CustomDropdownMenuProps {
  children: React.ReactNode;
  trigger: React.ReactNode;
  onClose: () => void;
  enableRightClick?: boolean;
}

export interface PersistentDropdownMenuRef {
  close: () => void;
}

const PersistentDropdownMenu = forwardRef<
  PersistentDropdownMenuRef,
  CustomDropdownMenuProps
>(({ children, trigger, onClose, enableRightClick = false }, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    onClose();
  };

  // Expose close method to parent components
  useImperativeHandle(ref, () => ({
    close: closeDropdown,
  }));

  // Handle right-click to open menu
  const handleContextMenu = (e: React.MouseEvent) => {
    if (enableRightClick) {
      e.preventDefault();
      e.stopPropagation();
      setIsOpen(true);
    }
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
    <div
      className={styles.persistentDropdown}
      ref={dropdownRef}
      onContextMenu={handleContextMenu}
    >
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
});

export default PersistentDropdownMenu;
