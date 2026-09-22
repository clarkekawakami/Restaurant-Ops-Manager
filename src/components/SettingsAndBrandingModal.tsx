import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Database,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  UtensilsCrossed,
  ChefHat,
  Flame,
  Wine,
  Coffee,
  Pizza,
  Beer,
  Store,
  Receipt,
  Check,
  ChevronRight,
} from 'lucide-react';
import { BusinessProfile, DatabaseStatus } from '../types.ts';
import { api } from '../lib/api.ts';
import { RestaurantLogo } from './RestaurantLogo.tsx';

interface SettingsAndBrandingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BusinessProfile | null;
  onProfileUpdated: (updated: BusinessProfile) => void;
  onDatabaseReinitialized: (newProfile: BusinessProfile) => void;
  initialTab?: 'branding' | 'database';
  isFirstTimeSetup?: boolean;
}

const AVAILABLE_ICONS = [
  { id: 'utensils', label: 'Classic Utensils', icon: UtensilsCrossed },
  { id: 'chef-hat', label: 'Chef Hat', icon: ChefHat },
  { id: 'flame', label: 'Grill & Flame', icon: Flame },
  { id: 'wine', label: 'Wine & Bar', icon: Wine },
  { id: 'coffee', label: 'Cafe & Espresso', icon: Coffee },
  { id: 'pizza', label: 'Pizzeria', icon: Pizza },
  { id: 'beer', label: 'Brewery / Pub', icon: Beer },
  { id: 'store', label: 'Bistro Storefront', icon: Store },
];

export function SettingsAndBrandingModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
  onDatabaseReinitialized,
  initialTab = 'branding',
  isFirstTimeSetup = false,
}: SettingsAndBrandingModalProps) {
  const [activeTab, setActiveTab] = useState<'branding' | 'database'>(initialTab);
  const [wizardStep, setWizardStep] = useState<number>(1);

  // Form State
  const [businessName, setBusinessName] = useState(profile?.business_name || 'The Rustic Bistro');
  const [tagline, setTagline] = useState(profile?.tagline || 'Artisan Kitchen & Craft Bar');
  const [logoUrl, setLogoUrl] = useState(profile?.logo_url || '');
  const [logoIcon, setLogoIcon] = useState(profile?.logo_icon || 'utensils');
  const [logoType, setLogoType] = useState<'icon' | 'custom'>(profile?.logo_url ? 'custom' : 'icon');
  const [phone, setPhone] = useState(profile?.phone || '(555) 234-8900');
  const [email, setEmail] = useState(profile?.email || 'info@rusticbistro.com');
  const [address, setAddress] = useState(profile?.address || '124 Main Street • Downtown');
  const [receiptFooter, setReceiptFooter] = useState(
    profile?.receipt_footer || 'Thank you for dining with us! Please come again.'
  );
  const [taxRate, setTaxRate] = useState<number>(profile?.tax_rate ?? 8.25);
  const [currencySymbol, setCurrencySymbol] = useState(profile?.currency_symbol || '$');

  // Database reinitialization state
  const [dbStatus, setDbStatus] = useState<DatabaseStatus | null>(null);
  const [selectedDbMode, setSelectedDbMode] = useState<'demo' | 'minimal'>('demo');
  const [adminName, setAdminName] = useState('General Manager');
  const [adminPin, setAdminPin] = useState('1234');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingReinitMode, setPendingReinitMode] = useState<'demo' | 'minimal'>('demo');
  const [isSaving, setIsSaving] = useState(false);
  const [isReinitializing, setIsReinitializing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setBusinessName(profile.business_name);
      setTagline(profile.tagline);
      setLogoUrl(profile.logo_url || '');
      setLogoIcon(profile.logo_icon || 'utensils');
      setLogoType(profile.logo_url ? 'custom' : 'icon');
      setPhone(profile.phone || '');
      setEmail(profile.email || '');
      setAddress(profile.address || '');
      setReceiptFooter(profile.receipt_footer || '');
      setTaxRate(profile.tax_rate ?? 8.25);
      setCurrencySymbol(profile.currency_symbol || '$');
      setSelectedDbMode(profile.database_mode || 'demo');
    }
  }, [profile]);

  useEffect(() => {
    if (isOpen) {
      loadDbStatus();
      setStatusMessage(null);
    }
  }, [isOpen]);

  const loadDbStatus = async () => {
    try {
      const data = await api.getDatabaseStatus();
      setDbStatus(data);
    } catch (err) {
      console.error('Failed to load database status:', err);
    }
  };

  if (!isOpen) return null;

  const handleSaveBranding = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const finalLogoUrl = logoType === 'custom' ? logoUrl.trim() : '';
      const updated = await api.updateBusinessProfile({
        business_name: businessName.trim() || 'Restaurant POS',
        tagline: tagline.trim(),
        logo_url: finalLogoUrl,
        logo_icon: logoIcon,
        phone: phone.trim(),
        email: email.trim(),
        address: address.trim(),
        receipt_footer: receiptFooter.trim(),
        tax_rate: Number(taxRate) || 0,
        currency_symbol: currencySymbol.trim() || '$',
      });

      onProfileUpdated(updated);
      setStatusMessage({ type: 'success', text: 'Branding and business settings updated successfully!' });
      setTimeout(() => setStatusMessage(null), 3500);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to update branding settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'Logo image must be under 2MB' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setLogoUrl(result);
        setLogoType('custom');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteReinitialization = async () => {
    setIsReinitializing(true);
    setStatusMessage(null);

    try {
      const finalLogoUrl = logoType === 'custom' ? logoUrl.trim() : '';
      const res = await api.reinitializeDatabase({
        mode: pendingReinitMode,
        branding: {
          business_name: businessName.trim() || 'Restaurant POS',
          tagline: tagline.trim(),
          logo_url: finalLogoUrl,
          logo_icon: logoIcon,
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          receipt_footer: receiptFooter.trim(),
          tax_rate: Number(taxRate) || 0,
          currency_symbol: currencySymbol.trim() || '$',
        },
        adminUser: {
          name: adminName.trim() || 'General Manager',
          pin: adminPin.trim() || '1234',
        },
      });

      setConfirmDialogOpen(false);
      onDatabaseReinitialized(res.profile);
      await loadDbStatus();
      setStatusMessage({
        type: 'success',
        text: `Database successfully reinitialized into ${
          pendingReinitMode === 'demo' ? 'Full Interactive Demo' : 'Minimal Operational Clean Slate'
        } mode!`,
      });

      if (isFirstTimeSetup) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reinitialize database' });
    } finally {
      setIsReinitializing(false);
    }
  };

  const promptReinitialization = (mode: 'demo' | 'minimal') => {
    setPendingReinitMode(mode);
    setConfirmDialogOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                {isFirstTimeSetup ? 'Installation & Setup Wizard' : 'Restaurant Branding & System Setup'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isFirstTimeSetup
                  ? 'Configure your restaurant identity and select your operational database setup'
                  : 'Customize your business identity, printed receipts, and manage database seeding'}
              </p>
            </div>
          </div>
          {!isFirstTimeSetup && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Status Message Alert */}
        {statusMessage && (
          <div
            className={`px-6 py-3 text-sm flex items-center gap-2 border-b ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Tab Navigation (Standard Mode) */}
        {!isFirstTimeSetup && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-slate-900/40">
            <button
              onClick={() => setActiveTab('branding')}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'branding'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Brand Identity & Receipts
            </button>
            <button
              onClick={() => setActiveTab('database')}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'database'
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              <Database className="w-4 h-4" />
              Database & Installation Mode
              {dbStatus?.database_mode && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ml-1">
                  {dbStatus.database_mode}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB: BRANDING IDENTITY */}
          {(activeTab === 'branding' || isFirstTimeSetup) && (
            <div className="space-y-6">
              {/* Live Preview Header Card */}
              <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-md">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Live Navigation Bar & Receipt Preview
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                  <div className="flex items-center gap-3">
                    <RestaurantLogo
                      logoUrl={logoType === 'custom' ? logoUrl : ''}
                      logoIcon={logoIcon}
                      className="w-12 h-12 rounded-xl bg-slate-950 flex items-center justify-center border border-slate-700 shrink-0 overflow-hidden"
                      iconClassName="w-6 h-6 text-amber-400"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading text-base sm:text-lg font-bold text-white tracking-tight">
                          {businessName.trim() || 'Your Restaurant Name'}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm bg-slate-700 text-amber-300">
                          POS
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {tagline.trim() || 'Operations & Dining Management'}
                      </p>
                    </div>
                  </div>

                  {/* Receipt snippet preview */}
                  <div className="border-t sm:border-t-0 sm:border-l border-slate-700 pt-2 sm:pt-0 sm:pl-4 font-mono text-[11px] text-slate-300">
                    <div className="font-bold text-white uppercase truncate max-w-[200px]">
                      {businessName.trim() || 'Receipt Header'}
                    </div>
                    <div className="text-slate-400 text-[10px] truncate max-w-[200px]">{address}</div>
                    <div className="text-slate-400 text-[10px]">Tel: {phone}</div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Business Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Business / Restaurant Name <span className="text-amber-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. The Rustic Bistro"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    required
                  />
                  <p className="text-[11px] text-slate-500">
                    Displayed in the navbar, mobile header, receipts, and reports.
                  </p>
                </div>

                {/* Tagline */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Tagline / Subtitle
                  </label>
                  <input
                    type="text"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g. Artisan Kitchen & Craft Bar"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500">
                    Short description or cuisine style below your business name.
                  </p>
                </div>
              </div>

              {/* Logo Selection Section */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white">Restaurant Logo & Icon</h3>
                    <p className="text-xs text-slate-500">Choose between a preset emblem or upload your custom logo image</p>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLogoType('icon')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                        logoType === 'icon'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Preset Emblems
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogoType('custom')}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                        logoType === 'custom'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                      }`}
                    >
                      Custom Image / Upload
                    </button>
                  </div>
                </div>

                {logoType === 'icon' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Select Built-in Restaurant Emblem:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {AVAILABLE_ICONS.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = logoIcon === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setLogoIcon(item.id)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition cursor-pointer ${
                              isSelected
                                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold ring-2 ring-amber-500/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-amber-400 shrink-0">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <span className="text-xs truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Image URL Input */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Image URL
                        </label>
                        <input
                          type="url"
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      {/* File Upload Button */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Or Upload File from Computer
                        </label>
                        <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-lg text-xs text-slate-700 dark:text-slate-300 cursor-pointer transition">
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span>Choose PNG / JPG / SVG</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>

                    {logoUrl && (
                      <div className="flex items-center gap-3 p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                        <img
                          src={logoUrl}
                          alt="Uploaded Logo"
                          className="w-10 h-10 object-contain rounded border border-slate-200 dark:border-slate-700"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block truncate">
                            Custom Logo Active
                          </span>
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="text-[11px] text-rose-500 hover:underline"
                          >
                            Remove and clear logo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Receipt, Address & Financial Parameters */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
                <h3 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-amber-500" />
                  Receipt & Location Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Address */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="124 Main Street • Downtown"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 234-8900"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  {/* Email / Web */}
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Email / Website
                    </label>
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="info@rusticbistro.com"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Receipt Footer */}
                  <div className="md:col-span-2 space-y-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                      Receipt Footer Message
                    </label>
                    <input
                      type="text"
                      value={receiptFooter}
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Thank you for dining with us! Please come again."
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  {/* Tax Rate & Currency */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={taxRate}
                        onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                        Currency
                      </label>
                      <input
                        type="text"
                        value={currencySymbol}
                        onChange={(e) => setCurrencySymbol(e.target.value)}
                        placeholder="$"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!isFirstTimeSetup && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleSaveBranding()}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Save Branding Changes
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: DATABASE INITIALIZATION & MODE SELECTION */}
          {(activeTab === 'database' || isFirstTimeSetup) && (
            <div className="space-y-6 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Database className="w-5 h-5 text-amber-500" />
                    Database Configuration & Initialization Mode
                  </h3>
                  <p className="text-xs text-slate-500">
                    Choose the database mode that matches whether you are testing features or setting up a real restaurant
                  </p>
                </div>

                {dbStatus && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Currently Active:</span>
                    <span
                      className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${
                        dbStatus.database_mode === 'demo'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                          : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                      }`}
                    >
                      {dbStatus.database_mode === 'demo' ? 'Interactive Demo Mode' : 'Minimal Operational Mode'}
                    </span>
                  </div>
                )}
              </div>

              {/* Two Core Database Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Full Demo Database */}
                <div
                  className={`p-5 rounded-2xl border-2 transition relative flex flex-col justify-between cursor-pointer ${
                    selectedDbMode === 'demo'
                      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-4 ring-amber-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                  onClick={() => setSelectedDbMode('demo')}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                        Recommended for Testing
                      </span>
                    </div>

                    <h4 className="font-heading font-bold text-base text-slate-900 dark:text-white mb-1.5">
                      Full Interactive Demo Database
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                      Pre-populated with rich sample data so you can immediately explore and test every feature without manual entry.
                    </p>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>12 Crafted Menu items with recipe ingredient costing</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Live inventory items, stock thresholds & restock logs</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>6 Staff members (Manager, Servers, Bartender, Chef)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Time shifts & tip tracking history</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Seating layout (Main Dining, Bar, Patio) with 13 tables</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Active & completed POS ticket orders</span>
                      </div>
                    </div>
                  </div>

                  {!isFirstTimeSetup && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        promptReinitialization('demo');
                      }}
                      className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-amber-400 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Seed / Reset to Demo Database
                    </button>
                  )}
                </div>

                {/* Option 2: Minimal Operational Database */}
                <div
                  className={`p-5 rounded-2xl border-2 transition relative flex flex-col justify-between cursor-pointer ${
                    selectedDbMode === 'minimal'
                      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-4 ring-emerald-500/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                  onClick={() => setSelectedDbMode('minimal')}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                        For Real Restaurant Launch
                      </span>
                    </div>

                    <h4 className="font-heading font-bold text-base text-slate-900 dark:text-white mb-1.5">
                      Minimal Operational Database (Clean Slate)
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                      Zero mock sales, zero test orders, zero fake reservations. Sets up only essential categories ready for your actual restaurant menu & staff.
                    </p>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span><strong>0 mock orders & 0 fake transactions</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Clean starter menu categories (Food, Beverages)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Standard inventory categories (Produce, Meat, Seafood, etc.)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Default dining tables ready to customize</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Your Primary Manager Account & PIN (prevents lockout)</span>
                      </div>
                    </div>

                    {/* Admin User Configuration for Minimal setup */}
                    <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-2 text-xs">
                      <span className="font-bold text-slate-700 dark:text-slate-300 block">
                        Initial Administrator Account:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 block">Manager Name</label>
                          <input
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="General Manager"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block">Manager PIN (4-Digits)</label>
                          <input
                            type="password"
                            maxLength={4}
                            value={adminPin}
                            onChange={(e) => setAdminPin(e.target.value)}
                            placeholder="1234"
                            className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-center tracking-widest"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isFirstTimeSetup && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        promptReinitialization('minimal');
                      }}
                      className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      Initialize Clean Operational Slate
                    </button>
                  )}
                </div>
              </div>

              {/* Current Database Summary Metrics */}
              {dbStatus && (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-2">
                    Current Database Records:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dbStatus.counts.menuItems}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Menu Items</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dbStatus.counts.staff}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Staff</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dbStatus.counts.tables}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Tables</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dbStatus.counts.orders}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Orders</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dbStatus.counts.inventoryItems}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Inventory</div>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {dbStatus.counts.menuCategories}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">Categories</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer / Action Buttons */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
          {isFirstTimeSetup ? (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Ready to launch with <strong>{selectedDbMode === 'demo' ? 'Demo Database' : 'Clean Operational Database'}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setPendingReinitMode(selectedDbMode);
                  handleExecuteReinitialization();
                }}
                disabled={isReinitializing}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isReinitializing ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Confirm & Launch Restaurant POS
              </button>
            </div>
          ) : (
            <div className="w-full flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Single-Tenant SQLite Database &bull; Changes save to local disk
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close Settings
              </button>
            </div>
          )}
        </div>

        {/* Confirmation Modal for Database Reset / Switching */}
        {confirmDialogOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 max-w-md w-full p-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1.5">
                <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
                  Confirm Database Re-initialization
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {pendingReinitMode === 'demo' ? (
                    <>
                      This will replace current database records and load the <strong>Full Interactive Demo Database</strong> (sample menus, tickets, shifts, and tables).
                    </>
                  ) : (
                    <>
                      This will erase existing transaction records and initialize a <strong>Minimal Clean Slate</strong> ready for live operations.
                    </>
                  )}
                </p>
              </div>

              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs">
                <strong>Warning:</strong> Any active orders, shifts, or unprinted tickets in the current database will be permanently cleared.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialogOpen(false)}
                  disabled={isReinitializing}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReinitialization}
                  disabled={isReinitializing}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isReinitializing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Yes, Reinitialize
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
