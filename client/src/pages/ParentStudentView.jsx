import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';

export default function ParentStudentView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [messBills, setMessBills] = useState([]); // Legacy backwards compatibility
  const [hostelFees, setHostelFees] = useState([]); // Legacy backwards compatibility
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [financialHold, setFinancialHold] = useState(false);

  // Daily Meal Ledger States
  const [mealRecords, setMealRecords] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Receipt Modal State
  const [receiptDetail, setReceiptDetail] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Real Partial Payment Modal State
  const [partialPayInvoice, setPartialPayInvoice] = useState(null);
  const [partialPayAmount, setPartialPayAmount] = useState('');
  const [initiatingPay, setInitiatingPay] = useState(false);

  // Timeline Tracker State
  const [timelineInvoice, setTimelineInvoice] = useState(null);

  useEffect(() => {
    fetchStudentDetails();

    const handleRefresh = (e) => {
      console.log('[Parent Student View] Live Real-time Refresh Event Triggered:', e.detail);
      fetchStudentDetails();
    };

    window.addEventListener('erp:refresh', handleRefresh);
    window.addEventListener('erp:leaveUpdated', handleRefresh);
    window.addEventListener('erp:complaintUpdated', handleRefresh);
    window.addEventListener('erp:roomTransferred', handleRefresh);
    window.addEventListener('erp:newNotice', handleRefresh);
    window.addEventListener('erp:noticeDeleted', handleRefresh);
    window.addEventListener('erp:noticeUpdated', handleRefresh);

    return () => {
      window.removeEventListener('erp:refresh', handleRefresh);
      window.removeEventListener('erp:leaveUpdated', handleRefresh);
      window.removeEventListener('erp:complaintUpdated', handleRefresh);
      window.removeEventListener('erp:roomTransferred', handleRefresh);
      window.removeEventListener('erp:newNotice', handleRefresh);
      window.removeEventListener('erp:noticeDeleted', handleRefresh);
      window.removeEventListener('erp:noticeUpdated', handleRefresh);
    };
  }, [id]);

  const fetchStudentDetails = async () => {
    try {
      const [studentRes, duesRes, ledgerRes] = await Promise.all([
        api.get(`/parent/student/${id}`),
        api.get(`/mess/dues/${id}`),
        api.get(`/mess/meal-ledger/${id}`)
      ]);
      setData(studentRes.data.data);
      setInvoices(duesRes.data.invoices || []);
      setMessBills(duesRes.data.messBills || []);
      setHostelFees(duesRes.data.hostelFees || []);
      setPayments(duesRes.data.payments || []);
      setFinancialHold(duesRes.data.financialHold || false);
      setMealRecords(ledgerRes.data.records || []);
    } catch (error) {
      toast.error('Failed to load student details');
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const triggerPaymentCheckout = async (invoice, amount) => {
    const payVal = Number(amount);
    if (isNaN(payVal) || payVal <= 0) {
      toast.error('Please enter a valid positive payment amount.');
      return;
    }
    const outstanding = invoice.totalAmount - invoice.amountPaid;
    if (payVal > outstanding) {
      toast.error(`Amount exceeds remaining balance. Max allowed is ₹${outstanding}`);
      return;
    }

    setInitiatingPay(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        toast.error('Failed to load Razorpay Gateway SDK. Check your internet connection.');
        return;
      }

      const res = await api.post('/payments/create-order', {
        invoiceId: invoice._id,
        amount: payVal
      });

      const { keyId, orderId, studentName, studentEmail } = res.data;

      if (keyId === 'mock_key_id') {
        // Safe interactive fallback inside production flow for sandbox environments
        toast.loading('Razorpay key absent. Processing with Sandbox Secure verification...', { id: 'sandbox_pay' });
        setTimeout(async () => {
          try {
            const mockPayId = `pay_mock_${Math.random().toString(36).substring(2, 10)}`;
            const mockSig = `sig_mock_${Math.random().toString(36).substring(2, 10)}`;

            const verifyRes = await api.post('/payments/verify', {
              razorpay_order_id: orderId,
              razorpay_payment_id: mockPayId,
              razorpay_signature: mockSig
            });

            toast.success(verifyRes.data.message, { id: 'sandbox_pay' });
            setPartialPayInvoice(null);
            fetchStudentDetails();
          } catch (err) {
            toast.error(err.response?.data?.message || 'Sandbox verification failed.', { id: 'sandbox_pay' });
          }
        }, 1500);
      } else {
        const options = {
          key: keyId,
          amount: payVal * 100, // in paise
          currency: 'INR',
          name: 'Smart Hostel ERP',
          description: `Combined Monthly Invoice - ${invoice.month}`,
          order_id: orderId,
          handler: async function (response) {
            toast.loading('Securing transaction with server-side signature audits...', { id: 'auditing_pay' });
            try {
              const verifyRes = await api.post('/payments/verify', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });
              toast.success(verifyRes.data.message, { id: 'auditing_pay' });
              setPartialPayInvoice(null);
              fetchStudentDetails();
            } catch (err) {
              toast.error(err.response?.data?.message || 'Payment verification failed.', { id: 'auditing_pay' });
            }
          },
          prefill: {
            name: studentName,
            email: studentEmail
          },
          theme: {
            color: '#4f46e5'
          }
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to initialize online payment checkout.');
    } finally {
      setInitiatingPay(false);
    }
  };

  const handlePayInvoice = (invoice) => {
    setPartialPayInvoice(invoice);
    setPartialPayAmount((invoice.totalAmount - invoice.amountPaid).toFixed(2));
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

  const calculateTotalOutstanding = () => {
    let sum = 0;
    invoices.forEach(inv => {
      if (inv.status !== 'PAID') {
        sum += (inv.totalAmount - inv.amountPaid);
      }
    });
    messBills.forEach(b => { if (b.status === 'PENDING') sum += b.totalAmount; });
    hostelFees.forEach(f => { if (f.status === 'PENDING') sum += f.totalAmount; });
    return sum;
  };

  if (loading) return <div className="p-10 text-center text-gray-500 font-bold italic">Loading student financial records...</div>;
  if (!data) return <div className="p-10 text-center font-bold">Student not found</div>;

  const { student, attendance, leaves, complaints, notices } = data;
  const totalOutstanding = calculateTotalOutstanding();

  // Dynamic status evaluation
  let currentStatus = 'In Hostel';
  let statusColor = 'bg-green-100 text-green-800 border-green-200';
  const activeLeave = leaves?.find(l => l.status === 'APPROVED' && new Date(l.departureDate) <= new Date() && new Date(l.expectedReturnDate) >= new Date());
  
  if (activeLeave) {
    currentStatus = 'On Leave';
    statusColor = 'bg-blue-100 text-blue-800 border-blue-200';
  } else if (attendance?.history?.[0]?.status === 'LATE_RETURN') {
    currentStatus = 'Late Return';
    statusColor = 'bg-amber-100 text-amber-800 border-amber-200';
  }

  // Check for severe overdue alert
  const hasSevereOverdue = totalOutstanding > 10000 || financialHold;
  const hasLateReturnAlert = attendance?.history?.[0]?.status === 'LATE_RETURN';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans pb-12">
      <div className="flex justify-between items-center">
        <Link to="/parent" className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg transition shadow-sm">&larr; Back to Dashboard</Link>
        <span className="text-[10px] uppercase font-black text-indigo-600 tracking-wider bg-indigo-50 px-2.5 py-1 rounded">GUARDIAN PORTAL active</span>
      </div>

      {/* Critical Emergency / Overdue Warning Alert Banners */}
      {(hasSevereOverdue || hasLateReturnAlert || notices?.some(n => n.priority === 'EMERGENCY')) && (
        <div className="space-y-3">
          {hasSevereOverdue && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-red-800 text-xs font-bold flex items-start gap-3 shadow-sm animate-pulse">
              <span className="text-lg">🚨</span>
              <div>
                <strong className="block text-red-900 font-black uppercase tracking-wide">Severe Dues Alert & Hold Warning</strong>
                <p className="font-medium text-red-700 mt-0.5">
                  Outstanding balance exceeds ₹10,000 or has been pending for over 2 months. Account is placed on administrative hold; future outpass leave approvals will be restricted until settled.
                </p>
              </div>
            </div>
          )}

          {hasLateReturnAlert && (
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-amber-800 text-xs font-bold flex items-start gap-3 shadow-sm">
              <span className="text-lg">⚠️</span>
              <div>
                <strong className="block text-amber-900 font-black uppercase tracking-wide">Late Return Attendance flag</strong>
                <p className="font-medium text-amber-700 mt-0.5">
                  Your child was flagged for a late return during the last gate check-in on {new Date(attendance.history[0].date).toLocaleDateString()}. Please monitor leave timings.
                </p>
              </div>
            </div>
          )}

          {notices?.filter(n => n.priority === 'EMERGENCY').map(n => (
            <div key={n._id} className="bg-indigo-50 border border-indigo-200 p-4 rounded-2xl text-indigo-800 text-xs font-bold flex items-start gap-3 shadow-sm">
              <span className="text-lg">📢</span>
              <div>
                <strong className="block text-indigo-900 font-black uppercase tracking-wide">Emergency Announcement: {n.title}</strong>
                <p className="font-medium text-indigo-700 mt-0.5">"{n.content}"</p>
                <span className="text-[9px] text-indigo-400 block mt-1">Published by Warden / Administration</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header profiling summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-xl font-black text-white shadow">
            {student.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-800 tracking-tight">{student.fullName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{student.department || 'B.Tech CS'} | Room: {student.roomId?.roomNumber || 'TBA'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="bg-slate-50 border px-4 py-2 rounded-xl text-center shadow-sm">
            <span className="block text-[9px] uppercase font-bold text-gray-400">Marked Attendance</span>
            <strong className={`text-lg font-black ${attendance.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
              {attendance.percentage}%
            </strong>
          </div>
          <div className="bg-slate-50 border px-4 py-2 rounded-xl text-center shadow-sm">
            <span className="block text-[9px] uppercase font-bold text-gray-400">Total Dues Outstanding</span>
            <strong className={`text-lg font-black ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{totalOutstanding}
            </strong>
          </div>
          <div className={`px-4 py-2 border rounded-xl text-center shadow-sm flex flex-col justify-center ${statusColor}`}>
            <span className="block text-[9px] uppercase font-bold opacity-60">Current Status</span>
            <strong className="text-xs font-black uppercase tracking-wider">{currentStatus}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left 2 Columns: Financial and Attendance monitoring */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section 1: Student Overview & Vital Parameters */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <div>
              <h3 className="text-sm font-black text-gray-800 tracking-tight uppercase flex items-center gap-2">
                <span>👤</span> Student Vital Overview
              </h3>
              <p className="text-[11px] text-gray-400">Verified institutional registration credentials for your child.</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-gray-400 font-bold block text-[9px] uppercase">Admission Number</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">{student.admissionNumber}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-gray-400 font-bold block text-[9px] uppercase">Assigned Hostel</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">{student.hostelId?.name || 'Main Hostel'}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-gray-400 font-bold block text-[9px] uppercase">Room allocation</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">Room {student.roomId?.roomNumber || 'TBA'}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-gray-400 font-bold block text-[9px] uppercase">Academic Dept</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">{student.department || 'Computer Science'}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-gray-400 font-bold block text-[9px] uppercase">Current Semester</span>
                <strong className="text-slate-800 text-xs mt-0.5 block">Semester {student.semester || '4th Semester'}</strong>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border">
                <span className="text-gray-400 font-bold block text-[9px] uppercase">Gender</span>
                <strong className="text-slate-800 text-xs mt-0.5 block uppercase">{student.gender || 'N/A'}</strong>
              </div>
            </div>
          </section>

          {/* Section 2: Attendance monitoring & Monthly Trend */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-6">
            <div>
              <h3 className="text-sm font-black text-gray-800 tracking-tight uppercase flex items-center gap-2">
                <span>📈</span> Attendance Monitoring
              </h3>
              <p className="text-[11px] text-gray-400">Institutionally signed daily gate attendance records with a 6-month historical trend analysis.</p>
            </div>

            {/* Attendance Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="p-3 bg-green-50/50 border border-green-100 rounded-xl">
                <span className="block text-[9px] uppercase font-black text-green-700">Days Present</span>
                <strong className="text-xl font-black text-green-800">{attendance.presentCount || 0}</strong>
              </div>
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl">
                <span className="block text-[9px] uppercase font-black text-red-700">Days Absent</span>
                <strong className="text-xl font-black text-red-800">{attendance.absentCount || 0}</strong>
              </div>
              <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
                <span className="block text-[9px] uppercase font-black text-blue-700">On Official Leave</span>
                <strong className="text-xl font-black text-blue-800">{attendance.onLeaveCount || 0}</strong>
              </div>
              <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                <span className="block text-[9px] uppercase font-black text-amber-700">Late Gate Returns</span>
                <strong className="text-xl font-black text-amber-800">{attendance.lateReturnCount || 0}</strong>
              </div>
            </div>

            {/* Monthly Trend Indicators */}
            <div className="space-y-3.5">
              <h4 className="text-xs font-black text-slate-700">📅 6-Month Attendance Percentage Trend</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attendance.monthlyTrend?.map((item, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border flex flex-col justify-between space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <strong className="text-slate-800">{item.monthName} {item.year}</strong>
                      <span className={`font-black ${item.percentage >= 75 ? 'text-green-600' : 'text-red-500'}`}>{item.percentage}%</span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${item.percentage >= 75 ? 'bg-green-600' : 'bg-red-500'}`}
                        style={{ width: `${item.percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-[9px] text-gray-400 block font-medium">
                      Present: {item.present} | Absent: {item.absent} | Leave: {item.onLeave} | Late Return: {item.lateReturn}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Attendance Logs */}
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-700">📜 Recent Attendance Check-Ins</h4>
              <div className="max-h-[180px] overflow-y-auto pr-1 space-y-2">
                {attendance.history?.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-2">No attendance logs available.</p>
                ) : (
                  attendance.history.map(item => {
                    let badgeColor = 'bg-slate-100 text-slate-700';
                    if (item.status === 'PRESENT') badgeColor = 'bg-green-100 text-green-700';
                    else if (item.status === 'ABSENT') badgeColor = 'bg-red-100 text-red-700';
                    else if (item.status === 'ON_LEAVE') badgeColor = 'bg-blue-100 text-blue-700';
                    else if (item.status === 'LATE_RETURN') badgeColor = 'bg-amber-100 text-amber-700';

                    return (
                      <div key={item._id} className="p-2.5 bg-slate-50 border rounded-xl flex justify-between items-center text-xs font-semibold">
                        <div>
                          <span className="text-slate-800">{new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                          <span className="text-[10px] text-gray-400 block font-normal mt-0.5">Checked by Warden: {item.markedBy?.fullName || 'System'}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${badgeColor}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* Section 3: Billing & Invoices */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-6">
            <div>
              <h3 className="text-sm font-black text-gray-800 tracking-tight uppercase flex items-center gap-2">
                <span>💳</span> Financial Billing & Invoices
              </h3>
              <p className="text-[11px] text-gray-400">Review outstanding combined monthly invoices, discount balances, late fines, and print receipts.</p>
            </div>

            {invoices.length === 0 && messBills.length === 0 && hostelFees.length === 0 ? (
              <div className="text-center py-6 text-gray-400 italic">No combined invoices generated yet.</div>
            ) : (
              <div className="space-y-4">
                {invoices.map(inv => (
                  <div key={inv._id} className="p-4 bg-gray-50 rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-gray-800">{new Date(inv.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                          inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>{inv.status}</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-500 font-medium">
                        <div>Mess: ₹{inv.messCharges} <span className="text-[10px] text-gray-400">({inv.totalBreakfasts + inv.totalLunches + inv.totalDinners} meals)</span></div>
                        <div>Rent: ₹{inv.hostelRent}</div>
                        <div>Maint/Elec: ₹{inv.maintenanceFee + inv.electricityFee}</div>
                        {inv.discount > 0 && <div className="text-green-600 font-bold">Discount: -₹{inv.discount}</div>}
                        {inv.fine > 0 && <div className="text-red-600 font-bold">Late Fine: +₹{inv.fine}</div>}
                      </div>
                      <span className="block text-[9px] text-gray-400">Due Date: {new Date(inv.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right flex flex-col items-end self-stretch md:self-auto gap-1">
                      <div className="text-base font-black text-indigo-600">₹{inv.totalAmount}</div>
                      
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => setTimelineInvoice(inv)}
                          className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded transition"
                        >
                          📜 Timeline
                        </button>
                        {inv.status === 'PAID' ? (
                          <span className="text-[9px] bg-green-150 text-green-800 font-bold px-2.5 py-1 rounded uppercase">PAID</span>
                        ) : (
                          <button
                            disabled={payingInvoice === inv._id}
                            onClick={() => handlePayInvoice(inv)}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded shadow-sm transition"
                          >
                            {payingInvoice === inv._id ? 'Initiating...' : 'Pay Combined Bill'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 4: Frozen Daily Meal Consumption Ledgers */}
          <section className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-black text-gray-800 tracking-tight uppercase flex items-center gap-2">
                <span>🍲</span> Daily Meal Ledger
              </h3>
              <p className="text-[11px] text-gray-400">Immutable day-by-day meal consumption history proving total mess charges with absolute transparency.</p>
            </div>

            {loadingLedger ? (
              <div className="text-center py-4 italic text-gray-400">Reading ledger records...</div>
            ) : mealRecords.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No daily consumption records found.</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {mealRecords.map(rec => (
                  <div key={rec._id} className="p-2.5 bg-gray-50 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-2 text-xs font-bold text-slate-700">
                    <div>
                      <span>{new Date(rec.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      {rec.manuallyModified && (
                        <span className="ml-1 text-[8px] bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded font-black">OVERRIDE</span>
                      )}
                    </div>
                    <div className="flex gap-2.5 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${rec.breakfastIncluded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        🍳 {rec.breakfastIncluded ? 'Included' : 'Skipped'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${rec.lunchIncluded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        🍛 {rec.lunchIncluded ? 'Included' : 'Skipped'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded ${rec.dinnerIncluded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        🍲 {rec.dinnerIncluded ? 'Included' : 'Skipped'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 5: Past Payment Transactions Dues */}
          <section className="bg-white p-6 rounded-2xl border shadow-sm">
            <h3 className="text-xs font-black uppercase text-gray-400 tracking-wider mb-4">Past Payment Transaction Registry</h3>
            {payments.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No successful payment logs recorded.</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full divide-y divide-gray-150">
                  <thead className="bg-gray-50 font-black text-gray-500 uppercase tracking-wider text-left">
                    <tr>
                      <th className="px-4 py-2.5">Date</th>
                      <th className="px-4 py-2.5">Transaction ID</th>
                      <th className="px-4 py-2.5">Purpose</th>
                      <th className="px-4 py-2.5">Amount</th>
                      <th className="px-4 py-2.5 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600 font-sans font-medium">
                    {payments.map(p => (
                      <tr key={p._id}>
                        <td className="px-4 py-2.5 whitespace-nowrap">{new Date(p.paidAt || p.createdAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-mono text-[10px] text-indigo-600">{p.razorpayPaymentId || 'ADMIN CASH'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap capitalize">{p.billType?.replace('_', ' ')} dues</td>
                        <td className="px-4 py-2.5 whitespace-nowrap font-black text-green-600">₹{p.amount}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-center">
                          <button
                            onClick={() => openReceiptModal(p._id)}
                            className="px-2 py-0.5 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 transition font-bold text-[10px]"
                          >
                            📄 Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Leaves, Complaints, Notices */}
        <div className="space-y-8">
          
          {/* Section 6: Leaves and Outpasses */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="font-black text-sm uppercase text-slate-800 tracking-tight flex items-center gap-2">
              <span>✈️</span> Leaves & Outpass monitoring
            </h3>
            <p className="text-[11px] text-gray-400">Approved, pending or historical campus exit passes.</p>
            <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
              {leaves.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">No leaves requested.</p>
              ) : (
                leaves.map((leave, i) => {
                  let badgeColor = 'bg-slate-100 text-slate-700';
                  if (leave.status === 'APPROVED') badgeColor = 'bg-green-100 text-green-700 border-green-200';
                  else if (leave.status === 'PENDING') badgeColor = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                  else if (leave.status === 'REJECTED') badgeColor = 'bg-red-100 text-red-700 border-red-200';

                  return (
                    <div key={i} className="border-b pb-3.5 last:border-0 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-sm font-black text-gray-800">{leave.leaveType}</strong>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase border ${badgeColor}`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-gray-500 font-semibold text-[11px] mt-1">
                        🗓️ {new Date(leave.departureDate).toLocaleDateString()} &rarr; {new Date(leave.expectedReturnDate).toLocaleDateString()}
                      </p>
                      <p className="text-[10px] text-gray-400 font-normal mt-1 leading-relaxed">
                        Reason: "{leave.reason}"
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Section 7: Complaints & Maintenance Log */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="font-black text-sm uppercase text-slate-800 tracking-tight flex items-center gap-2">
              <span>🔧</span> Room Maintenance & Complaints
            </h3>
            <p className="text-[11px] text-gray-400">View resolution states for student-filed room issues.</p>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {complaints.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">No complaints logged.</p>
              ) : (
                complaints.map((c, i) => {
                  let statusColor = 'text-orange-500 bg-orange-50 border-orange-100';
                  if (c.status === 'RESOLVED') statusColor = 'text-green-600 bg-green-50 border-green-100';
                  else if (c.status === 'REJECTED') statusColor = 'text-red-500 bg-red-50 border-red-100';

                  return (
                    <div key={i} className="bg-slate-50 p-3 rounded-xl border space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wide">{c.category}</span>
                        <span className="text-[9px] text-gray-400 font-medium">{new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="text-xs font-black text-gray-750">{c.title}</h4>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-normal">"{c.description}"</p>
                      <span className={`inline-block px-1.5 py-0.5 border rounded font-black text-[8px] uppercase tracking-wider ${statusColor}`}>
                        {c.status}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Section 8: Hostel Broadcast Notices & Alerts */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-4">
            <h3 className="font-black text-sm uppercase text-slate-800 tracking-tight flex items-center gap-2">
              <span>📢</span> Hostel Broadcasts & Notices
            </h3>
            <p className="text-[11px] text-gray-400">Important warden publications and safety notices targeted to your child's hostel.</p>
            <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1">
              {notices?.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">No active broadcasts published.</p>
              ) : (
                notices?.map((n, i) => {
                  let prioColor = 'text-slate-500 bg-slate-50 border-slate-100';
                  if (n.priority === 'EMERGENCY') prioColor = 'text-red-600 bg-red-50 border-red-200 font-black animate-pulse';
                  else if (n.priority === 'IMPORTANT') prioColor = 'text-amber-600 bg-amber-50 border-amber-200';

                  return (
                    <div key={i} className="border-b pb-3.5 last:border-0 space-y-1.5 text-xs">
                      <div className="flex justify-between items-start">
                        <strong className="text-sm font-black text-gray-800 leading-tight">{n.title}</strong>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 border rounded uppercase ${prioColor}`}>
                          {n.priority}
                        </span>
                      </div>
                      <p className="text-gray-500 leading-relaxed text-[11px] font-medium">"{n.content}"</p>
                      <div className="flex justify-between items-center text-[9px] text-gray-400">
                        <span>By: {n.createdBy?.fullName || 'Warden'}</span>
                        <span>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

      </div>

      {/* Payment Timeline Modal */}
      {timelineInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-800">Child Dues Timeline Tracker</h3>
                <p className="text-xs text-gray-400 mt-1">Invoice Month: {timelineInvoice.month} | Student: {student.fullName}</p>
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
                          Authorized Action Role: {item.actorRole}
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

      {/* Downloadable Receipt Dialog */}
      {receiptDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-lg w-full p-6 space-y-6">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider bg-green-50 px-2 py-0.5 rounded">OFFICIAL TRANSACTION RECEIPT</span>
                <h3 className="text-xl font-black text-gray-850 font-sans tracking-tight mt-1">Smart Hostel ERP</h3>
              </div>
              <button onClick={() => setReceiptDetail(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-medium text-gray-500 font-sans">
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Student Resident</span>
                <strong className="text-gray-800 text-sm">{receiptDetail.studentId?.fullName}</strong>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Admission number</span>
                <strong className="text-gray-800 text-sm">{receiptDetail.studentId?.admissionNumber}</strong>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Hostel Scope</span>
                <strong className="text-gray-800">{receiptDetail.hostelId?.name || 'Main Hostel'}</strong>
              </div>
              <div>
                <span className="block text-[9px] uppercase font-bold text-gray-400">Payment Purpose</span>
                <strong className="text-gray-800 capitalize">{receiptDetail.billType.replace('_', ' ')} Dues</strong>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 text-xs font-semibold text-gray-600 space-y-2">
              <div className="flex justify-between"><span>Base Charges (Mess + Rent + Maint)</span><span>₹{receiptDetail.amount}</span></div>
              <div className="flex justify-between border-t pt-2 font-black text-gray-850 text-sm"><span>Total Transferred</span><span className="text-green-600">₹{receiptDetail.amount}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] text-gray-400 font-mono">
              <div>
                <span className="block">Transaction Reference ID</span>
                <strong>{receiptDetail.razorpayPaymentId || 'Simulated SandBox API'}</strong>
              </div>
              <div>
                <span className="block">Payment Date & Time</span>
                <strong>{new Date(receiptDetail.paidAt).toLocaleString()}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition shadow">🖨️ Print Receipt</button>
              <button onClick={() => setReceiptDetail(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-250 text-gray-700 rounded-lg text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Partial / Full Payment Custom Modal */}
      {partialPayInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-indigo-50 animate-fadeIn space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-black text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded">GUARDIAN PAYMENTS</span>
                <h4 className="text-xl font-black text-gray-850 mt-1">Settle Student Dues</h4>
              </div>
              <button
                onClick={() => setPartialPayInvoice(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between"><span>Student Resident:</span><strong className="text-slate-800">{student.fullName}</strong></div>
              <div className="flex justify-between"><span>Combined Bill Month:</span><strong className="text-slate-800">{new Date(partialPayInvoice.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}</strong></div>
              <div className="flex justify-between"><span>Total Invoiced Amount:</span><strong className="text-slate-800">₹{partialPayInvoice.totalAmount}</strong></div>
              <div className="flex justify-between"><span>Paid to Date:</span><strong className="text-green-600 font-bold">₹{partialPayInvoice.amountPaid}</strong></div>
              <div className="flex justify-between border-t pt-2 mt-2 text-sm font-black text-slate-800">
                <span>Remaining Outstanding:</span>
                <span className="text-red-600">₹{(partialPayInvoice.totalAmount - partialPayInvoice.amountPaid).toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Select Amount Option</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPartialPayAmount((partialPayInvoice.totalAmount - partialPayInvoice.amountPaid).toFixed(2))}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    Math.abs(Number(partialPayAmount) - (partialPayInvoice.totalAmount - partialPayInvoice.amountPaid)) < 0.01
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-gray-200'
                  }`}
                >
                  Pay Full Balance
                </button>
                <button
                  type="button"
                  onClick={() => setPartialPayAmount('')}
                  className={`py-2 rounded-xl text-xs font-bold transition border ${
                    Math.abs(Number(partialPayAmount) - (partialPayInvoice.totalAmount - partialPayInvoice.amountPaid)) >= 0.01
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-gray-200'
                  }`}
                >
                  Custom Amount
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Enter Custom Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-black text-sm">₹</span>
                <input
                  type="number"
                  min="1"
                  max={(partialPayInvoice.totalAmount - partialPayInvoice.amountPaid).toFixed(2)}
                  value={partialPayAmount}
                  onChange={(e) => setPartialPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 pr-3 py-2 w-full bg-white border border-gray-200 rounded-xl font-bold text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <span className="text-[10px] text-gray-400 font-semibold block">Transactions clear instantly and auto-update child invoice.</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={initiatingPay}
                onClick={() => setPartialPayInvoice(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={initiatingPay}
                onClick={() => triggerPaymentCheckout(partialPayInvoice, partialPayAmount)}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition flex justify-center items-center gap-1.5"
              >
                {initiatingPay ? (
                  <>
                    <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                    Launching...
                  </>
                ) : (
                  'Secure Checkout'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
