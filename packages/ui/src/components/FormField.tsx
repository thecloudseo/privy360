import {
  useId,
  type FormHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

type FieldFrame = {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
};

function useFieldIds(id: string | undefined, hint?: string, error?: string) {
  const generated = useId();
  const fieldId = id ?? generated;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return { fieldId, hintId, errorId, describedBy };
}

function FieldMessages({
  hint,
  hintId,
  error,
  errorId,
}: {
  hint?: string | undefined;
  hintId?: string | undefined;
  error?: string | undefined;
  errorId?: string | undefined;
}) {
  return (
    <>
      {hint ? (
        <p id={hintId} className="p360-field__hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="p360-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean | undefined;
}) {
  return (
    <label htmlFor={htmlFor} className="p360-field__label">
      {label}
      {required ? (
        <span aria-hidden="true" className="p360-field__required">
          {" *"}
        </span>
      ) : null}
    </label>
  );
}

export type TextFieldProps = FieldFrame &
  Omit<InputHTMLAttributes<HTMLInputElement>, "required"> & {
    id?: string;
  };

export function TextField({
  label,
  hint,
  error,
  required,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const { fieldId, hintId, errorId, describedBy } = useFieldIds(
    id,
    hint,
    error,
  );
  const classes = ["p360-input", className].filter(Boolean).join(" ");
  return (
    <div className="p360-field">
      <FieldLabel htmlFor={fieldId} label={label} required={required} />
      <input
        {...rest}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={classes}
      />
      <FieldMessages
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
      />
    </div>
  );
}

export type SelectFieldProps = FieldFrame &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, "required"> & {
    id?: string;
    children: ReactNode;
  };

export function SelectField({
  label,
  hint,
  error,
  required,
  id,
  className,
  children,
  ...rest
}: SelectFieldProps) {
  const { fieldId, hintId, errorId, describedBy } = useFieldIds(
    id,
    hint,
    error,
  );
  const classes = ["p360-input", "p360-select", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="p360-field">
      <FieldLabel htmlFor={fieldId} label={label} required={required} />
      <select
        {...rest}
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={classes}
      >
        {children}
      </select>
      <FieldMessages
        hint={hint}
        hintId={hintId}
        error={error}
        errorId={errorId}
      />
    </div>
  );
}

export type FormProps = FormHTMLAttributes<HTMLFormElement> & {
  busy?: boolean;
};

/**
 * Form wrapper. Validation is performed by the caller (and mirrored from the
 * server contract), so native constraint UI is suppressed with noValidate.
 */
export function Form({
  busy = false,
  className,
  children,
  ...rest
}: FormProps) {
  const classes = ["p360-form", className].filter(Boolean).join(" ");
  return (
    <form
      {...rest}
      noValidate
      aria-busy={busy || undefined}
      className={classes}
    >
      {children}
    </form>
  );
}
