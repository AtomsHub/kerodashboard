'use client';

// src/components/layout/command-menu.tsx
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlass,
  SquaresFour,
  Broadcast,
  Path,
  SteeringWheel,
  Siren,
  Wallet,
  ShieldCheck,
  UserCircle,
  ArrowUpRight,
  type Icon as PhosphorIcon,
} from '@phosphor-icons/react';
import { Modal, Kbd } from '@heroui/react';

const commands: { label: string; description: string; href: string; icon: PhosphorIcon }[] = [
  { label: 'Go to overview', description: 'Platform health and daily performance', href: '/', icon: SquaresFour },
  { label: 'Open live operations', description: 'Monitor trips and available drivers', href: '/live-watch', icon: Broadcast },
  { label: 'Review trips & dispatch', description: 'Manage active and completed rides', href: '/trips', icon: Path },
  { label: 'Review drivers', description: 'Driver management and verification', href: '/drivers', icon: SteeringWheel },
  { label: 'Open safety center', description: 'SOS alerts and incident response', href: '/emergency', icon: Siren },
  { label: 'Open finance', description: 'Transactions, wallets, and settlements', href: '/finance', icon: Wallet },
  { label: 'Roles & staff', description: 'Permissions and team access', href: '/roles', icon: ShieldCheck },
  { label: 'My account', description: 'Profile and change password', href: '/account', icon: UserCircle },
];

export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      commands.filter((item) =>
        `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const choose = (href: string) => {
    router.push(href);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-full max-w-[420px] cursor-pointer items-center gap-2.5 rounded-full bg-surface px-4 text-left text-[13px] text-field-placeholder transition-colors hover:bg-surface-secondary md:flex"
      >
        <MagnifyingGlass size={18} className="text-muted" />
        <span className="flex-1 truncate">Search trips, drivers, riders…</span>
        <Kbd className="text-[11px]">
          <Kbd.Abbr keyValue="ctrl" />
          <Kbd.Content>K</Kbd.Content>
        </Kbd>
      </button>

      <Modal isOpen={open} onOpenChange={setOpen}>
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="overflow-hidden rounded-3xl bg-overlay p-0">
              <div className="flex items-center gap-3 border-b border-separator px-5">
                <MagnifyingGlass size={20} className="text-muted" />
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && visible[0]) choose(visible[0].href);
                  }}
                  placeholder="Type a command or search…"
                  aria-label="Search commands"
                  className="h-14 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-field-placeholder"
                />
                <Kbd className="text-[11px]">
                  <Kbd.Content>Esc</Kbd.Content>
                </Kbd>
              </div>

              <div className="max-h-[420px] overflow-y-auto p-2">
                <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                  Navigate
                </p>
                {visible.length ? (
                  visible.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        type="button"
                        key={item.href}
                        onClick={() => choose(item.href)}
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-surface-secondary"
                      >
                        <span className="grid size-10 place-items-center rounded-xl bg-default text-foreground">
                          <ItemIcon size={20} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-[14px] font-medium text-foreground">{item.label}</span>
                          <span className="block text-xs text-muted">{item.description}</span>
                        </span>
                        <ArrowUpRight size={16} className="text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                      </button>
                    );
                  })
                ) : (
                  <p className="px-3 py-10 text-center text-[13px] text-muted">No commands found.</p>
                )}
              </div>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
