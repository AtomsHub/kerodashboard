'use client';

// src/components/ui/app-select.tsx
// Standardized reusable Select component built on HeroUI Select compound components.
import React from 'react';
import { Select, Label, ListBox } from '@heroui/react';

export interface AppSelectOption {
  key: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface AppSelectProps {
  label?: string;
  placeholder?: string;
  options: AppSelectOption[];
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  className?: string;
  triggerClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  isDisabled?: boolean;
  isRequired?: boolean;
  error?: string;
  description?: string;
  name?: string;
  id?: string;
  'aria-label'?: string;
}

export function AppSelect({
  label,
  placeholder = 'Select option...',
  options,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  className = '',
  triggerClassName = '',
  size = 'md',
  isDisabled,
  isRequired,
  error,
  description,
  name,
  id,
  'aria-label': ariaLabel,
}: AppSelectProps) {
  const heightClass =
    size === 'sm'
      ? 'h-8 text-xs py-1 px-2.5'
      : size === 'lg'
        ? 'h-12 text-sm px-4'
        : 'h-10 text-xs px-3';

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <Label className="text-[13px] font-medium text-foreground">{label}</Label>}
      <Select
        selectedKey={selectedKey !== undefined ? selectedKey : undefined}
        defaultSelectedKey={defaultSelectedKey !== undefined ? defaultSelectedKey : undefined}
        onSelectionChange={(key) => {
          if (key !== null && key !== undefined && onSelectionChange) {
            onSelectionChange(String(key));
          }
        }}
        placeholder={placeholder}
        isDisabled={isDisabled}
        isRequired={isRequired}
        aria-label={ariaLabel || label || placeholder}
        name={name}
        id={id}
        className="w-full"
      >
        <Select.Trigger
          className={`flex w-full items-center justify-between gap-2 rounded-xl border border-field-border bg-field text-foreground outline-none transition-colors hover:border-field-border-hover focus:border-accent cursor-pointer shadow-none ${heightClass} ${triggerClassName}`}
        >
          <Select.Value className="text-xs truncate font-medium text-foreground" />
          <Select.Indicator className="text-muted shrink-0" />
        </Select.Trigger>
        <Select.Popover className="min-w-[180px] max-h-72 overflow-y-auto rounded-2xl border border-border bg-overlay p-1 shadow-2xl backdrop-blur-xl z-50">
          <ListBox className="outline-none space-y-0.5">
            {options.map((opt) => (
              <ListBox.Item
                key={opt.key}
                id={opt.key}
                textValue={opt.label}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium text-foreground cursor-pointer transition-colors hover:bg-surface focus:bg-surface outline-none"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {opt.icon}
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.description && (
                      <span className="text-[10px] text-muted truncate">{opt.description}</span>
                    )}
                  </div>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      {error && <p className="text-[11px] font-medium text-danger">{error}</p>}
      {description && !error && <p className="text-[11px] text-muted">{description}</p>}
    </div>
  );
}
