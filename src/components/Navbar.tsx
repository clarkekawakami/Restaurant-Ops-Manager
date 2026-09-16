import React, { useEffect, useState } from 'react';
import {
  UtensilsCrossed,
  Receipt,
  BookOpen,
  Boxes,
  Users,
  CalendarDays,
  AlertTriangle,
  Clock,
  CircleDot,
} from 'lucide-react';
import { DashboardStats } from '../types.ts';

export type ActiveModule = 'orders' | 'menu' | 'inventory' | 'staff' | 'reservations';

interface NavbarProps {
  activeModule: ActiveModule;
  onSelectModule?: (module: ActiveModule) => void;
  onModuleChange?: (module: ActiveModule) => void;
  staffList?: any[];
  stats: (DashboardStats & { lowStockCount?: number }) | null;
  onOpenQuickClockIn?: () => void;
  onQuickClockIn?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  onSelectModule,
  onModuleChange,
  stats,
  onOpenQuickClockIn,
  onQuickClockIn,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  const handleSelect = (module: ActiveModule) => {
    if (onSelectModule) onSelectModule(module);
    if (onModuleChange) onModuleChange(module);
  };

  const handleClockIn = () => {
    if (onOpenQuickClockIn) onOpenQuickClockIn();
    if (onQuickClockIn) onQuickClockIn();
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    {
      id: 'orders' as ActiveModule,
      label: 'Orders & POS',
      icon: Receipt,
      badge: stats?.openOrdersCount ? `${stats.openOrdersCount} open` : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'menu' as ActiveModule,
      label: 'Menu Items',
      icon: BookOpen,
    },
    {
      id: 'inventory' as ActiveModule,
      label: 'Inventory',
      icon: Boxes,
      badge: stats?.lowStockCount ? `${stats.lowStockCount} low` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'staff' as ActiveModule,
      label: 'Staff & Payroll',
      icon: Users,
      badge: stats?.activeStaffCount ? `${stats.activeStaffCount} on duty` : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'reservations' as ActiveModule,
      label: 'Reservations',
      icon: CalendarDays,
      badge: stats?.todayReservationsCount ? `${stats.todayReservationsCount} today` : undefined,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <UtensilsCrossed className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-bold tracking-tight text-slate-900">
                  The Rustic Bistro
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 border border-slate-200">
                  SQLite POS
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">Operations & Payroll Manager</p>
            </div>
          </div>

          {/* Quick Status Bar & Clock */}
          <div className="hidden lg:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono font-medium">{timeStr}</span>
            </div>

            {stats && (
              <div className="flex items-center gap-3 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-semibold">Today's Sales:</span>
                  <span className="font-mono font-bold">${stats.todaySales.toFixed(2)}</span>
                </div>
                <span className="text-emerald-300">|</span>
                <span className="text-emerald-700">Tips: ${stats.todayTipsTotal.toFixed(2)}</span>
              </div>
            )}

            <button
              id="btn-quick-clock"
              onClick={handleClockIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer shadow-2xs"
            >
              <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
              Staff Clock-In / PIN
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none border-t border-slate-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      isActive ? 'bg-slate-800 text-amber-300 border-slate-700' : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
