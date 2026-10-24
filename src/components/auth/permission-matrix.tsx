'use client';

// src/components/auth/permission-matrix.tsx
// Compact permission picker: one column of collapsible groups. Each group has
// a tri-state checkbox beside its title (click to select / clear the group);
// expanding it shows a plain checklist of permissions.

import React, { useMemo, useState } from 'react';
import { CaretDown, Check, MagnifyingGlass, Minus, WarningCircle, X } from '@phosphor-icons/react';
import { Permission } from '@/types/admin';
import { PERMISSION_GROUPS, type PermissionDomainGroup } from '@/lib/permissions-catalog';
import { AppInput } from '@/components/ui/app-input';

export interface PermissionMatrixProps {
  /** Currently granted permissions */
  value?: Permission[];
  /** Called with the full next selection */
  onChange?: (permissions: Permission[]) => void;
  /** Informational only — no toggling */
  readOnly?: boolean;
  /** Already granted elsewhere (e.g. by the staff member's role): shown on, can't be toggled. */
  locked?: Permission[];
  /** Tag shown beside locked permissions. */
  lockedLabel?: string;
  className?: string;
}

type CheckState = 'on' | 'off' | 'some';

function CheckBox({
  state,
  disabled,
  onToggle,
  label,
}: {
  state: CheckState;
  disabled?: boolean;
  onToggle?: () => void;
  label: string;
}) {
  const filled = state !== 'off';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={state === 'some' ? 'mixed' : state === 'on'}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle?.();
      }}
      className={`grid size-5 shrink-0 place-items-center rounded-md transition-colors ${
        filled ? 'bg-secondary text-secondary-foreground' : 'bg-surface text-transparent ring-1 ring-inset ring-field-border hover:ring-muted'
      } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {state === 'some' ? <Minus size={12} weight="bold" /> : <Check size={12} weight="bold" />}
    </button>
  );
}

export function PermissionMatrix({
  value = [],
  onChange,
  readOnly = false,
  locked = [],
  lockedLabel = 'Role',
  className = '',
}: PermissionMatrixProps) {
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const lockedSet = useMemo(() => new Set<Permission>(locked), [locked]);
  const selected = useMemo(() => new Set<Permission>([...locked, ...value]), [locked, value]);
  const editable = !readOnly && Boolean(onChange);
  const query = search.trim().toLowerCase();

  const groups = useMemo(() => {
    return PERMISSION_GROUPS.map((group) => ({
      ...group,
      permissions: query
        ? group.permissions.filter(
            (p) => p.label.toLowerCase().includes(query) || p.key.toLowerCase().includes(query),
          )
        : group.permissions,
    })).filter((g) => g.permissions.length > 0) as PermissionDomainGroup[];
  }, [query]);

  const toggleOne = (key: Permission) => {
    if (!editable || lockedSet.has(key)) return;
    const next = new Set(value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange?.(Array.from(next));
  };

  const toggleGroup = (group: PermissionDomainGroup, state: CheckState) => {
    if (!editable) return;
    const next = new Set(value);
    const select = state !== 'on';
    group.permissions
      .filter((p) => !lockedSet.has(p.key))
      .forEach((p) => (select ? next.add(p.key) : next.delete(p.key)));
    onChange?.(Array.from(next));
  };

  const toggleOpen = (id: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <AppInput
            size="sm"
            placeholder="Search permissions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startContent={<MagnifyingGlass />}
            endContent={
              search ? (
                <button type="button" onClick={() => setSearch('')} className="cursor-pointer text-muted hover:text-foreground">
                  <X size={14} />
                </button>
              ) : null
            }
          />
        </div>
        <span className="tabular shrink-0 text-[13px] text-muted">{selected.size} selected</span>
      </div>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted">No permissions match “{search}”.</p>
      ) : (
        <ul className="rounded-2xl bg-surface-secondary p-1.5">
          {groups.map((group) => {
            const count = group.permissions.filter((p) => selected.has(p.key)).length;
            const state: CheckState = count === 0 ? 'off' : count === group.permissions.length ? 'on' : 'some';
            const isOpen = Boolean(query) || openGroups.has(group.id);

            return (
              <li key={group.id} className="rounded-xl">
                <div
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
                  onClick={() => toggleOpen(group.id)}
                >
                  <CheckBox
                    state={state}
                    disabled={!editable}
                    label={`Select all ${group.title}`}
                    onToggle={() => toggleGroup(group, state)}
                  />
                  <span className="flex-1 text-[14px] font-medium text-foreground">{group.title}</span>
                  <CaretDown
                    size={14}
                    className={`text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </div>

                {isOpen && (
                  <ul className="pb-2 pl-11 pr-3">
                    {group.permissions.map((perm) => {
                      const on = selected.has(perm.key);
                      const isLocked = lockedSet.has(perm.key);
                      return (
                        <li key={perm.key}>
                          <label
                            className={`flex items-center gap-3 rounded-lg py-1.5 text-[13px] ${
                              editable && !isLocked ? 'cursor-pointer' : 'cursor-default'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              toggleOne(perm.key);
                            }}
                          >
                            <CheckBox
                              state={on ? 'on' : 'off'}
                              disabled={!editable || isLocked}
                              label={perm.label}
                              onToggle={() => toggleOne(perm.key)}
                            />
                            <span className={on ? 'text-foreground' : 'text-muted'}>{perm.label}</span>
                            {isLocked && (
                              <span className="rounded-md bg-default px-1.5 py-0.5 text-[11px] text-muted">{lockedLabel}</span>
                            )}
                            {perm.isDangerous && (
                              <WarningCircle size={14} weight="fill" className="text-danger" aria-label="Sensitive" />
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
