import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isCraftsmanRole, isManagementRole } from '../utils/permissions';
import { SalesERP } from './SalesERP';
import { ProductionERP } from './ProductionERP';
import { TailorERP } from './TailorERP';
import { CustomerVaultERP } from './CustomerVaultERP';
import { CeoAttendanceCenter } from './CeoAttendanceCenter';
import { TailorDashboard } from './TailorDashboard';
import { InventoryERP } from './InventoryERP';
import { UserManagement } from './UserManagement';
import { WeeklySalaryERP } from './WeeklySalaryERP';
import { Scissors, Award, Users, Package, CreditCard, DollarSign, UserCheck, Share2, Building, AlertTriangle, Brain, Smartphone, FileSpreadsheet } from 'lucide-react';

/**
 * ModuleRenderer — JB GROUP / Bella Design ERP
 *
 * Directs the user to the appropriate sub-dashboard based on `activeTab`:
 * - 'overview' / 'sales':  Sales & Orders live kanban (<SalesERP />)
 * - 'production':          Production journey stepper (<ProductionERP />)
 * - 'tailors':             Tailor leaderboard & performance (<TailorERP />)
 * - 'customers':           Customer 360 & measurement vault (<CustomerVaultERP />)
 * - 'inventory':           Material & stock ledger (<InventoryERP />)
 * - 'payroll':             Weekly tailor salary calculations (<WeeklySalaryERP />)
 * - 'users':               Role management & user accounts (<UserManagement />)
 * - 'staff':               Staff attendance & clock-in records (<CeoAttendanceCenter />)
 */
export const ModuleRenderer = () => {
  const { activeTab, activeBranch, user } = useAuth();

  // If a tailor craftsman accesses ModuleRenderer, render their dedicated workspace exclusively
  if (isCraftsmanRole(user?.role)) {
    return <TailorDashboard />;
  }

  // Route active tab to dedicated sub-dashboards
  if (activeTab === 'users') {
    if (!isManagementRole(user?.role)) {
      return (
        <div style={{ padding: '48px', textAlign: 'center', color: '#dc2626' }}>
          <h3>Access Denied</h3>
          <p>You do not have permission to access User Management.</p>
        </div>
      );
    }
    return <UserManagement />;
  }

  if (activeTab === 'sales' || activeTab === 'overview') {
    return <SalesERP />;
  }

  if (activeTab === 'production') {
    return <ProductionERP />;
  }

  if (activeTab === 'tailors') {
    return <TailorERP />;
  }

  if (activeTab === 'customers') {
    return <CustomerVaultERP />;
  }

  if (activeTab === 'inventory') {
    return <InventoryERP />;
  }

  if (activeTab === 'payroll') {
    return <WeeklySalaryERP />;
  }

  if (activeTab === 'staff') {
    return (
      <div className="module-container-responsive" style={{ padding: '28px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              backgroundColor: 'var(--jb-crimson-light)',
              color: 'var(--jb-crimson)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserCheck size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Staff Attendance & Roster Center
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
                Real-time employee clock-in records, working hours, and branch attendance telemetry
              </p>
            </div>
          </div>
          <div className="badge badge-navy" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
            Filter: <strong>{activeBranch === 'ALL' ? 'All Branches Combined' : activeBranch}</strong>
          </div>
        </div>
        <CeoAttendanceCenter />
      </div>
    );
  }

  const moduleInfo = {
    production: { title: 'Production Journey & Manufacturing', desc: 'Live dress stepper: Order → Measurement → Cutting → Stitching → Quality Check → Ready → Delivered', icon: Scissors },
    tailors: { title: 'Tailor Performance & Leaderboard', desc: 'Dresses completed today/month, productivity rankings, working hours, quality ratings', icon: Award },
    customers: { title: 'Customer 360 & Measurement Vault', desc: 'Complete client history, body measurements, order ledger, and review analytics', icon: Users },
    inventory: { title: 'Material & Inventory ERP', desc: 'Fabric stock levels, thread spools, sub-materials, intelligent low stock reorder alerts', icon: Package },
    payroll: { title: 'Salary & Payroll Management ERP', desc: 'Monthly disbursements, commission earned, bonus/deduction tracking, receipt uploads', icon: CreditCard },
    finance: { title: 'Financial Health & Recurring Expenses', desc: 'Cash received, gross/net profit margin, fixed rent & utility template tracking', icon: DollarSign },
    staff: { title: 'Staff Roster & Access Controls', desc: 'Clock-in tracker, attendance, leave requests, dynamic vacation/inactive locks', icon: UserCheck },
    marketing: { title: 'Marketing Enquiries & Lead API', desc: 'Facebook, WhatsApp, Instagram enquiry telemetry and campaign ROI', icon: Share2 },
    branches: { title: 'Multi-Branch Analytics & Transfer Engine', desc: 'JB Group (Main) and Bella Design performance matrix and inter-branch stock transfers', icon: Building },
    alerts: { title: 'CEO Alert Centre (Priority Signals)', desc: 'Interactive alert feed: Overdue orders, low stock, staff absences, high-value orders', icon: AlertTriangle },
    bi: { title: 'Business Intelligence (BI) Engine', desc: 'AI production risk forecasts and sales anomaly recommendation insights', icon: Brain },
    mobile: { title: 'CEO Mobile Executive Mode', desc: 'Single-thumb mobile priority view: Revenue → Profit → Orders → Production → Alerts', icon: Smartphone },
    reports: { title: 'Automated Reports & Export Engine', desc: 'Daily narrative reports, weekly audits, P&L statements with PDF and Excel export', icon: FileSpreadsheet }
  };

  const current = moduleInfo[activeTab] || moduleInfo.production;
  const IconComp = current.icon;

  return (
    <div className="module-container-responsive" style={{ padding: '28px' }}>
      {/* Top Banner Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--jb-crimson-light)',
            color: 'var(--jb-crimson)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <IconComp size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {current.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {current.desc}
            </p>
          </div>
        </div>

        <div className="badge badge-navy" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
          Filter: <strong>{activeBranch === 'ALL' ? 'All 3 Branches Combined' : activeBranch}</strong>
        </div>
      </div>

      {/* Module Workspace Card */}
      <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '60px 20px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-main)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px',
          color: 'var(--jb-crimson)'
        }}>
          <IconComp size={32} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
          Module Ready for Build-out: {current.title}
        </h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '560px', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Select Sales ERP, Production Journey, Tailor Performance, or Customer 360 Vault to view live ERP telemetry.
        </p>
      </div>
    </div>
  );
};
