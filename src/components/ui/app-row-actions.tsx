'use client';

// src/components/ui/app-row-actions.tsx
// Standardized reusable 3-dots action menu for table rows and cards.
import React from 'react';
import Link from 'next/link';
import { DotsThreeVertical } from '@phosphor-icons/react';
import { Dropdown } from '@heroui/react';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface AppRowActionsProps {
  items: ActionMenuItem[];
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function AppRowActions({
  items,
  ariaLabel = 'Actions',
  className = '',
  size = 'sm',
}: AppRowActionsProps) {
  const visibleItems = items.filter((item) => !item.disabled);
  if (visibleItems.length === 0) return null;

  const sizeClasses = size === 'sm' ? 'size-8' : 'size-9';

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={ariaLabel}
        className={`inline-flex items-center justify-center ${sizeClasses} rounded-xl text-muted hover:bg-field hover:text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      >
        <DotsThreeVertical size={size === 'sm' ? 18 : 20} weight="bold" />
      </Dropdown.Trigger>
      <Dropdown.Popover className="min-w-[170px] rounded-2xl bg-overlay border border-border shadow-2xl p-1 z-50">
        <Dropdown.Menu
          onAction={(key) => {
            const found = visibleItems.find((i) => i.key === key);
            found?.onClick?.();
          }}
          className="outline-none space-y-0.5"
        >
          {visibleItems.map((item) => {
            const content = (
              <div className="flex items-center gap-2">
                {item.icon}
                <span className={item.danger ? 'text-danger font-medium' : ''}>{item.label}</span>
              </div>
            );

            if (item.href) {
              return (
                <Dropdown.Item
                  key={item.key}
                  id={item.key}
                  textValue={item.label}
                  className="rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors hover:bg-surface focus:bg-surface outline-none"
                >
                  <Link href={item.href} className="flex size-full items-center">
                    {content}
                  </Link>
                </Dropdown.Item>
              );
            }

            return (
              <Dropdown.Item
                key={item.key}
                id={item.key}
                textValue={item.label}
                className={`rounded-xl px-2.5 py-1.5 text-xs font-medium cursor-pointer transition-colors hover:bg-surface focus:bg-surface outline-none ${
                  item.danger ? 'text-danger hover:bg-danger-soft focus:bg-danger-soft' : 'text-foreground'
                }`}
              >
                {content}
              </Dropdown.Item>
            );
          })}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
