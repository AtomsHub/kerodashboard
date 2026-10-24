'use client';

// src/components/ui/app-modal.tsx
// The one modal shape for the admin: single column, no header icon, a title
// and a one-line description, scrollable body, actions in the footer.
// Optional `steps` turns a long form into a short multi-step flow.

import React from 'react';
import { Modal } from '@heroui/react';

export interface AppModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** sm ≈ 420px (confirmations), md ≈ 520px (forms), lg ≈ 640px */
  size?: 'sm' | 'md' | 'lg';
  /** Shows "Step x of y" with progress bars above the title. */
  step?: { current: number; total: number };
  footer?: React.ReactNode;
  children?: React.ReactNode;
  /** Render body + footer inside a <form>. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
}

const WIDTH = { sm: 'max-w-[420px]', md: 'max-w-[520px]', lg: 'max-w-[640px]' } as const;

export function AppModal({
  isOpen,
  onOpenChange,
  title,
  description,
  size = 'md',
  step,
  footer,
  children,
  onSubmit,
}: AppModalProps) {
  const content = (
    <>
      {children && <div className="flex flex-col gap-4 overflow-y-auto px-7 py-5">{children}</div>}
      {footer && <div className="flex items-center justify-end gap-2 px-7 pb-7 pt-2">{footer}</div>}
    </>
  );

  return (
    <Modal>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
        <Modal.Container placement="center" size={size === 'lg' ? 'lg' : 'md'}>
          <Modal.Dialog className={`flex max-h-[88vh] w-full flex-col rounded-3xl bg-overlay p-0 ${WIDTH[size]}`}>
            <Modal.Header className="flex flex-col items-start gap-0 px-7 pb-0 pt-7">
              {step && (
                <div className="mb-4 flex w-full items-center gap-3">
                  <div className="flex flex-1 gap-1.5">
                    {Array.from({ length: step.total }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < step.current ? 'bg-secondary' : 'bg-default'}`}
                      />
                    ))}
                  </div>
                  <span className="tabular shrink-0 text-xs text-muted">
                    Step {step.current} of {step.total}
                  </span>
                </div>
              )}
              <Modal.Heading className="text-[18px] font-bold tracking-[-0.02em] text-foreground">{title}</Modal.Heading>
              {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
            </Modal.Header>

            {onSubmit ? (
              <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
                {content}
              </form>
            ) : (
              content
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
