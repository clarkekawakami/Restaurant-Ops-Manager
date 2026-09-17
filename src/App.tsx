import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, ActiveModule } from './components/Navbar.tsx';
import { OrdersModule } from './components/OrdersModule.tsx';
import { MenuModule } from './components/MenuModule.tsx';
import { InventoryModule } from './components/InventoryModule.tsx';
import { StaffModule } from './components/StaffModule.tsx';
import { ReservationsModule } from './components/ReservationsModule.tsx';
import { SeatingModule } from './components/SeatingModule.tsx';
import { SwitchUserModal } from './components/SwitchUserModal.tsx';
import { AdminAuthModal } from './components/AdminAuthModal.tsx';
import { StaffMember, AppStats } from './types.ts';
import { api } from './lib/api.ts';
import { ThemeProvider } from './context/ThemeContext.tsx';

function AppContent() {
  const [activeModule, setActiveModule] = useState<ActiveModule>('orders');
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [currentUser, setCurrentUser] = useState<StaffMember | null>(null);
  const [stats, setStats] = useState<AppStats | null>(null);
  const [preselectedTable, setPreselectedTable] = useState<string | null>(null);
  const [quickClockInOpen, setQuickClockInOpen] = useState<boolean>(false);

  // Modals for user switching & admin authorization
  const [isSwitchUserOpen, setIsSwitchUserOpen] = useState<boolean>(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState<boolean>(false);
  const [pendingModule, setPendingModule] = useState<ActiveModule | null>(null);

  const fetchStaff = useCallback(async () => {
    try {
      const data = await api.getStaff();
      setStaffList(data);

      // Initialize or restore active terminal user
      const savedUserId = localStorage.getItem('rustic_bistro_current_user_id');
      if (savedUserId) {
        const found = data.find((s) => s.id === savedUserId);
        if (found) {
          setCurrentUser(found);
          return;
        }
      }

      // Default to first admin staff or first staff member
      const defaultAdmin = data.find((s) => s.admin_access);
      if (defaultAdmin) {
        setCurrentUser(defaultAdmin);
        localStorage.setItem('rustic_bistro_current_user_id', defaultAdmin.id);
      } else if (data.length > 0) {
        setCurrentUser(data[0]);
        localStorage.setItem('rustic_bistro_current_user_id', data[0].id);
      }
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

  const handleSetCurrentUser = (staff: StaffMember) => {
    setCurrentUser(staff);
    localStorage.setItem('rustic_bistro_current_user_id', staff.id);
  };

  // Enforce admin access when switching modules
  const handleSelectModule = (targetModule: ActiveModule) => {
    if (targetModule !== 'orders') {
      setPreselectedTable(null);
    }

    // Menu and Inventory modules require admin access
    const isProtected = targetModule === 'menu' || targetModule === 'inventory';

    if (isProtected && (!currentUser || !currentUser.admin_access)) {
      setPendingModule(targetModule);
      setIsAdminAuthOpen(true);
      return;
    }

    setActiveModule(targetModule);
  };

  const handleAdminAuthSuccess = (authenticatedAdmin: StaffMember) => {
    handleSetCurrentUser(authenticatedAdmin);
    setIsAdminAuthOpen(false);

    if (pendingModule) {
      setActiveModule(pendingModule);
      setPendingModule(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans text-slate-900 dark:text-slate-100 selection:bg-amber-200 dark:selection:bg-amber-800 transition-colors duration-200">
      <Navbar
        activeModule={activeModule}
        onSelectModule={handleSelectModule}
        onModuleChange={handleSelectModule}
        staffList={staffList}
        currentUser={currentUser}
        onOpenSwitchUser={() => setIsSwitchUserOpen(true)}
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

        {activeModule === 'menu' && (
          <MenuModule
            currentUser={currentUser}
            staffList={staffList}
            onRequireAdminAuth={handleSetCurrentUser}
          />
        )}

        {activeModule === 'inventory' && (
          <InventoryModule
            currentUser={currentUser}
            staffList={staffList}
            onRequireAdminAuth={handleSetCurrentUser}
            onStatsRefresh={fetchStats}
          />
        )}

        {activeModule === 'staff' && (
          <StaffModule
            staffList={staffList}
            onStaffRefresh={fetchStaff}
            onStatsRefresh={fetchStats}
            quickClockInOpen={quickClockInOpen}
            onCloseQuickClockIn={() => setQuickClockInOpen(false)}
            currentUser={currentUser}
            setCurrentUser={handleSetCurrentUser}
          />
        )}

        {activeModule === 'reservations' && (
          <ReservationsModule
            onSeatAndOpenOrder={handleSeatAndOpenOrder}
            onStatsRefresh={fetchStats}
          />
        )}

        {activeModule === 'seating' && (
          <SeatingModule
            currentUser={currentUser}
            staffList={staffList}
            onRequireAdminAuth={handleSetCurrentUser}
            onSeatAndOpenOrder={handleSeatAndOpenOrder}
            onStatsRefresh={fetchStats}
          />
        )}
      </main>

      {/* Switch Terminal User Modal */}
      <SwitchUserModal
        isOpen={isSwitchUserOpen}
        onClose={() => setIsSwitchUserOpen(false)}
        staffList={staffList}
        currentUserId={currentUser?.id}
        onSelectUser={handleSetCurrentUser}
      />

      {/* Admin Authorization Prompt for Protected Modules */}
      <AdminAuthModal
        isOpen={isAdminAuthOpen}
        onClose={() => {
          setIsAdminAuthOpen(false);
          setPendingModule(null);
        }}
        adminStaffList={staffList.filter((s) => s.admin_access)}
        onSuccess={handleAdminAuthSuccess}
        title="Admin Authorization Required"
        description={
          pendingModule === 'menu'
            ? 'Administrator privileges are required to view and manage restaurant menu items and food costing.'
            : pendingModule === 'inventory'
            ? 'Administrator privileges are required to view and manage inventory stock levels, categories, and audits.'
            : 'Administrator privileges are required to perform this management action.'
        }
      />

      {/* Subtle footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>The Rustic Bistro &bull; Simplified Single-Tenant Restaurant Suite</span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            Persistent SQLite Database &bull; Role/Title Access &bull; Cash & Standalone Terminal Payment Recording
          </span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

