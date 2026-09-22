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
  ShieldCheck,
  User,
  Lock,
  Sun,
  Moon,
  Armchair,
  Settings,
} from 'lucide-react';
import { DashboardStats, StaffMember, BusinessProfile } from '../types.ts';
import { useTheme } from '../context/ThemeContext.tsx';
import { RestaurantLogo } from './RestaurantLogo.tsx';

export type ActiveModule = 'orders' | 'menu' | 'inventory' | 'staff' | 'reservations' | 'seating';

interface NavbarProps {
  activeModule: ActiveModule;
  onSelectModule?: (module: ActiveModule) => void;
  onModuleChange?: (module: ActiveModule) => void;
  staffList?: StaffMember[];
  currentUser?: StaffMember | null;
  onOpenSwitchUser?: () => void;
  stats: (DashboardStats & { lowStockCount?: number }) | null;
  onOpenQuickClockIn?: () => void;
  onQuickClockIn?: () => void;
  profile?: BusinessProfile | null;
  onOpenSettings?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeModule,
  onSelectModule,
  onModuleChange,
  currentUser,
  onOpenSwitchUser,
  stats,
  onOpenQuickClockIn,
  onQuickClockIn,
  profile,
  onOpenSettings,
}) => {
  const { isDark, toggleTheme } = useTheme();
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
      adminRequired: false,
      badge: stats?.openOrdersCount ? `${stats.openOrdersCount} open` : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'menu' as ActiveModule,
      label: 'Menu Items',
      icon: BookOpen,
      adminRequired: true,
    },
    {
      id: 'inventory' as ActiveModule,
      label: 'Inventory',
      icon: Boxes,
      adminRequired: true,
      badge: stats?.lowStockCount ? `${stats.lowStockCount} low` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'staff' as ActiveModule,
      label: 'Staff & Payroll',
      icon: Users,
      adminRequired: false,
      badge: stats?.activeStaffCount ? `${stats.activeStaffCount} on duty` : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      id: 'reservations' as ActiveModule,
      label: 'Reservations',
      icon: CalendarDays,
      adminRequired: false,
      badge: stats?.todayReservationsCount ? `${stats.todayReservationsCount} today` : undefined,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    {
      id: 'seating' as ActiveModule,
      label: 'Seating Plan',
      icon: Armchair,
      adminRequired: false,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <RestaurantLogo
              logoUrl={profile?.logo_url}
              logoIcon={profile?.logo_icon || 'utensils'}
              altText={profile?.business_name || 'Restaurant Logo'}
              className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center shadow-xs border border-transparent dark:border-slate-700 overflow-hidden"
              iconClassName="w-5 h-5 text-amber-400"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {profile?.business_name || 'The Rustic Bistro'}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  SQLite POS
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                {profile?.tagline || 'Operations & Payroll Manager'}
              </p>
            </div>
          </div>

          {/* Current User Pill, Theme Toggle & Clock / Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active User Pill */}
            {currentUser && onOpenSwitchUser && (
              <button
                id="btn-current-user-badge"
                onClick={onOpenSwitchUser}
                className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition cursor-pointer text-left shadow-2xs"
                title="Switch active terminal user"
              >
                <div className="w-7 h-7 rounded-lg bg-slate-900 dark:bg-amber-400 dark:text-slate-950 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block leading-tight text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[120px]">
                      {currentUser.name}
                    </span>
                    {currentUser.admin_access ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        <ShieldCheck className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                        Admin
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        Staff
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                    {currentUser.title || currentUser.role} &bull; Switch
                  </div>
                </div>
              </button>
            )}

            {/* Status Bar & Clock */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400" />
                <span className="font-mono font-medium">{timeStr}</span>
              </div>

              {stats && (
                <div className="flex items-center gap-3 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold">Today:</span>
                    <span className="font-mono font-bold">${stats.todaySales.toFixed(2)}</span>
                  </div>
                  <span className="text-emerald-300 dark:text-emerald-700">|</span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[11px]">Tips: ${stats.todayTipsTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Branding & Database Setup / Settings */}
            {onOpenSettings && (
              <button
                id="btn-open-settings"
                onClick={onOpenSettings}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer shadow-2xs"
                title="Restaurant Branding & Database Settings"
              >
                <Settings className="w-4 h-4 text-slate-600 dark:text-amber-400" />
                <span className="hidden md:inline text-xs font-semibold">Settings</span>
                {profile?.database_mode && (
                  <span
                    className={`text-[9px] uppercase font-extrabold px-1.5 py-0.2 rounded-full hidden sm:inline ${
                      profile.database_mode === 'demo'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                    }`}
                  >
                    {profile.database_mode}
                  </span>
                )}
              </button>
            )}

            {/* Theme Toggle Button for Low-Light Restaurant Terminal */}
            <button
              id="btn-theme-toggle"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-400 transition cursor-pointer shadow-2xs"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to low-light dark terminal mode'}
              title={isDark ? 'Terminal in Low-Light Dark mode (click for Light mode)' : 'Terminal in Light mode (click for Low-Light Dark mode)'}
            >
              {isDark ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                  <span className="hidden xl:inline text-xs font-semibold text-slate-200">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-600" />
                  <span className="hidden xl:inline text-xs font-semibold text-slate-700">Dark</span>
                </>
              )}
            </button>

            <button
              id="btn-quick-clock"
              onClick={handleClockIn}
              className="btn-quick-clock inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 transition cursor-pointer shadow-xs border border-amber-600/30 dark:border-amber-400"
            >
              <CircleDot className="w-3.5 h-3.5 text-emerald-950 dark:text-slate-950 shrink-0" />
              <span className="hidden sm:inline">Staff Clock-In / PIN</span>
              <span className="sm:hidden">Clock</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none border-t border-slate-100 dark:border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            const requiresAdminLock = item.adminRequired && !currentUser?.admin_access;

            return (
              <button
                key={item.id}
                id={`tab-${item.id}`}
                onClick={() => handleSelect(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 dark:bg-slate-800 text-white shadow-2xs border border-transparent dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{item.label}</span>
                {requiresAdminLock && (
                  <Lock className="w-3 h-3 text-slate-400 dark:text-slate-500" title="Admin access required" />
                )}
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
