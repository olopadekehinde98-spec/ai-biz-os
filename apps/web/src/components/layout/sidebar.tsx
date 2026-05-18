'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, HeadphonesIcon, CheckSquare,
  Share2, BarChart2, FileText, Bell, CreditCard,
  Settings, Zap, ChevronDown, Building2, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBusinessStore } from '@/store/business';
import { Badge } from '@/components/ui/badge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NAV: { href: string; icon: any; label: string; adminOnly?: boolean }[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/leads', icon: Users, label: 'Leads' },
  { href: '/support', icon: HeadphonesIcon, label: 'Support' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/social', icon: Share2, label: 'Social' },
  { href: '/reports', icon: FileText, label: 'Reports' },
  { href: '/analytics', icon: BarChart2, label: 'Analytics' },
  { href: '/approvals', icon: Zap, label: 'Approvals' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/billing', icon: CreditCard, label: 'Billing' },
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/admin', icon: ShieldCheck, label: 'Admin', adminOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { activeBusiness } = useBusinessStore();

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="font-bold text-sm">AI BizOS</span>
      </div>

      {/* Business Selector */}
      <div className="border-b px-3 py-3">
        <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-left font-medium">
            {activeBusiness?.name ?? 'Select business'}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Plan badge */}
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
            {activeBusiness?.name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{activeBusiness?.name ?? 'My Business'}</p>
            <Badge variant="secondary" className="mt-0.5 text-[10px] h-4">Starter</Badge>
          </div>
        </div>
      </div>
    </aside>
  );
}
