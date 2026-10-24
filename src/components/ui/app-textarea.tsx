'use client';

// src/components/ui/app-textarea.tsx
// Web counterpart of textarea field, matching `AppInput` style and Kero tokens.
// Built on HeroUI v3 <TextField>, <Label>, <TextArea>, <Description>, and <FieldError>.

import React, { forwardRef } from 'react';
import {
  TextField,
  Label,
  TextArea,
  FieldError,
  Description,
} from '@heroui/react';

export interface AppTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Optional form field label */
  label?: string;
  /** Helper description below the textarea */
  description?: string;
  /** Error message to display (triggers isInvalid state) */
  errorMessage?: string;
  /** Explicit error/invalid state */
  isInvalid?: boolean;
  /** Marks field as required */
  isRequired?: boolean;
  /** Disables user input */
  isDisabled?: boolean;
  /** Container wrapper class name */
  containerClassName?: string;
}

export const AppTextarea = forwardRef<HTMLTextAreaElement, AppTextareaProps>(
  function AppTextarea(
    {
      label,
      description,
      errorMessage,
      isInvalid,
      isRequired,
      isDisabled,
      containerClassName,
      className,
      rows = 3,
      id,
      name,
      placeholder,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref,
  ) {
    const invalid = Boolean(errorMessage) || isInvalid;

    return (
      <TextField
        isInvalid={invalid}
        isRequired={isRequired}
        isDisabled={isDisabled}
        name={name}
        value={value !== undefined ? String(value) : undefined}
        defaultValue={defaultValue !== undefined ? String(defaultValue) : undefined}
        onChange={(val: string) => {
          if (onChange) {
            onChange({
              target: { value: val, name: name ?? '' },
              currentTarget: { value: val, name: name ?? '' },
            } as unknown as React.ChangeEvent<HTMLTextAreaElement>);
          }
        }}
        aria-label={!label ? (props['aria-label'] || placeholder || 'Textarea') : undefined}
        className={`gap-1.5 w-full ${containerClassName ?? ''}`.trim()}
      >
        {label && (
          <Label className="text-[13px] font-medium text-foreground select-none">
            {label}
          </Label>
        )}

        <TextArea
          {...props}
          ref={ref}
          id={id}
          name={name}
          rows={rows}
          placeholder={placeholder}
          disabled={isDisabled}
          required={isRequired}
          className={`w-full rounded-xl border bg-field text-foreground p-3.5 text-sm placeholder:text-field-placeholder transition-colors outline-none shadow-none resize-y ${
            invalid
              ? 'border-danger ring-1 ring-danger/30'
              : 'border-field-border focus:border-focus focus:ring-1 focus:ring-focus/30'
          } ${isDisabled ? 'opacity-60 cursor-not-allowed bg-disabled' : ''} ${className ?? ''}`}
        />

        {description && !invalid && (
          <Description className="text-xs text-muted mt-1">{description}</Description>
        )}

        {errorMessage && (
          <FieldError className="text-xs text-danger font-medium mt-1 animate-in fade-in duration-200">
            {errorMessage}
          </FieldError>
        )}
      </TextField>
    );
  },
);
