import { CommandGroup, CommandItem, CommandList } from "./Command";
import { Command as CommandPrimitive } from "cmdk";
import {
  useState,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Popover, PopoverContent, PopoverTrigger } from "./Popover";

import { Skeleton } from "./Skeleton";
import styles from "./AutoComplete.module.css";

export type Option<T = unknown> = {
  value: string;
  label: ReactNode;
  displayText?: string;
  metadata?: T;
};

const getDisplayText = <T,>(option: Option<T>): string => {
  if (option.displayText) {
    return option.displayText;
  }
  if (typeof option.label === "string") {
    return option.label;
  }
  return option.value;
};

type AutoCompleteProps<T = unknown> = {
  options: Option<T>[];
  emptyMessage: string;
  value?: Option<T>;
  onValueChange?: (value: Option<T>) => void;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  // when this is false, only values in the options will be accepted
  allowFreeForm?: boolean;
};

export const AutoComplete = <T = unknown,>({
  options,
  placeholder,
  emptyMessage,
  value,
  onValueChange,
  inputValue,
  onInputValueChange,
  disabled,
  isLoading = false,
  allowFreeForm = false,
}: AutoCompleteProps<T>) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option<T> | undefined>(value);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const input = inputRef.current;
      if (!input) {
        return;
      }

      // This is not a default behaviour of the <input /> field
      if (event.key === "Enter" && input.value !== "") {
        const optionToSelect = options.find(
          (option) => getDisplayText(option) === input.value,
        );
        if (optionToSelect) {
          setSelected(optionToSelect);
          onValueChange?.(optionToSelect);
        }
      }

      if (event.key === "Escape") {
        input.blur();
        setOpen(false);
      }
    },
    [options, onValueChange],
  );

  const handleBlur = useCallback(() => {
    // Only reset the input value if the popover is closed and not in free-form mode
    // This prevents interference with the selection process
    if (!isOpen && !allowFreeForm) {
      onInputValueChange(selected ? getDisplayText(selected) : "");
    }
  }, [selected, isOpen, onInputValueChange, allowFreeForm]);

  const handleSelectOption = useCallback(
    (selectedOption: Option<T>) => {
      onInputValueChange(getDisplayText(selectedOption));

      setSelected(selectedOption);
      onValueChange?.(selectedOption);

      // Close the popover after selection
      setOpen(false);

      // This is a hack to prevent the input from being focused after the user selects an option
      // We can call this hack: "The next tick"
      setTimeout(() => {
        inputRef?.current?.blur();
      }, 0);
    },
    [onValueChange, onInputValueChange],
  );

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <CommandPrimitive
        onKeyDown={handleKeyDown}
        className={styles.autoComplete}
      >
        <div className={styles.inputWrapper}>
          <PopoverTrigger asChild>
            <CommandPrimitive.Input
              ref={inputRef}
              value={inputValue}
              onValueChange={isLoading ? undefined : onInputValueChange}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              className={styles.customInput}
            />
          </PopoverTrigger>
        </div>
        {!!options.length && (
          <PopoverContent
            removeBackgroundAndPadding
            className={styles.popoverContent}
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <CommandList className={styles.commandList}>
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => {
                    return (
                      <CommandItem
                        key={option.value}
                        value={getDisplayText(option)}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onSelect={() => handleSelectOption(option)}
                      >
                        {option.label}
                      </CommandItem>
                    );
                    {
                      isLoading ? (
                        <CommandPrimitive.Loading>
                          <div className={styles.loadingContainer}>
                            <Skeleton style={{ height: "2rem" }} />
                          </div>
                        </CommandPrimitive.Loading>
                      ) : null;
                    }
                  })}
                </CommandGroup>
              )}
            </CommandList>
          </PopoverContent>
        )}
      </CommandPrimitive>
    </Popover>
  );
};
