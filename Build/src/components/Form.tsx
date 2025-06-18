/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { Dispatch, SetStateAction, useRef, useEffect } from "react";
import { Slot } from "@radix-ui/react-slot";
import { z, ZodError, ZodIssue, ZodIssueCode } from "zod";
import styles from "./Form.module.css";

/**
 * Core function for setting up form with types.
 * Note: do not pass a generic type argument, instead have it inferred from the schema value
 */
export function useForm<T extends z.ZodType<any, any>>({
  defaultValues = {},
  schema,
}: {
  defaultValues?: Partial<z.infer<T>>;
  schema: T;
}): {
  values: z.infer<T>;
  setValues: Dispatch<SetStateAction<z.infer<T>>>;
  errors: FormErrors;
  validateField: (path: string, options?: { shallow?: boolean }) => void;
  validateForm: () => boolean;
  setFieldError: (path: string, errorMessage: string) => void;
  handleSubmit: (
    onSubmit: (data: z.infer<T>) => void,
  ) => (e: React.FormEvent) => void;
} {
  const [values, setValues] = React.useState<Record<string, any>>(
    defaultValues as Record<string, any>,
  );
  const [errors, setErrors] = React.useState<FormErrors>({});

  // Manually set an error for a specific field
  const setFieldError = React.useCallback(
    (path: string, errorMessage: string) => {
      setErrors((prev) => {
        return setValueByPath(prev, path, errorMessage);
      });
    },
    [],
  );

  // Check if an issue is an "extra property" error from strict validation
  const isExtraPropertyError = (issue: ZodIssue): boolean => {
    return issue.code === ZodIssueCode.unrecognized_keys;
  };

  // full form validation
  const validateForm = React.useCallback((): boolean => {
    if (!schema) return true;
    try {
      // Make the schema strict to detect issues of not including all fields in the schema
      makeStrict(schema).parse(values);
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof ZodError) {
        // Separate extra property errors from regular validation errors
        const extraPropertyErrors = err.errors.filter(isExtraPropertyError);
        const validationErrors = err.errors.filter(
          (issue) => !isExtraPropertyError(issue),
        );

        // Extra property errors should be thrown
        if (extraPropertyErrors.length > 0) {
          throw new Error(
            "Extra properties detected in form values:" +
              extraPropertyErrors.map((e) => e.message).join(", ") +
              ". Either update the schema or remove these values",
          );
        }

        // Only add regular validation errors to the form state
        const tree: any = {};
        validationErrors.forEach((issue: ZodIssue) => {
          const path = issue.path.join(".");
          // Ensure error message is a string
          const errorMessage =
            typeof issue.message === "string"
              ? issue.message
              : String(issue.message);
          // build nested tree
          Object.assign(tree, {}); // ensure tree is an object
          const tmp = setValueByPath(tree, path, errorMessage);
          Object.assign(tree, tmp);
        });
        setErrors(tree);

        // If there are only extra property errors but no validation errors,
        // throw the error instead of showing it in the form
        if (validationErrors.length === 0 && extraPropertyErrors.length > 0) {
          throw new Error(
            `Form contains extra properties: ${extraPropertyErrors
              .map((e) => e.message)
              .join(", ")}`,
          );
        }
      }
      return false;
    }
  }, [schema, values]);

  // single-field (path) validation
  const validateField = React.useCallback(
    (path: string, options?: { shallow?: boolean }) => {
      if (!schema) return;
      const result = schema.safeParse(values);
      setErrors((prev: FormErrors) => {
        let next = { ...prev };

        // For shallow validation, only clear the exact path error
        // For regular validation, clear all errors at/under this path
        if (options?.shallow) {
          // Only delete the specific error at this path, preserving children
          if (getValueByPath(next, path) !== undefined) {
            next = deleteValueByPath(next, path, { shallow: true });
          }
        } else {
          // Clear all errors at/under this path
          next = deleteValueByPath(next, path);
        }

        if (!result.success) {
          // put back just the validation issues for this segment
          result.error.errors.forEach((issue) => {
            const ip = issue.path.join(".");

            // For shallow validation, only include errors for the exact path
            // For regular validation, include errors for the path and its children
            const shouldIncludeError = options?.shallow
              ? ip === path
              : ip === path || ip.startsWith(path + ".");

            if (shouldIncludeError) {
              // Ensure error message is a string
              const errorMessage =
                typeof issue.message === "string"
                  ? issue.message
                  : String(issue.message);
              next = setValueByPath(next, ip, errorMessage);
            }
          });
        }
        return next;
      });
    },
    [schema, values],
  );

  // submit handler
  type Data = z.infer<T>;
  const handleSubmit = React.useCallback(
    (onSubmit: (data: Data) => void) => {
      return (e: React.FormEvent) => {
        e.preventDefault();
        if (validateForm()) {
          onSubmit(values as Data);
        }
      };
    },
    [validateForm, values],
  );

  const oldValueRef = useRef(values);
  useEffect(() => {
    const diffKeys: string[] = [];
    for (const key of Object.keys(values)) {
      if (
        values[key] !== oldValueRef.current[key] &&
        Array.isArray(values[key]) &&
        Array.isArray(oldValueRef.current[key]) &&
        values[key].length !== oldValueRef.current[key].length
      ) {
        diffKeys.push(key);
      }
    }
    oldValueRef.current = values;
    for (const k of diffKeys) {
      // Use shallow validation for array length changes
      validateField(k, { shallow: true });
    }
  }, [values, validateField]);

  return {
    values,
    errors,
    setValues,
    validateField,
    validateForm,
    setFieldError,
    handleSubmit,
  };
}

/**
 * Form contexts provider. Pass the result of useForm as ...props to this.
 */
export function Form<T>(
  props: {
    children: React.ReactNode;
  } & FormContextValue<T>,
) {
  const {
    children,
    values,
    errors,
    setValues,
    validateField,
    validateForm,
    setFieldError,
  } = props;
  return (
    <FormContext.Provider
      value={{
        values,
        errors,
        setValues,
        validateField,
        validateForm,
        setFieldError,
      }}
    >
      {children}
    </FormContext.Provider>
  );
}

/**
 * A wrapper around each form field. The name for nested field should be dot separated.
 */
export const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { name: string }
>(({ name, className, ...props }, ref) => {
  const id = React.useId();
  return (
    <FormItemContext.Provider value={{ id, name }}>
      <div
        ref={ref}
        className={`${styles.formItem} ${className || ""}`}
        {...props}
      />
    </FormItemContext.Provider>
  );
});
FormItem.displayName = "FormItem";

/**
 * A label for a form field. Should be inside FormItem.
 */
export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  const { formItemId, error } = useFormField();
  return (
    <label
      ref={ref}
      className={`${styles.formLabel} ${error ? styles.error : ""} ${className || ""}`}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

/**
 * Wraps around a form control to provide better accessibility. Should be inside FormItem.
 */
export const FormControl = React.forwardRef<
  any,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ className, ...props }, ref) => {
  const { formItemId, error, formMessageId, onBlur } = useFormField();
  return (
    <Slot
      ref={ref}
      id={formItemId}
      className={`${styles.formControl} ${error ? styles.error : ""} ${className || ""}`}
      aria-invalid={!!error}
      aria-describedby={error ? formMessageId : undefined}
      onBlur={onBlur}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

/**
 * Provides form description with accessibility and styling. Should be inside FormItem.
 */
export const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={`${styles.formDescription} ${className || ""}`}
      {...props}
    />
  );
});
FormDescription.displayName = "FormDescription";

/**
 * Provides form error message with accessibility and styling. Should be inside FormItem.
 */
export const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { formMessageId, error } = useFormField();
  const body = error ? error.message : children;
  if (!body) return null;
  return (
    <p
      ref={ref}
      id={formMessageId}
      className={`${styles.formMessage} ${className || ""}`}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = "FormMessage";

// Internal contexts that should not be exposed

// a nested tree to handle nested forms
type FormErrors = {
  [key: string]: string | FormErrors;
};

type FormContextValue<T> = {
  values: T;
  errors: FormErrors;
  setValues: React.Dispatch<React.SetStateAction<T>>;
  validateField: (path: string, options?: { shallow?: boolean }) => void;
  validateForm: () => boolean;
  setFieldError: (path: string, errorMessage: string) => void;
};

const FormContext = React.createContext<FormContextValue<any> | undefined>(
  undefined,
);

function useFormContext(): FormContextValue<any> {
  const ctx = React.useContext(FormContext);
  if (!ctx) throw new Error("useFormContext must be inside <Form>");
  return ctx;
}

type FieldCtx = { id: string; name: string };
const FormItemContext = React.createContext<FieldCtx | null>(null);

function useFormField() {
  const form = useFormContext();
  const ctx = React.useContext(FormItemContext);
  if (!ctx)
    throw new Error(
      "<FormLabel> and <FormControl> must live inside <FormItem>",
    );

  const { id, name } = ctx;
  const errorValue = getValueByPath(form.errors, name);
  // Ensure error message is a string
  const errorMsg = typeof errorValue === "string" ? errorValue : undefined;
  return {
    id,
    name,
    error: errorMsg ? { message: errorMsg } : undefined,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    onBlur: () => form.validateField(name),
    validateShallow: () => form.validateField(name, { shallow: true }),
  };
}

// Internal helpers. Should not be used externally since these aren't typed.

function getValueByPath(obj: any, path: string): any {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    if (/^\d+$/.test(key) && Array.isArray(current)) {
      current = current[+key];
    } else {
      current = current[key];
    }
  }
  return current;
}

function setValueByPath(obj: any, path: string, value: any): any {
  const keys = path.split(".");
  const lastKey = keys.pop()!;
  const newObj = { ...obj };
  let pointer = newObj;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];
    if (pointer[key] == null) {
      pointer[key] = /^\d+$/.test(nextKey) ? [] : {};
    } else if (Array.isArray(pointer[key])) {
      pointer[key] = [...pointer[key]];
    } else if (typeof pointer[key] === "object") {
      pointer[key] = { ...pointer[key] };
    }
    pointer = pointer[key];
  }

  // set final
  if (/^\d+$/.test(lastKey) && Array.isArray(pointer)) {
    pointer[+lastKey] = value;
  } else {
    pointer[lastKey] = value;
  }

  return newObj;
}

// DELETE helper — remove a path (and clean up empty containers)
function deleteValueByPath(
  obj: any,
  path: string,
  options?: { shallow?: boolean },
): any {
  const keys = path.split(".");
  const last = keys.pop()!;
  let pointer = obj;
  const parents: Array<{ parent: any; key: string }> = [];

  for (const key of keys) {
    if (pointer[key] == null) {
      return obj; // nothing to remove
    }
    parents.push({ parent: pointer, key });
    pointer = pointer[key];
  }

  // remove the leaf
  if (pointer && typeof pointer === "object" && last in pointer) {
    if (options?.shallow) {
      // For shallow deletion, just remove the specific error message
      // but preserve any nested errors
      if (typeof pointer[last] === "string") {
        delete pointer[last];
      } else if (
        typeof pointer[last] === "object" &&
        !Array.isArray(pointer[last])
      ) {
        // If it's an object but not an array, we need to keep its children
        // but remove any direct error on this path
        if ("message" in pointer[last]) {
          delete pointer[last].message;
        }
      }
    } else {
      // For deep deletion, remove the entire path and its children
      delete pointer[last];
    }
  }

  // Only prune empty containers if we're not in shallow mode
  if (!options?.shallow) {
    // climb back and prune empty objects/arrays
    for (let i = parents.length - 1; i >= 0; i--) {
      const { parent, key } = parents[i];
      const val = parent[key];
      const isEmptyObj =
        val && !Array.isArray(val) && Object.keys(val).length === 0;
      const isEmptyArr = Array.isArray(val) && val.length === 0;
      if (isEmptyObj || isEmptyArr) {
        delete parent[key];
      }
    }
  }

  return obj;
}

function makeStrict(schema: z.ZodSchema) {
  if (schema instanceof z.ZodObject) {
    return schema.strict();
  }
  return schema;
}
