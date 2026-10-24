'use client';

// src/components/ui/user-avatar.tsx
// Reusable profile avatar component for drivers, riders, and staff.
// Displays image DP with smooth fallback to styled initials on missing URL or load error.

import React, { useState } from 'react';
import { User as UserIcon } from '@phosphor-icons/react';

export interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  shape?: 'rounded' | 'circle';
}

const SIZE_MAP: Record<string, { container: string; text: string; icon: number }> = {
  xs: { container: 'size-6', text: 'text-[10px]', icon: 12 },
  sm: { container: 'size-8', text: 'text-xs', icon: 16 },
  md: { container: 'size-9', text: 'text-xs', icon: 18 },
  lg: { container: 'size-12', text: 'text-sm', icon: 24 },
  xl: { container: 'size-16 text-base', text: 'text-base', icon: 32 },
};

export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  src,
  name,
  size = 'md',
  className = '',
  shape = 'rounded',
}: UserAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;
  const initials = getInitials(name);
  const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-2xl';

  const hasValidImage = Boolean(src && src.trim() && !imageFailed);

  return (
    <div
      className={`relative grid shrink-0 place-items-center overflow-hidden font-bold select-none border border-border/40 ${
        hasValidImage ? 'bg-default' : 'bg-accent-soft text-accent'
      } ${sizeConfig.container} ${sizeConfig.text} ${roundedClass} ${className}`}
    >
      {hasValidImage ? (
        <img
          src={src!}
          alt={name ?? 'User Avatar'}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <UserIcon size={sizeConfig.icon} weight="bold" />
      )}
    </div>
  );
}
