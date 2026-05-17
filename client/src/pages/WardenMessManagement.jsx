import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { 
  Landmark, 
  Settings, 
  RotateCw, 
  Folder, 
  BarChart3, 
  ChefHat, 
  Sliders, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Lock, 
  Unlock,
  AlertTriangle, 
  Save, 
  Download, 
  Bell, 
  Search,
  Sparkles,
  PenSquare,
  History,
  Plane,
  XOctagon,
  Calendar,
  LockKeyhole
} from 'lucide-react';

export default function WardenMessManagement() {
  const { user } = useContext(AuthContext);
  const [counts, setCounts] = useState(null);
  const [loadingCounts, setLoadingCounts] = useState(true);

  // Billing Cycle States
  const [cycles, setCycles] = useState([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Audit Logs & Master Ledger
  const [auditLogs, setAuditLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('cycles'); // 'cycles', 'ledger', 'audit', 'kitchen', 'overrides'

  // Create Cycle State
  const [targetMonth, setTargetMonth] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);

  // Fee Config States
  const [feeConfig, setFeeConfig] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState({
    hostelRent: 3000,
    maintenanceFee: 500,
    electricityFee: 300,
    messMealRate: 50,
    lateFineAmount: 200
  });

  // Invoice Adjustment Modal States
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    discount: 0,
    fine: 0,
    adjustments: 0,
    adjustmentNotes: '',
    reason: ''
  });
  const [savingAdjustments, setSavingAdjustments] = useState(false);

  // Invoice Timeline Modal State
  const [timelineInvoice, setTimelineInvoice] = useState(null);

  // Refund Modal State (Admin only)
  const [refundInvoiceObj, setRefundInvoiceObj] = useState(null);
  const [refundForm, setRefundForm] = useState({ refundAmount: 0, reason: '' });
  const [refunding, setRefunding] = useState(false);

  // Unpaid Students State
  const [unpaidList, setUnpaidList] = useState([]);
  const [loadingUnpaid, setLoadingUnpaid] = useState(true);

  // Reminder trigger cooling state
  const [sendingReminderId, setSendingReminderId] = useState(null);

  // Kitchen Prep Planning & Manual Freeze States
  const [freezeDate, setFreezeDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [freezingLedger, setFreezingLedger] = useState(false);

  // Manual Overrides States
  const [studentsList, setStudentsList] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    studentId: '',
    date: new Date().toISOString().split('T')[0],
    breakfastIncluded: true,
    lunchIncluded: true,
    dinnerIncluded: true,
    reason: ''
  });
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Live Revenue Analytics States
  const [paymentAnalytics, setPaymentAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Global Transaction Ledger States
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Receipt Modal States
  const [receiptDetail, setReceiptDetail] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    fetchTomorrowCounts();
    fetchBillingCycles();
    fetchUnpaidDues();
    fetchFeeConfig();
    fetchMasterLedgerAndAudits();
    fetchStudents();
    fetchPaymentAnalytics();
  }, []);

  const fetchPaymentAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await api.get('/payments/analytics');
      setPaymentAnalytics(res.data.analytics);
    } catch (err) {
      console.warn('Analytics loading failed:', err.message);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const openReceiptModal = async (paymentId) => {
    setLoadingReceipt(true);
    try {
      const res = await api.get(`/mess/receipts/${paymentId}`);
      setReceiptDetail(res.data.receipt);
    } catch (error) {
      toast.error('Failed to load transaction receipt.');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const fetchTomorrowCounts = async () => {
    setLoadingCounts(true);
    try {
      const res = await api.get('/mess/tomorrow-counts');
      const hostelCounts = res.data.counts.find(c => c._id === user.hostelId?._id || c._id === user.hostelId);
      setCounts(hostelCounts || res.data.counts[0] || null);
    } catch (error) {
      toast.error('Failed to load kitchen meal counts.');
    } finally {
      setLoadingCounts(false);
    }
  };

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await api.get('/students');
      setStudentsList(res.data.students || []);
    } catch (error) {
      console.log('Failed to fetch students', error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const triggerManualFreeze = async () => {
    setFreezingLedger(true);
    try {
      const res = await api.post('/mess/freeze-meals', { date: freezeDate });
      toast.success(res.data.message);
      fetchTomorrowCounts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Manual freeze failed.');
    } finally {
      setFreezingLedger(false);
    }
  };

  const submitManualOverride = async (e) => {
    e.preventDefault();
    if (!overrideForm.studentId) {
      toast.error('Please select a resident student.');
      return;
    }
    if (!overrideForm.reason || overrideForm.reason.trim().length < 5) {
      toast.error('Descriptive override explanation (at least 5 characters) is required.');
      return;
    }
    setSubmittingOverride(true);
    try {
      const res = await api.post('/mess/override-meals', overrideForm);
      toast.success(res.data.message);
      setOverrideForm({
        ...overrideForm,
        reason: ''
      });
      fetchTomorrowCounts();
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Override update rejected.');
    } finally {
      setSubmittingOverride(false);
    }
  };

  const fetchFeeConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/mess/fee-config');
      if (res.data.config) {
        setFeeConfig(res.data.config);
        setConfigForm(prev => ({ ...prev, ...res.data.config }));
        if (res.data.isDefault) {
          toast('ℹ️ Using default rates. Set custom fee configuration in pricing settings.', { icon: '⚙️' });
        }
      }
    } catch (error) {
      // Non-blocking: config is optional, defaults are used server-side
      console.warn('Fee config load failed, defaults will be used:', error.message);
    } finally {
      setLoadingConfig(false);
    }
  };

  const saveFeeConfig = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/mess/fee-config', configForm);
      toast.success(res.data.message);
      setFeeConfig(res.data.config);
      setShowConfigModal(false);
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update fee parameters.');
    }
  };

  const fetchBillingCycles = async () => {
    setLoadingCycles(true);
    try {
      const res = await api.get('/mess/billing-cycles');
      setCycles(res.data.cycles || []);
    } catch (error) {
      console.warn('Billing cycles load failed:', error.message);
      setCycles([]);
    } finally {
      setLoadingCycles(false);
    }
  };

  const fetchMasterLedgerAndAudits = async () => {
    setLoadingTransactions(true);
    try {
      const res = await api.get('/mess/ledger');
      setAuditLogs(res.data.auditLogs || []);
      setTransactions(res.data.transactions || res.data.payments || []);
    } catch (error) {
      console.log('Failed to fetch ledger logs', error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Fetch list of students with outstanding dues for the Ledger tab
  const fetchUnpaidDues = async () => {
    setLoadingUnpaid(true);
    try {
      const studentRes = await api.get('/students');
      const students = studentRes.data.students || [];

      const unpaidRecords = [];
      await Promise.all(students.map(async (student) => {
        try {
          const dueRes = await api.get(`/mess/dues/${student._id}`);
          let pendingTotal = 0;
          (dueRes.data.invoices || []).forEach(inv => {
            if (inv.status !== 'PAID') {
              pendingTotal += Math.max(0, (inv.totalAmount || 0) - (inv.amountPaid || 0));
            }
          });
          if (pendingTotal > 0) {
            unpaidRecords.push({
              studentId: student._id,
              fullName: student.fullName,
              room: student.roomId?.roomNumber || 'Unassigned',
              admissionNumber: student.admissionNumber,
              pendingAmount: pendingTotal,
              financialHold: dueRes.data.financialHold
            });
          }
        } catch (err) {
          // Skip individual student errors silently
        }
      }));

      setUnpaidList(unpaidRecords.sort((a, b) => b.pendingAmount - a.pendingAmount));
    } catch (error) {
      console.warn('Unpaid dues fetch failed:', error.message);
      setUnpaidList([]);
    } finally {
      setLoadingUnpaid(false);
    }
  };

  const handleCreateDraftCycle = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.post('/mess/billing-cycles', { month: targetMonth, notes });
      toast.success(res.data.message);
      setNotes('');
      fetchBillingCycles();
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Draft generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const selectCycleForReview = async (cycle) => {
    setSelectedCycle(cycle);
    setLoadingInvoices(true);
    try {
      const res = await api.get(`/mess/billing-cycles/${cycle._id}/invoices`);
      setInvoices(res.data.invoices || []);
    } catch (error) {
      toast.error('Failed to load invoices for this cycle.');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleRegenerateDraft = async (cycleId) => {
    if (!window.confirm('Are you sure you want to re-calculate all draft invoices for this cycle? All custom adjustments will be reset.')) return;
    setLoadingInvoices(true);
    try {
      const res = await api.post(`/mess/billing-cycles/${cycleId}/regenerate`);
      toast.success(res.data.message);
      selectCycleForReview(res.data.cycle);
      fetchBillingCycles();
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Regeneration failed.');
      setLoadingInvoices(false);
    }
  };

  const handleFinalizeCycle = async (cycleId) => {
    if (!window.confirm('CRITICAL GOVERNANCE ACTION: Are you sure you want to finalize this billing cycle? All invoices will be permanently frozen, and payment options will open for students/parents instantly.')) return;
    setLoadingInvoices(true);
    try {
      const res = await api.post(`/mess/billing-cycles/${cycleId}/finalize`);
      toast.success(res.data.message);
      selectCycleForReview(res.data.cycle);
      fetchBillingCycles();
      fetchUnpaidDues();
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Finalization failed.');
      setLoadingInvoices(false);
    }
  };

  const openAdjustmentModal = (invoice) => {
    setEditingInvoice(invoice);
    setAdjustmentForm({
      discount: invoice.discount || 0,
      fine: invoice.fine || 0,
      adjustments: invoice.adjustments || 0,
      adjustmentNotes: invoice.adjustmentNotes || '',
      reason: ''
    });
  };

  const saveInvoiceAdjustments = async (e) => {
    e.preventDefault();
    if (!adjustmentForm.reason || adjustmentForm.reason.trim().length < 5) {
      toast.error('Validation Error: A descriptive audit reason (at least 5 characters) is required.');
      return;
    }
    setSavingAdjustments(true);
    try {
      const res = await api.put(`/mess/invoices/${editingInvoice._id}`, adjustmentForm);
      toast.success(res.data.message);
      setInvoices(prev => prev.map(inv => inv._id === editingInvoice._id ? res.data.invoice : inv));
      setEditingInvoice(null);
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply adjustments.');
    } finally {
      setSavingAdjustments(false);
    }
  };

  const handleSendReminder = async (invoiceId) => {
    const reason = window.prompt("Enter reminder notification audit notes:");
    if (reason === null) return;
    if (reason.trim().length < 5) {
      toast.error("Notification cancelled: A meaningful reminder reason (at least 5 chars) is mandatory.");
      return;
    }

    setSendingReminderId(invoiceId);
    try {
      const res = await api.post('/mess/send-reminder', { invoiceId, reason });
      toast.success(res.data.message);
      if (selectedCycle) {
        selectCycleForReview(selectedCycle);
      }
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send reminder notification.');
    } finally {
      setSendingReminderId(null);
    }
  };

  const openRefundModal = (invoice) => {
    setRefundInvoiceObj(invoice);
    setRefundForm({ refundAmount: invoice.amountPaid, reason: '' });
  };

  const handleRefundInvoice = async (e) => {
    e.preventDefault();
    if (!refundForm.reason || refundForm.reason.trim().length < 5) {
      toast.error("A descriptive reason is mandatory to approve this financial credit refund.");
      return;
    }
    setRefunding(true);
    try {
      const res = await api.post('/mess/refund-invoice', {
        invoiceId: refundInvoiceObj._id,
        refundAmount: Number(refundForm.refundAmount),
        reason: refundForm.reason
      });
      toast.success(res.data.message);
      if (selectedCycle) selectCycleForReview(selectedCycle);
      setRefundInvoiceObj(null);
      fetchMasterLedgerAndAudits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Refund transaction rejected.');
    } finally {
      setRefunding(false);
    }
  };

  const triggerExport = async (reportType) => {
    try {
      const res = await api.get(`/mess/export-report?reportType=${reportType}`);
      const data = res.data.data;
      if (!data || data.length === 0) {
        toast.error("No record data matches this report parameters.");
        return;
      }

      // Convert structural report to CSV string
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(row => 
        Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
      );
      const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Hostel_Financial_${reportType}_Report.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Structural CSV report for ${reportType} generated and downloaded.`);
    } catch (error) {
      toast.error("Failed to generate export file.");
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-sans text-gray-800">
      
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2.5">
            <Landmark className="text-indigo-600" size={24} />
            Financial Governance & ERP Billing Console
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Auditable double-entry accounting controls. Wardens apply minor corrections up to ₹500; Admins finalize runs, set global rates, and process refunds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'ADMIN' ? (
            <button 
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
            >
              <Settings size={14} />
              Configure Baseline Pricing
            </button>
          ) : (
            <div className="bg-slate-50 border px-3 py-1.5 rounded-xl text-[10px] font-bold text-slate-500 flex items-center gap-1">
              <Lock size={12} className="text-slate-400" />
              Rates Config: ADMIN ONLY
            </div>
          )}
          <button 
            onClick={fetchTomorrowCounts}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs shadow transition cursor-pointer"
          >
            <RotateCw size={14} />
            Sync Kitchen Prep Plan
          </button>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex flex-wrap gap-2 border-b pb-2">
        <button 
          onClick={() => setActiveTab('cycles')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'cycles' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <Folder size={14} />
          Monthly Billing Runs
        </button>
        <button 
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'ledger' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <BarChart3 size={14} />
          Outstanding Debts Ledger
        </button>
        <button 
          onClick={() => setActiveTab('kitchen')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'kitchen' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <ChefHat size={14} />
          Kitchen Operations Prep
        </button>
        <button 
          onClick={() => setActiveTab('overrides')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'overrides' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <Sliders size={14} />
          Resident Overrides Ledger
        </button>
        <button 
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <FileText size={14} />
          Master Audit Trail Ledger
        </button>
        <button 
          onClick={() => { setActiveTab('analytics'); fetchPaymentAnalytics(); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <TrendingUp size={14} />
          Live Revenue Analytics
        </button>
        <button 
          onClick={() => { setActiveTab('transactions'); fetchMasterLedgerAndAudits(); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-black text-xs transition cursor-pointer ${
            activeTab === 'transactions' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-155'
          }`}
        >
          <DollarSign size={14} />
          Transaction History Ledger
        </button>
      </div>

      {/* Tab: Kitchen Operations Prep */}
      {activeTab === 'kitchen' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4 lg:col-span-1">
            <h3 className="text-base font-black text-slate-800 flex items-center gap-1.5">
              <Lock size={16} className="text-indigo-500" />
              Freeze Daily Ledgers Manual
            </h3>
            <p className="text-[11px] text-gray-400">
              Locks resident meal plans into the immutable daily ledger immediately.
            </p>
            <div className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-[9px] uppercase text-gray-400 mb-1">Target Date to Freeze</label>
                <input
                  type="date"
                  value={freezeDate}
                  onChange={(e) => setFreezeDate(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2"
                />
              </div>
              <button
                onClick={triggerManualFreeze}
                disabled={freezingLedger}
                className="flex items-center justify-center gap-1.5 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-xl font-bold transition shadow disabled:opacity-50 cursor-pointer"
              >
                <Lock size={14} />
                {freezingLedger ? 'Freezing ledger...' : 'Trigger Manual Freeze Run'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
            <div>
              <h3 className="text-base font-black text-slate-800">Frozen Kitchen Meal Preparation Plan</h3>
              <p className="text-xs text-gray-400">Granular tomorrow prep lists compiled strictly from the locked daily ledger.</p>
            </div>

            {loadingCounts ? (
              <div className="text-center p-8 italic text-gray-400">Reading meal records...</div>
            ) : !counts ? (
              <div className="text-center p-8 italic text-gray-400">No active meal ledger frozen yet for tomorrow.</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-center">
                  <span className="block text-[9px] font-black text-indigo-600 uppercase">Breakfast</span>
                  <strong className="text-3xl font-black text-indigo-700">{counts.breakfastCount || 0}</strong>
                </div>
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center">
                  <span className="block text-[9px] font-black text-green-600 uppercase">Lunch</span>
                  <strong className="text-3xl font-black text-green-700">{counts.lunchCount || 0}</strong>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-center">
                  <span className="block text-[9px] font-black text-amber-600 uppercase">Dinner</span>
                  <strong className="text-3xl font-black text-amber-700">{counts.dinnerCount || 0}</strong>
                </div>
                <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                  <span className="block text-[9px] font-black text-red-600 uppercase">Skipped</span>
                  <strong className="text-2xl font-black text-red-700">{counts.skippedCount || 0}</strong>
                </div>
                <div className="bg-slate-50 border p-4 rounded-xl text-center">
                  <span className="block text-[9px] font-black text-slate-500 uppercase">On Leave</span>
                  <strong className="text-2xl font-black text-slate-700">{counts.leaveCount || 0}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Resident Overrides Ledger */}
      {activeTab === 'overrides' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Sliders size={20} className="text-indigo-600" />
              Resident Meal Override Panel
            </h3>
            <p className="text-xs text-gray-400">Apply custom corrections for early returns, unexpected leaves or special diet entries.</p>
          </div>

          <form onSubmit={submitManualOverride} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-bold text-slate-600 max-w-3xl">
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] uppercase text-gray-400 mb-1">Select Resident Student</label>
                <select
                  value={overrideForm.studentId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, studentId: e.target.value })}
                  className="w-full border rounded-xl px-3 py-2 font-bold focus:outline-indigo-500 bg-white"
                  required
                >
                  <option value="">-- Select Student --</option>
                  {studentsList.map(st => (
                    <option key={st._id} value={st._id}>
                      {st.fullName} ({st.admissionNumber}) - Room {st.roomId?.roomNumber || 'TBA'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={overrideForm.date}
                    onChange={(e) => setOverrideForm({ ...overrideForm, date: e.target.value })}
                    className="w-full border rounded-xl px-3 py-2 font-bold focus:outline-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="bg-slate-50 border p-4 rounded-xl space-y-2">
                <span className="block text-[10px] text-slate-400 uppercase">Granular Inclusion Plan</span>
                <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={overrideForm.breakfastIncluded}
                    onChange={(e) => setOverrideForm({ ...overrideForm, breakfastIncluded: e.target.checked })}
                    className="rounded border text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Breakfast Included
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={overrideForm.lunchIncluded}
                    onChange={(e) => setOverrideForm({ ...overrideForm, lunchIncluded: e.target.checked })}
                    className="rounded border text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Lunch Included
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-black text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={overrideForm.dinnerIncluded}
                    onChange={(e) => setOverrideForm({ ...overrideForm, dinnerIncluded: e.target.checked })}
                    className="rounded border text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  Dinner Included
                </label>
              </div>
            </div>

            <div className="space-y-4 flex flex-col justify-between">
              <div>
                <label className="block text-[9px] uppercase text-red-500 mb-1">Mandatory Correction Audit Reason *</label>
                <textarea
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                  placeholder="Explain exactly why this override correction is requested..."
                  className="w-full border border-red-200 rounded-xl p-3 focus:outline-red-500 bg-red-50/20 font-medium"
                  rows="5"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submittingOverride}
                className="flex items-center justify-center gap-1.5 w-full bg-slate-800 hover:bg-slate-900 text-white py-2.5 rounded-xl font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Save size={14} />
                {submittingOverride ? 'Submitting Override...' : 'Apply Operational Override'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab: Cycles Workspace */}
      {activeTab === 'cycles' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Controls Side Panel */}
          <div className="space-y-6 lg:col-span-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <h3 className="text-base font-black text-slate-800">Generate New Billing Run</h3>
              <p className="text-[11px] text-gray-400">
                Compiles draft invoices based on meal consumed metrics. Values are adjustable prior to Admin lock finalization.
              </p>
              
              <form onSubmit={handleCreateDraftCycle} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Target Month</label>
                  <input
                    type="month"
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    className="w-full border rounded-xl px-3 py-2 focus:outline-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Audit Notes / Comments</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Summer cycle adjustment"
                    className="w-full border rounded-xl px-3 py-2"
                    rows="2"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="flex items-center justify-center gap-1.5 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-xl shadow transition disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles size={14} />
                  {generating ? 'Compiling Invoice Sheets...' : 'Create Draft Invoices'}
                </button>
              </form>
            </div>

            {/* Cycles List */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-4">Cycles History</h3>
              {loadingCycles ? (
                <div className="text-center text-xs text-gray-400 italic py-6">Loading histories...</div>
              ) : cycles.length === 0 ? (
                <div className="text-center text-xs text-gray-400 italic py-6">No historical runs created.</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {cycles.map(cy => (
                    <div 
                      key={cy._id} 
                      onClick={() => selectCycleForReview(cy)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex justify-between items-center ${
                        selectedCycle?._id === cy._id ? 'bg-indigo-50/50 border-indigo-300' : 'bg-white hover:bg-gray-50 border-gray-150'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs text-slate-800">{cy.month}</div>
                        <div className="text-[9px] text-gray-400">{cy.totalStudents} Invoices | Total: ₹{cy.totalAmount}</div>
                      </div>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${
                        cy.status === 'FINALIZED' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }`}>{cy.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Review Sheet Workspace */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-h-[500px]">
              {selectedCycle ? (
                <div className="space-y-6">
                  
                  {/* Action Header */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-2">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Monthly Run: {selectedCycle.month}</h3>
                      <p className="text-[11px] text-gray-400">
                        Status: <strong className="text-indigo-600 uppercase font-black">{selectedCycle.status}</strong> | Generated: {new Date(selectedCycle.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {selectedCycle.status === 'DRAFT' && (
                        <>
                          <button
                            onClick={() => handleRegenerateDraft(selectedCycle._id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold border border-yellow-200 transition cursor-pointer"
                          >
                            <RotateCw size={12} />
                            Re-Run Draft Calculations
                          </button>
                          {user?.role === 'ADMIN' ? (
                            <button
                              onClick={() => handleFinalizeCycle(selectedCycle._id)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold shadow-sm transition cursor-pointer"
                            >
                              <LockKeyhole size={12} />
                              Lock & Finalize Cycle
                            </button>
                          ) : (
                            <span className="flex items-center gap-1 bg-slate-50 border text-slate-400 text-[10px] font-bold px-2 py-1.5 rounded-lg">
                              <Lock size={12} />
                              Finalize: ADMIN ONLY
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Invoices List inside Cycle */}
                  {loadingInvoices ? (
                    <div className="text-center p-12 text-gray-400 italic">Compiling billing records...</div>
                  ) : invoices.length === 0 ? (
                    <div className="text-center p-12 text-gray-400 italic">No invoices compiled.</div>
                  ) : (
                    <div className="overflow-x-auto text-[11px]">
                      <table className="min-w-full divide-y divide-gray-150">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 uppercase font-black text-left">
                            <th className="px-4 py-2">Student</th>
                            <th className="px-4 py-2">Rates Snapshot</th>
                            <th className="px-4 py-2">Adjustments</th>
                            <th className="px-4 py-2">Total Amount</th>
                            <th className="px-4 py-2 text-center">Governance Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-sans">
                          {invoices.map(inv => (
                            <tr key={inv._id} className="hover:bg-gray-50/50">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">{inv.studentSnapshot?.fullName}</div>
                                <div className="text-[9px] text-gray-400">ID: {inv.studentSnapshot?.admissionNumber} | Room {inv.roomSnapshot?.roomNumber}</div>
                                {inv.financialHold && (
                                  <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[8px] px-1.5 py-0.5 rounded font-black mt-1 uppercase">
                                    <AlertTriangle size={10} />
                                    Financial Hold Risk
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 space-y-0.5 text-gray-500">
                                <div>Mess: ₹{inv.messCharges} <span className="text-[9px] text-gray-400">({inv.totalBreakfasts + inv.totalLunches + inv.totalDinners} meals)</span></div>
                                <div>Rent: ₹{inv.hostelRent}</div>
                                <div>Maint & Elec: ₹{inv.maintenanceFee + inv.electricityFee}</div>
                              </td>
                              <td className="px-4 py-3 space-y-0.5">
                                {inv.discount > 0 && <div className="text-green-600">Discount: -₹{inv.discount}</div>}
                                {inv.fine > 0 && <div className="text-red-600">Fine: +₹{inv.fine}</div>}
                                {inv.adjustments !== 0 && <div className="text-indigo-600">Adj: +₹{inv.adjustments}</div>}
                                {inv.adjustmentNotes && <div className="text-[9px] text-gray-400 italic font-medium">"{inv.adjustmentNotes}"</div>}
                              </td>
                              <td className="px-4 py-3 font-black text-slate-800 text-xs">
                                ₹{inv.totalAmount}
                                <div className="text-[9px] text-gray-400 mt-0.5">{inv.status}</div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-center space-x-1 space-y-1">
                                {selectedCycle.status === 'DRAFT' ? (
                                  <button
                                    onClick={() => openAdjustmentModal(inv)}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded border border-indigo-200 text-[10px] cursor-pointer"
                                  >
                                    <PenSquare size={10} />
                                    Adjust Draft
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => setTimelineInvoice(inv)}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold rounded border text-[10px] cursor-pointer"
                                    >
                                      <FileText size={10} />
                                      View Timeline
                                    </button>
                                    
                                    {inv.status !== 'PAID' && (
                                      <button
                                        disabled={sendingReminderId === inv._id}
                                        onClick={() => handleSendReminder(inv._id)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-700 font-bold rounded border border-orange-200 text-[10px] cursor-pointer"
                                      >
                                        <Bell size={10} />
                                        {sendingReminderId === inv._id ? 'Sending...' : 'Remind'}
                                      </button>
                                    )}

                                    {user?.role === 'ADMIN' && inv.amountPaid > 0 && (
                                      <button
                                        onClick={() => openRefundModal(inv)}
                                        className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded border border-red-200 text-[10px] cursor-pointer"
                                      >
                                        <DollarSign size={10} />
                                        Issue Refund
                                      </button>
                                    )}
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 text-gray-400 italic flex flex-col items-center justify-center space-y-2">
                  <Folder size={36} className="text-gray-300 animate-pulse" />
                  <p className="text-sm font-bold text-gray-500">No Active Cycle Selected</p>
                  <p className="text-xs text-gray-400 mt-1">Select a monthly billing cycle from the history panel to audit and adjust invoices.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Tab: Outstanding Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <BarChart3 size={20} className="text-indigo-600" />
                Outstanding Ledgers & Financial Hold List
              </h3>
              <p className="text-xs text-gray-400">
                Residents with outstanding fee balances. Accounts flagged with "Financial Hold" represent severe payment lapses.
              </p>
            </div>
            
            {/* Structural CSV Exporters Panel */}
            <div className="flex flex-wrap gap-2">
              <button 
                onClick={() => triggerExport('UNPAID')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
              >
                <Download size={12} />
                Export Unpaid CSV
              </button>
              <button 
                onClick={() => triggerExport('OVERDUE')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
              >
                <Download size={12} />
                Export Overdue CSV
              </button>
              <button 
                onClick={() => triggerExport('COLLECTIONS')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
              >
                <Download size={12} />
                Export Collections CSV
              </button>
            </div>
          </div>

          {loadingUnpaid ? (
            <div className="text-center p-12 text-gray-400 italic">Auditing outstanding ledger debts...</div>
          ) : unpaidList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 font-bold italic">Excellent! All resident accounts are clear.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-150 text-xs">
                <thead className="bg-gray-50 text-gray-500 font-black uppercase text-left">
                  <tr>
                    <th className="px-6 py-3">Resident Student</th>
                    <th className="px-6 py-3">Admission Number</th>
                    <th className="px-6 py-3">Room Scope</th>
                    <th className="px-6 py-3">ERP Governance Flag</th>
                    <th className="px-6 py-3">Outstanding Payable Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm font-sans font-medium text-gray-600">
                  {unpaidList.map(item => (
                    <tr key={item.studentId} className="hover:bg-gray-50/50">
                      <td className="px-6 py-3 font-bold text-slate-800">{item.fullName}</td>
                      <td className="px-6 py-3 font-mono">{item.admissionNumber}</td>
                      <td className="px-6 py-3 font-bold">Room {item.room}</td>
                      <td className="px-6 py-3">
                        {item.financialHold ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-black px-2.5 py-0.5 rounded uppercase">
                            <AlertTriangle size={12} />
                            FINANCIAL HOLD RISK
                          </span>
                        ) : (
                          <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Dues Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-3 font-black text-red-600 text-base">₹{item.pendingAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Master Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-black text-slate-800">Master Audit Trail Logs</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Unalterable double-entry log of all historical billing cycle creations, finalized actions, rate configuration modifications, Warden adjustments, and refund orders.
            </p>
          </div>

          {auditLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-400 italic">No audit trail records found in this hostel ledger.</div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-150 text-[11px]">
                <thead className="bg-gray-50 text-gray-500 uppercase font-black text-left sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2">Timestamp</th>
                    <th className="px-4 py-2">Authorized Actor</th>
                    <th className="px-4 py-2">ERP Action Type</th>
                    <th className="px-4 py-2">Change Reason / Audit Note</th>
                    <th className="px-4 py-2">IP Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600 font-sans font-medium">
                  {auditLogs.map(log => (
                    <tr key={log._id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{log.actorId?.fullName || 'SYSTEM ENGINE'}</span>
                        <span className="block text-[9px] text-gray-400">{log.actorRole}</span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                          log.actionType === 'BILL_FINALIZED' ? 'bg-green-100 text-green-700' :
                          log.actionType === 'ADJUSTMENT_APPLIED' ? 'bg-indigo-100 text-indigo-700' :
                          log.actionType === 'REFUND_ISSUED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                        }`}>{log.actionType}</span>
                      </td>
                      <td className="px-4 py-2 font-medium italic">"{log.reason}"</td>
                      <td className="px-4 py-2 font-mono text-[9px]">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Live Revenue Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6 animate-fadeIn">
          {loadingAnalytics ? (
            <div className="text-center p-12 text-gray-400 italic">Compiling live transaction metrics...</div>
          ) : !paymentAnalytics ? (
            <div className="text-center p-12 text-gray-400 italic">No payment transactions recorded yet.</div>
          ) : (
            <>
              {/* Analytics Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-gradient-to-br from-green-600 to-emerald-700 p-6 rounded-2xl shadow text-white">
                  <span className="block text-[10px] uppercase font-black tracking-wider text-green-100">Total Collections</span>
                  <strong className="text-3xl font-black block mt-1">₹{paymentAnalytics.totalCollections || 0}</strong>
                  <span className="text-[10px] text-green-50 font-semibold mt-2 block">All verified lifetime transactions</span>
                </div>

                <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-6 rounded-2xl shadow text-white">
                  <span className="block text-[10px] uppercase font-black tracking-wider text-indigo-100">Today's Revenue</span>
                  <strong className="text-3xl font-black block mt-1">₹{paymentAnalytics.todayCollections || 0}</strong>
                  <span className="text-[10px] text-indigo-50 font-semibold mt-2 block">Verified in the last 24 hours</span>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl shadow text-white">
                  <span className="block text-[10px] uppercase font-black tracking-wider text-amber-100">Failed Payments</span>
                  <strong className="text-3xl font-black block mt-1">{paymentAnalytics.failedCount || 0}</strong>
                  <span className="text-[10px] text-amber-50 font-semibold mt-2 block">Incomplete / signature failures</span>
                </div>

                <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-6 rounded-2xl shadow text-white">
                  <span className="block text-[10px] uppercase font-black tracking-wider text-purple-100">Overdue Recovery</span>
                  <strong className="text-3xl font-black block mt-1">₹{paymentAnalytics.overdueRecovery || 0}</strong>
                  <span className="text-[10px] text-purple-50 font-semibold mt-2 block">Balances recovered from past cycles</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Hostel-wise collections breakdown */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm lg:col-span-1 space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Hostel Collections Scope</h3>
                  <div className="space-y-3">
                    {paymentAnalytics.hostelCollections?.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <strong className="text-slate-800 block text-xs">{item.hostelName}</strong>
                          <span className="text-[10px] text-gray-400 font-semibold">{item.activeResidents} active residents</span>
                        </div>
                        <div className="text-right">
                          <strong className="text-green-600 block">₹{item.totalCollected}</strong>
                          <span className="text-[10px] text-red-500 font-bold">₹{item.totalOutstanding} due</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-time verified transaction ledger */}
                <div className="bg-white p-6 rounded-2xl border shadow-sm lg:col-span-2 space-y-4">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Real-Time Transaction Ledger</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-150 text-[10px] font-sans font-medium text-gray-500">
                      <thead>
                        <tr className="bg-slate-50 font-black text-slate-500 uppercase text-left">
                          <th className="px-4 py-2">Date & Time</th>
                          <th className="px-4 py-2">Resident Student</th>
                          <th className="px-4 py-2">Reference ID</th>
                          <th className="px-4 py-2 text-right">Amount</th>
                          <th className="px-4 py-2 text-center">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-sans">
                        {paymentAnalytics.recentPayments?.map(pay => (
                          <tr key={pay._id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 whitespace-nowrap">{new Date(pay.paidAt).toLocaleString()}</td>
                            <td className="px-4 py-2.5">
                              <strong className="text-slate-800 block">{pay.studentId?.fullName}</strong>
                              <span className="text-[9px] text-gray-400">ID: {pay.studentId?.admissionNumber}</span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-indigo-600">{pay.razorpayPaymentId || 'ADMIN CASH'}</td>
                            <td className="px-4 py-2.5 text-right font-black text-green-600">₹{pay.amount}</td>
                            <td className="px-4 py-2.5 text-center">
                              <button
                                onClick={() => openReceiptModal(pay._id)}
                                className="px-2 py-0.5 bg-green-50 hover:bg-green-150 text-green-700 font-bold border border-green-200 rounded text-[9px]"
                              >
                                Download
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab: Transaction History Ledger */}
      {activeTab === 'transactions' && (
        <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <DollarSign size={20} className="text-indigo-600" />
                Complete ERP Financial Transaction History
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {user?.role === 'ADMIN' 
                  ? "Global multi-hostel transaction history stream capturing all online gateway checkouts, partial settlements, and manual cash refunds."
                  : "Hostel-isolated payment transaction registry capturing real-time resident settlements for your specific hostel."
                }
              </p>
            </div>
            <button 
              onClick={fetchMasterLedgerAndAudits}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <RotateCw size={14} />
              Refresh Ledger Logs
            </button>
          </div>

          {loadingTransactions ? (
            <div className="text-center py-20 text-gray-400 italic">Compiling unalterable financial transaction ledgers...</div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-20 text-gray-400 italic flex flex-col items-center justify-center space-y-2">
              <DollarSign size={36} className="text-gray-300 animate-bounce" />
              <p className="text-sm font-bold text-gray-500">No Transaction Records Found</p>
              <p className="text-xs text-gray-400 mt-1">There are no documented payments or settlements recorded in the ledger.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-150 text-xs font-sans font-medium text-gray-500">
                <thead>
                  <tr className="bg-slate-50 font-black text-slate-500 uppercase text-left">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Hostel</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Razorpay ID</th>
                    <th className="px-4 py-3 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-sans">
                  {transactions.map(pay => {
                    let statusBg = 'bg-slate-100 text-slate-700';
                    let statusText = pay.status;

                    if (pay.status === 'SUCCESS') {
                      if (pay.amount < 0) {
                        statusBg = 'bg-red-100 text-red-700 border border-red-200';
                        statusText = 'REFUNDED';
                      } else {
                        statusBg = 'bg-green-100 text-green-700 border border-green-200';
                        statusText = 'PAID';
                      }
                    } else if (pay.status === 'PENDING') {
                      statusBg = 'bg-yellow-100 text-yellow-700 border border-yellow-200';
                      statusText = 'PARTIAL';
                    } else if (pay.status === 'FAILED') {
                      statusBg = 'bg-red-100 text-red-700 border border-red-200';
                      statusText = 'FAILED';
                    }

                    return (
                      <tr key={pay._id} className="hover:bg-slate-50/30">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {pay.paidAt ? new Date(pay.paidAt).toLocaleString() : new Date(pay.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <strong className="text-slate-800 block font-bold">{pay.studentId?.fullName || 'N/A'}</strong>
                          <span className="text-[10px] text-gray-400 block mt-0.5">ID: {pay.studentId?.admissionNumber || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {pay.hostelId?.name || 'Global Shared'}
                        </td>
                        <td className="px-4 py-3 font-semibold text-indigo-600">
                          {pay.invoiceId?.month || 'Direct Payment'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800">
                          <span className={pay.amount < 0 ? 'text-red-600' : 'text-slate-800'}>
                            {pay.amount < 0 ? '-' : ''}₹{Math.abs(pay.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${statusBg}`}>
                            {statusText}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[10px] text-indigo-600">
                          <div>{pay.razorpayPaymentId || 'ADMIN CASH'}</div>
                          <span className="text-[8px] text-gray-400 block font-sans">Order: {pay.razorpayOrderId}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {pay.status === 'SUCCESS' && pay.amount > 0 ? (
                            <button
                              onClick={() => openReceiptModal(pay._id)}
                              className="px-2.5 py-1 bg-green-50 hover:bg-green-150 text-green-700 font-bold border border-green-200 rounded text-[9px] transition"
                            >
                              Download
                            </button>
                          ) : (
                            <span className="text-gray-400 text-[9px] italic font-semibold">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjustments Modal */}
      {editingInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div>
              <h3 className="text-lg font-black text-slate-800">Adjust Draft Invoice</h3>
              <p className="text-xs text-gray-400 mt-1">
                Resident: <strong>{editingInvoice.studentSnapshot?.fullName}</strong> | Original Amount: ₹{editingInvoice.messCharges + editingInvoice.hostelRent + editingInvoice.maintenanceFee + editingInvoice.electricityFee + editingInvoice.previousBalance}
              </p>
              {user?.role === 'WARDEN' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[10px] text-amber-800 font-bold mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                  <span>Governance Warning: Warden corrections are limited to ₹500 per component. Greater overrides will be rejected by server validation.</span>
                </div>
              )}
            </div>

            <form onSubmit={saveInvoiceAdjustments} className="space-y-4 text-xs font-bold text-slate-600">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Discount (-)</label>
                  <input
                    type="number"
                    value={adjustmentForm.discount}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, discount: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Fine (+)</label>
                  <input
                    type="number"
                    value={adjustmentForm.fine}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, fine: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Adjustment (+/-)</label>
                  <input
                    type="number"
                    value={adjustmentForm.adjustments}
                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustments: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase text-gray-400 mb-1">Adjustment Notes / Remarks</label>
                <input
                  type="text"
                  value={adjustmentForm.adjustmentNotes}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, adjustmentNotes: e.target.value })}
                  placeholder="e.g. Granted electrical room discount"
                  className="w-full border rounded p-2 focus:outline-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase text-red-500 mb-1">Mandatory Audit Log Reason *</label>
                <textarea
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  placeholder="Explain exactly why this change is required for public audit accountability..."
                  className="w-full border border-red-200 rounded p-2 focus:outline-red-500 font-medium bg-red-50/20"
                  rows="3"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdjustments}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs shadow cursor-pointer"
                >
                  <Save size={14} />
                  {savingAdjustments ? 'Saving Audit Record...' : 'Save Adjustments'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Timeline Modal */}
      {timelineInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-800">Payment Timeline Tracker</h3>
                <p className="text-xs text-gray-400 mt-1">Invoice month: {timelineInvoice.month} | student: {timelineInvoice.studentSnapshot?.fullName}</p>
              </div>
              <button 
                onClick={() => setTimelineInvoice(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
              {timelineInvoice.paymentTimeline?.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No timeline logs recorded.</p>
              ) : (
                timelineInvoice.paymentTimeline.map((item, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>
                      <div className="w-0.5 flex-1 bg-gray-200 my-1"></div>
                    </div>
                    <div className="pb-4 space-y-1">
                      <strong className="block text-slate-800 text-xs font-black">{item.event}</strong>
                      <span className="block text-[9px] text-gray-400">{new Date(item.date).toLocaleString()}</span>
                      <p className="text-gray-500 font-medium text-[11px] leading-relaxed">"{item.details}"</p>
                      {item.actorRole && (
                        <span className="inline-block bg-slate-100 text-slate-600 text-[8px] font-bold px-1.5 py-0.5 rounded">
                          Role: {item.actorRole}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                type="button"
                onClick={() => setTimelineInvoice(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal (Admin Only) */}
      {refundInvoiceObj && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-md w-full p-6 space-y-4 animate-fadeIn">
            <div>
              <h3 className="text-lg font-black text-red-600 flex items-center gap-2">
                <DollarSign size={20} className="text-red-600" />
                Authorize Credit Refund
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Refunding for resident: <strong>{refundInvoiceObj.studentSnapshot?.fullName}</strong>
              </p>
            </div>

            <form onSubmit={handleRefundInvoice} className="space-y-4 text-xs font-bold text-slate-600">
              <div>
                <label className="block text-[9px] uppercase text-gray-400 mb-1">Authorized Refund Amount (Max: ₹{refundInvoiceObj.amountPaid})</label>
                <input
                  type="number"
                  max={refundInvoiceObj.amountPaid}
                  min={1}
                  value={refundForm.refundAmount}
                  onChange={(e) => setRefundForm({ ...refundForm, refundAmount: Number(e.target.value) })}
                  className="w-full border rounded p-2 focus:outline-red-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase text-red-500 mb-1">Reason for Refund Approval *</label>
                <textarea
                  value={refundForm.reason}
                  onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                  placeholder="Provide precise ledger explanation for this manual refund reconciliation..."
                  className="w-full border border-red-200 rounded p-2 focus:outline-red-500 font-medium"
                  rows="3"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRefundInvoiceObj(null)}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-250 text-gray-700 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={refunding}
                  className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs shadow cursor-pointer"
                >
                  <DollarSign size={14} />
                  {refunding ? 'Reconciling Ledger...' : 'Approve Credit Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic pricing config modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-md w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-black text-slate-800">Set baseline baseline dynamic pricing configs</h3>
              <p className="text-xs text-gray-400">Only Admin possesses credentials to modify standard billing indexes.</p>
            </div>

            <form onSubmit={saveFeeConfig} className="space-y-4 text-xs font-bold text-slate-600">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Hostel Rent</label>
                  <input
                    type="number"
                    value={configForm.hostelRent}
                    onChange={(e) => setConfigForm({ ...configForm, hostelRent: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Maintenance Fee</label>
                  <input
                    type="number"
                    value={configForm.maintenanceFee}
                    onChange={(e) => setConfigForm({ ...configForm, maintenanceFee: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Electricity Fee</label>
                  <input
                    type="number"
                    value={configForm.electricityFee}
                    onChange={(e) => setConfigForm({ ...configForm, electricityFee: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[9px] uppercase text-gray-400 mb-1">Mess meal rate</label>
                  <input
                    type="number"
                    value={configForm.messMealRate}
                    onChange={(e) => setConfigForm({ ...configForm, messMealRate: Number(e.target.value) })}
                    className="w-full border rounded p-2 focus:outline-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] uppercase text-gray-400 mb-1">Overdue Late Fine Amount</label>
                <input
                  type="number"
                  value={configForm.lateFineAmount}
                  onChange={(e) => setConfigForm({ ...configForm, lateFineAmount: Number(e.target.value) })}
                  className="w-full border rounded p-2 focus:outline-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[9px] uppercase text-gray-400 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={configForm.effectiveFrom ? configForm.effectiveFrom.split('T')[0] : ''}
                  onChange={(e) => setConfigForm({ ...configForm, effectiveFrom: e.target.value })}
                  className="w-full border rounded p-2 focus:outline-indigo-500 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs shadow"
                >
                  Save baseline configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Receipt Modal Dialog */}
      {receiptDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-lg w-full p-6 space-y-6">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider bg-green-50 px-2 py-0.5 rounded">SUCCESSFUL TRANSACTION RECEIPT</span>
                <h3 className="text-xl font-black text-gray-855 font-sans tracking-tight mt-1">Smart Hostel ERP Billing</h3>
              </div>
              <button 
                onClick={() => setReceiptDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold font-sans"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 font-sans">
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Resident Name</span>
                <strong className="text-gray-800 text-sm">{receiptDetail.studentId?.fullName}</strong>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Admission number</span>
                <strong className="text-gray-800 text-sm">{receiptDetail.studentId?.admissionNumber}</strong>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Hostel</span>
                <strong className="text-gray-800">{receiptDetail.hostelId?.name || 'Main Hostel'}</strong>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Payment Purpose</span>
                <strong className="text-gray-800 capitalize">{receiptDetail.billType?.replace('_', ' ')} Dues</strong>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 text-xs font-semibold text-gray-600 space-y-2">
              <div className="flex justify-between"><span>Base Charges (Mess + Rent + Maint)</span><span>₹{receiptDetail.amount}</span></div>
              <div className="flex justify-between border-t pt-2 font-black text-gray-855 text-sm"><span>Total Transferred</span><span className="text-green-600">₹{receiptDetail.amount}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-400 font-mono">
              <div>
                <span className="block font-sans">Transaction Reference ID</span>
                <strong>{receiptDetail.razorpayPaymentId || 'Simulated Dev Fallback'}</strong>
              </div>
              <div>
                <span className="block font-sans">Payment Date & Time</span>
                <strong>{new Date(receiptDetail.paidAt).toLocaleString()}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer"
              >
                Print Receipt
              </button>
              <button
                onClick={() => setReceiptDetail(null)}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
