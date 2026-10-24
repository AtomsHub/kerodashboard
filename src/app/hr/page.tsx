'use client';

// src/app/hr/page.tsx
// Phase 8.2: Internal HR Operations, Headcount Directory, Expense Claims & Leave Approvals
import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  UsersThree,
  Wallet,
  Receipt,
  CalendarCheck,
  Plus,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
  CurrencyNgn,
  Clock,
  Briefcase,
  X,
  FileText,
  UserPlus,
  Funnel,
  ShieldCheck,
  Sparkle,
} from '@phosphor-icons/react';
import { Chip, Modal, Avatar } from '@heroui/react';
import { AppButton } from '@/components/ui/app-button';
import { AppInput } from '@/components/ui/app-input';
import { AppTextarea } from '@/components/ui/app-textarea';
import { AppRowActions } from '@/components/ui/app-row-actions';
import { StatDashboardCard, DashboardCard } from '@/components/ui/dashboard-card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Page, PageHeader, Segmented, StatusPill } from '@/components/ui/page';

interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  department: 'Operations' | 'Finance' | 'Customer Support' | 'Engineering' | 'Executive';
  position: string;
  salaryKobo: number;
  employmentType: 'Full-Time' | 'Contract' | 'Probation';
  status: 'active' | 'on_leave' | 'terminated';
  joinedDate: string;
}

interface ExpenseClaim {
  id: string;
  employeeName: string;
  department: string;
  category: 'Fuel & Logistics' | 'Office Supplies' | 'Client Entertainment' | 'Emergency Fleet Op' | 'Other';
  amountKobo: number;
  receiptReference: string;
  justification: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface LeaveRequest {
  id: string;
  employeeName: string;
  department: string;
  leaveType: 'Annual' | 'Sick' | 'Maternity/Paternity' | 'Compassionate';
  startDate: string;
  endDate: string;
  days: number;
  notes: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
}

const INITIAL_EMPLOYEES: Employee[] = [];

const INITIAL_EXPENSES: ExpenseClaim[] = [];

const INITIAL_LEAVES: LeaveRequest[] = [];

export default function HROperationsPage() {
  const [activeTab, setActiveTab] = useState<'employees' | 'expenses' | 'leaves'>('employees');

  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [expenses, setExpenses] = useState<ExpenseClaim[]>(INITIAL_EXPENSES);
  const [leaves, setLeaves] = useState<LeaveRequest[]>(INITIAL_LEAVES);

  const [search, setSearch] = useState('');

  // Modals State
  const [isNewEmployeeOpen, setIsNewEmployeeOpen] = useState(false);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [isNewLeaveOpen, setIsNewLeaveOpen] = useState(false);

  // Form states
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpEmail, setNewEmpEmail] = useState('');
  const [newEmpPhone, setNewEmpPhone] = useState('');
  const [newEmpDept, setNewEmpDept] = useState<Employee['department']>('Operations');
  const [newEmpPosition, setNewEmpPosition] = useState('');
  const [newEmpSalary, setNewEmpSalary] = useState('1200000');
  const [newEmpType, setNewEmpType] = useState<Employee['employmentType']>('Full-Time');

  const [newExpEmp, setNewExpEmp] = useState('Amina Yusuf');
  const [newExpCategory, setNewExpCategory] = useState<ExpenseClaim['category']>('Fuel & Logistics');
  const [newExpAmount, setNewExpAmount] = useState('25000');
  const [newExpReceipt, setNewExpReceipt] = useState('');
  const [newExpJustification, setNewExpJustification] = useState('');

  const [newLevEmp, setNewLevEmp] = useState('Zainab Bello');
  const [newLevType, setNewLevType] = useState<LeaveRequest['leaveType']>('Annual');
  const [newLevStart, setNewLevStart] = useState('2026-10-20');
  const [newLevEnd, setNewLevEnd] = useState('2026-10-24');
  const [newLevNotes, setNewLevNotes] = useState('');
  const [pendingApproval, setPendingApproval] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  // Add Employee Handler
  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName || !newEmpEmail || !newEmpPosition) {
      toast.error('Please fill in all required employee fields');
      return;
    }
    const created: Employee = {
      id: `EMP-00${employees.length + 1}`,
      fullName: newEmpName,
      email: newEmpEmail,
      phone: newEmpPhone || '+234 800 000 0000',
      department: newEmpDept,
      position: newEmpPosition,
      salaryKobo: Number(newEmpSalary) * 100,
      employmentType: newEmpType,
      status: 'active',
      joinedDate: new Date().toISOString().split('T')[0],
    };
    setEmployees([created, ...employees]);
    setIsNewEmployeeOpen(false);
    toast.success(`Staff member ${newEmpName} onboarded to ${newEmpDept}`);
    setNewEmpName('');
    setNewEmpEmail('');
    setNewEmpPosition('');
  };

  // Add Expense Handler
  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpReceipt || !newExpJustification || !newExpAmount) {
      toast.error('Please provide receipt reference and justification');
      return;
    }
    const created: ExpenseClaim = {
      id: `EXP-${400 + expenses.length + 1}`,
      employeeName: newExpEmp,
      department: 'Operations',
      category: newExpCategory,
      amountKobo: Number(newExpAmount) * 100,
      receiptReference: newExpReceipt,
      justification: newExpJustification,
      submittedAt: 'Just now',
      status: 'PENDING',
    };
    setExpenses([created, ...expenses]);
    setIsNewExpenseOpen(false);
    toast.success(`Petty cash claim for ₦${Number(newExpAmount).toLocaleString()} submitted for review`);
    setNewExpReceipt('');
    setNewExpJustification('');
  };

  // Add Leave Handler
  const handleCreateLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const created: LeaveRequest = {
      id: `LEV-${300 + leaves.length + 1}`,
      employeeName: newLevEmp,
      department: 'Operations',
      leaveType: newLevType,
      startDate: newLevStart,
      endDate: newLevEnd,
      days: 4,
      notes: newLevNotes || 'Personal time off request',
      submittedAt: 'Just now',
      status: 'PENDING',
    };
    setLeaves([created, ...leaves]);
    setIsNewLeaveOpen(false);
    toast.success(`Leave request submitted for ${newLevEmp}`);
    setNewLevNotes('');
  };

  const handleExpenseAction = (id: string, action: 'APPROVED' | 'REJECTED') => {
    setExpenses((prev) =>
      prev.map((exp) => (exp.id === id ? { ...exp, status: action } : exp))
    );
    toast.success(`Claim ${id} ${action === 'APPROVED' ? 'approved for payroll reimbursement' : 'rejected'}`);
  };

  const handleLeaveAction = (id: string, action: 'APPROVED' | 'DECLINED') => {
    setLeaves((prev) =>
      prev.map((lev) => (lev.id === id ? { ...lev, status: action } : lev))
    );
    toast.success(`Leave request ${id} ${action === 'APPROVED' ? 'authorized' : 'declined'}`);
  };

  // Filtered lists
  const filteredEmployees = employees.filter(
    (e) =>
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase()) ||
      e.department.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Page>
      <PageHeader
        title="People"
        description="Staff, expense claims and leave."
      />


      <DashboardCard className="bg-warning-soft/50">
        <p className="text-[13px] text-foreground">HR isn’t connected to the backend yet, so there are no staff, expense or leave records to show.</p>
      </DashboardCard>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatDashboardCard
          label="Headcount"
          icon={UsersThree}
          variant="wallet"
          value={employees.length}
          hint="Staff records"
        />
        <StatDashboardCard
          label="Monthly payroll"
          icon={Wallet}
          value={`₦${(employees.reduce((acc, curr) => acc + curr.salaryKobo, 0) / 100).toLocaleString()}`}
          hint="Sum of monthly salaries"
        />
        <StatDashboardCard
          label="Pending claims"
          icon={Receipt}
          value={expenses.filter((e) => e.status === 'PENDING').length}
          hint="Awaiting finance"
        />
        <StatDashboardCard
          label="On leave"
          icon={CalendarCheck}
          value={employees.filter((e) => e.status === 'on_leave').length}
          hint="Out this week"
        />
      </div>

      <DashboardCard className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-6 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            size="sm"
            aria-label="Section"
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { key: 'employees', label: 'Staff', count: employees.length },
              { key: 'expenses', label: 'Expenses', count: expenses.length },
              { key: 'leaves', label: 'Leave', count: leaves.length },
            ]}
          />
          {activeTab === 'employees' && (
            <div className="w-full sm:w-64">
              <AppInput
                size="sm"
                placeholder="Search staff"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                startContent={<MagnifyingGlass />}
              />
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {activeTab === 'employees' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Salary</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <UserAvatar name={emp.fullName} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{emp.fullName}</p>
                          <p className="tabular text-xs text-muted">{emp.id}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <p className="text-foreground">{emp.position}</p>
                      <p className="text-xs text-muted">{emp.department}</p>
                    </td>
                    <td>
                      <p className="text-foreground">{emp.email}</p>
                      <p className="tabular text-xs text-muted">{emp.phone}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <p className="tabular font-medium text-foreground">₦{(emp.salaryKobo / 100).toLocaleString()}</p>
                      <p className="text-xs capitalize text-muted">{emp.employmentType.replace('_', ' ')}</p>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusPill
                        tone={emp.status === 'active' ? 'success' : emp.status === 'on_leave' ? 'warning' : 'danger'}
                        dot
                      >
                        <span className="capitalize">{emp.status.replace('_', ' ')}</span>
                      </StatusPill>
                    </td>
                    <td className="tabular whitespace-nowrap text-muted">{emp.joinedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'expenses' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Employee</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id}>
                    <td className="tabular whitespace-nowrap font-medium text-foreground">{exp.id}</td>
                    <td>
                      <p className="text-foreground">{exp.employeeName}</p>
                      <p className="text-xs text-muted">{exp.department}</p>
                    </td>
                    <td className="whitespace-nowrap text-foreground">{exp.category}</td>
                    <td className="tabular whitespace-nowrap font-medium text-foreground">
                      ₦{(exp.amountKobo / 100).toLocaleString()}
                    </td>
                    <td className="max-w-[260px]">
                      <p className="truncate text-muted" title={exp.justification}>
                        {exp.justification}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusPill tone={exp.status === 'APPROVED' ? 'success' : exp.status === 'PENDING' ? 'warning' : 'danger'}>
                        <span className="capitalize">{exp.status.toLowerCase()}</span>
                      </StatusPill>
                    </td>
                    <td className="text-right">
                      {exp.status === 'PENDING' && (
                        <AppRowActions
                          items={[
                            {
                              key: 'approve',
                              label: 'Approve',
                              icon: <CheckCircle size={14} />,
                              onClick: () =>
                                setPendingApproval({
                                  title: 'Approve claim',
                                  description: `₦${(exp.amountKobo / 100).toLocaleString()} for ${exp.employeeName}.`,
                                  confirmLabel: 'Approve',
                                  onConfirm: () => handleExpenseAction(exp.id, 'APPROVED'),
                                }),
                            },
                            {
                              key: 'reject',
                              label: 'Reject',
                              icon: <XCircle size={14} />,
                              danger: true,
                              onClick: () => handleExpenseAction(exp.id, 'REJECTED'),
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'leaves' && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Note</th>
                  <th>Status</th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {leaves.map((lev) => (
                  <tr key={lev.id}>
                    <td className="tabular whitespace-nowrap font-medium text-foreground">{lev.id}</td>
                    <td>
                      <p className="text-foreground">{lev.employeeName}</p>
                      <p className="text-xs text-muted">{lev.department}</p>
                    </td>
                    <td className="whitespace-nowrap text-foreground">{lev.leaveType}</td>
                    <td className="whitespace-nowrap">
                      <p className="tabular text-foreground">
                        {lev.startDate} – {lev.endDate}
                      </p>
                      <p className="tabular text-xs text-muted">{lev.days} days</p>
                    </td>
                    <td className="max-w-[260px]">
                      <p className="truncate text-muted" title={lev.notes}>
                        {lev.notes}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <StatusPill tone={lev.status === 'APPROVED' ? 'success' : lev.status === 'PENDING' ? 'warning' : 'danger'}>
                        <span className="capitalize">{lev.status.toLowerCase()}</span>
                      </StatusPill>
                    </td>
                    <td className="text-right">
                      {lev.status === 'PENDING' && (
                        <AppRowActions
                          items={[
                            {
                              key: 'approve',
                              label: 'Approve',
                              icon: <CheckCircle size={14} />,
                              onClick: () =>
                                setPendingApproval({
                                  title: 'Approve leave',
                                  description: `${lev.days} days for ${lev.employeeName}.`,
                                  confirmLabel: 'Approve',
                                  onConfirm: () => handleLeaveAction(lev.id, 'APPROVED'),
                                }),
                            },
                            {
                              key: 'decline',
                              label: 'Decline',
                              icon: <XCircle size={14} />,
                              danger: true,
                              onClick: () => handleLeaveAction(lev.id, 'DECLINED'),
                            },
                          ]}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DashboardCard>

      {/* CREATE EMPLOYEE MODAL: HeroUI Compound centered in middle */}
      <Modal>
        <Modal.Backdrop
          isOpen={isNewEmployeeOpen}
          onOpenChange={setIsNewEmployeeOpen}
        >
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <form onSubmit={handleCreateEmployee}>
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Add New Staff Member</h3>
                    <p className="mt-1 text-xs text-muted">
                      Onboard an internal employee to the Kero platform
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewEmployeeOpen(false)}
                    className="rounded-lg p-1.5 text-muted hover:bg-muted"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Full Name *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          placeholder="e.g. Oluwaseun Adeleke"
                          value={newEmpName}
                          onChange={(e) => setNewEmpName(e.target.value)}
                          isRequired
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">Corporate Email *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="email"
                          placeholder="name@kero.ng"
                          value={newEmpEmail}
                          onChange={(e) => setNewEmpEmail(e.target.value)}
                          isRequired
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Phone Number</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          placeholder="+234..."
                          value={newEmpPhone}
                          onChange={(e) => setNewEmpPhone(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">Department</label>
                      <div className="mt-1">
                        <select
                          value={newEmpDept}
                          onChange={(e) => setNewEmpDept(e.target.value as any)}
                          className="h-10 w-full rounded-xl bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Operations">Operations</option>
                          <option value="Finance">Finance</option>
                          <option value="Customer Support">Customer Support</option>
                          <option value="Engineering">Engineering</option>
                          <option value="Executive">Executive</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Position Title *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          placeholder="e.g. Dispatch Ops Specialist"
                          value={newEmpPosition}
                          onChange={(e) => setNewEmpPosition(e.target.value)}
                          isRequired
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">Monthly Salary (₦)</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="number"
                          value={newEmpSalary}
                          onChange={(e) => setNewEmpSalary(e.target.value)}
                          startContent={<span className="text-sm font-semibold text-muted">₦</span>}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted">Employment Type</label>
                    <div className="mt-1">
                      <select
                        value={newEmpType}
                        onChange={(e) => setNewEmpType(e.target.value as any)}
                        className="h-10 w-full rounded-xl bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="Full-Time">Full-Time</option>
                        <option value="Contract">Contract</option>
                        <option value="Probation">Probation</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4">
                  <AppButton variant="outline" onPress={() => setIsNewEmployeeOpen(false)}>
                    Cancel
                  </AppButton>
                  <AppButton variant="primary" type="submit">
                    Onboard Staff
                  </AppButton>
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* CREATE EXPENSE MODAL: HeroUI Compound centered in middle */}
      <Modal>
        <Modal.Backdrop
          isOpen={isNewExpenseOpen}
          onOpenChange={setIsNewExpenseOpen}
        >
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <form onSubmit={handleCreateExpense}>
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Submit Petty Cash Claim</h3>
                    <p className="mt-1 text-xs text-muted">
                      Operational expenditure reimbursement request
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewExpenseOpen(false)}
                    className="rounded-lg p-1.5 text-muted hover:bg-muted"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Claiming Staff</label>
                      <div className="mt-1">
                        <select
                          value={newExpEmp}
                          onChange={(e) => setNewExpEmp(e.target.value)}
                          className="h-10 w-full rounded-xl bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.fullName}>{emp.fullName} ({emp.department})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">Category</label>
                      <div className="mt-1">
                        <select
                          value={newExpCategory}
                          onChange={(e) => setNewExpCategory(e.target.value as any)}
                          className="h-10 w-full rounded-xl bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Fuel & Logistics">Fuel & Logistics</option>
                          <option value="Emergency Fleet Op">Emergency Fleet Op</option>
                          <option value="Office Supplies">Office Supplies</option>
                          <option value="Client Entertainment">Client Entertainment</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Amount (₦) *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="number"
                          value={newExpAmount}
                          onChange={(e) => setNewExpAmount(e.target.value)}
                          startContent={<span className="text-sm font-semibold text-muted">₦</span>}
                          isRequired
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">Receipt / Invoice Ref *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          placeholder="e.g. RCP-2026-991"
                          value={newExpReceipt}
                          onChange={(e) => setNewExpReceipt(e.target.value)}
                          isRequired
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted">Operational Justification *</label>
                    <div className="mt-1">
                      <AppTextarea
                        label=""
                        placeholder="Detail the business justification and items purchased..."
                        value={newExpJustification}
                        onChange={(e) => setNewExpJustification(e.target.value)}
                        isRequired
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4">
                  <AppButton variant="outline" onPress={() => setIsNewExpenseOpen(false)}>
                    Cancel
                  </AppButton>
                  <AppButton variant="primary" type="submit">
                    Submit Claim
                  </AppButton>
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* CREATE LEAVE MODAL: HeroUI Compound centered in middle */}
      <Modal>
        <Modal.Backdrop
          isOpen={isNewLeaveOpen}
          onOpenChange={setIsNewLeaveOpen}
        >
          <Modal.Container placement="center" size="lg">
            <Modal.Dialog className="rounded-3xl bg-overlay p-7">
              <form onSubmit={handleCreateLeave}>
                <div className="flex items-center justify-between pb-4">
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">Submit Leave Sign-Off</h3>
                    <p className="mt-1 text-xs text-muted">
                      Staff absence and coverage request
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewLeaveOpen(false)}
                    className="rounded-lg p-1.5 text-muted hover:bg-muted"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Staff Member</label>
                      <div className="mt-1">
                        <select
                          value={newLevEmp}
                          onChange={(e) => setNewLevEmp(e.target.value)}
                          className="h-10 w-full rounded-xl bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {employees.map((emp) => (
                            <option key={emp.id} value={emp.fullName}>{emp.fullName}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">Leave Classification</label>
                      <div className="mt-1">
                        <select
                          value={newLevType}
                          onChange={(e) => setNewLevType(e.target.value as any)}
                          className="h-10 w-full rounded-xl bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="Annual">Annual Paid Leave</option>
                          <option value="Sick">Sick / Medical Leave</option>
                          <option value="Maternity/Paternity">Maternity / Paternity</option>
                          <option value="Compassionate">Compassionate</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="text-xs font-medium text-muted">Start Date *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="date"
                          value={newLevStart}
                          onChange={(e) => setNewLevStart(e.target.value)}
                          isRequired
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted">End Date *</label>
                      <div className="mt-1">
                        <AppInput
                          label=""
                          type="date"
                          value={newLevEnd}
                          onChange={(e) => setNewLevEnd(e.target.value)}
                          isRequired
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted">Coverage Handover & Notes</label>
                    <div className="mt-1">
                      <AppTextarea
                        label=""
                        placeholder="Detail handover arrangements, emergency contacts, or tickets covered..."
                        value={newLevNotes}
                        onChange={(e) => setNewLevNotes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3 pt-4">
                  <AppButton variant="outline" onPress={() => setIsNewLeaveOpen(false)}>
                    Cancel
                  </AppButton>
                  <AppButton variant="primary" type="submit">
                    Submit Leave Request
                  </AppButton>
                </div>
              </form>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Confirmation Alert Dialog */}
      {pendingApproval && (
        <Modal
          isOpen={Boolean(pendingApproval)}
          onOpenChange={(open) => !open && setPendingApproval(null)}
        >
          <Modal.Backdrop variant="blur">
            <Modal.Container placement="center" size="md">
              <Modal.Dialog className="rounded-3xl bg-overlay p-7 w-full max-w-md">
                <div className="flex items-start gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-success-soft text-success">
                    <CheckCircle size={24} weight="duotone" />
                  </div>
                  <div>
                    <h3 className="text-[18px] font-bold tracking-[-0.02em] text-foreground">
                      {pendingApproval.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted leading-relaxed">
                      {pendingApproval.description}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-3">
                  <AppButton
                    variant="ghost"
                    label="Cancel"
                    onPress={() => setPendingApproval(null)}
                  />
                  <AppButton
                    variant="primary"
                    label={pendingApproval.confirmLabel}
                    onPress={() => {
                      const action = pendingApproval.onConfirm;
                      setPendingApproval(null);
                      action();
                    }}
                  />
                </div>
              </Modal.Dialog>
            </Modal.Container>
          </Modal.Backdrop>
        </Modal>
      )}
    </Page>
  );
}
