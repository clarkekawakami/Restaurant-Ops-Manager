import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { OrdersModule } from './components/OrdersModule.tsx';
import { MenuModule } from './components/MenuModule.tsx';
import { InventoryModule } from './components/InventoryModule.tsx';
import { StaffModule } from './components/StaffModule.tsx';
import { ReservationsModule } from './components/ReservationsModule.tsx';
import { StaffMember, AppStats } from './types.ts';
import { api } from './lib/api.ts';

export default function App() {
  const [activeModule, setActiveModule] = useState<'orders' | 'menu' | 'inventory' | 'staff' | 'reservations'>('orders');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [preselectedTable, setPreselectedTable] = useState<string | null>(null);
  const [quickClockInOpen, setQuickClockInOpen] = useState<boolean>(false);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await api.getStaff();
      setStaffList(data);
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchStats();

    // Auto-refresh stats periodically
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStaff, fetchStats]);

  const handleSeatAndOpenOrder = (tableNumber: string) => {
    setPreselectedTable(tableNumber);
    setActiveModule('orders');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-amber-200">
      <Navbar
        activeModule={activeModule}
        onSelectModule={(m) => {
          if (m !== 'orders') setPreselectedTable(null);
          setActiveModule(m);
        }}
        onModuleChange={(m) => {
          if (m !== 'orders') setPreselectedTable(null);
          setActiveModule(m);
        }}
        staffList={staffList}
        stats={stats}
        onOpenQuickClockIn={() => {
          setActiveModule('staff');
          setQuickClockInOpen(true);
        }}
        onQuickClockIn={() => {
          setActiveModule('staff');
          setQuickClockInOpen(true);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeModule === 'orders' && (
          <OrdersModule
            staffList={staffList}
            onStatsRefresh={fetchStats}
            preselectedTable={preselectedTable}
          />
        )}

        {activeModule === 'menu' && <MenuModule />}

        {activeModule === 'inventory' && (
          <InventoryModule onStatsRefresh={fetchStats} />
        )}

        {activeModule === 'staff' && (
          <StaffModule
            staffList={staffList}
            onStaffRefresh={fetchStaff}
            onStatsRefresh={fetchStats}
            quickClockInOpen={quickClockInOpen}
            onCloseQuickClockIn={() => setQuickClockInOpen(false)}
          />
        )}

        {activeModule === 'reservations' && (
          <ReservationsModule
            onSeatAndOpenOrder={handleSeatAndOpenOrder}
            onStatsRefresh={fetchStats}
          />
        )}
      </main>

      {/* Subtle footer */}
      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>The Rustic Bistro &bull; Simplified Single-Tenant Restaurant Suite</span>
          <span className="text-[11px] text-slate-400">
            Persistent SQLite Database &bull; Cash & Standalone Terminal Payment Recording &bull; External Payroll Ready
          </span>
        </div>
      </footer>
    </div>
  );
}
