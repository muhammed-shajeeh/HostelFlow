import { useState, useEffect, useContext } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';

export default function StudentBilling() {
  const { user } = useContext(AuthContext);
  
  // Unified invoices, bills & payments state
  const [invoices, setInvoices] = useState([]);
  const [messBills, setMessBills] = useState([]); // Legacy compatibility
  const [hostelFees, setHostelFees] = useState([]); // Legacy compatibility
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [financialHold, setFinancialHold] = useState(false);

  // Meal Ledger States
  const [activeTab, setActiveTab] = useState('billing'); // 'billing', 'ledger'
  const [mealRecords, setMealRecords] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Receipt Modal State
  const [receiptDetail, setReceiptDetail] = useState(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Real Partial Payment Modal State
  const [partialPayInvoice, setPartialPayInvoice] = useState(null);
  const [partialPayAmount, setPartialPayAmount] = useState('');
  const [initiatingPay, setInitiatingPay] = useState(false);

  // Invoice Timeline Modal State
  const [timelineInvoice, setTimelineInvoice] = useState(null);

  useEffect(() => {
    fetchBillingInfo();
    fetchMealLedgerLogs();
  }, []);

  const fetchBillingInfo = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/mess/dues/${user._id}`);
      setInvoices(res.data.invoices || []);
      setMessBills(res.data.messBills || []); // Legacy compatibility
      setHostelFees(res.data.hostelFees || []); // Legacy compatibility
      setPayments(res.data.payments || []);
      setFinancialHold(res.data.financialHold || false);
    } catch (error) {
      toast.error('Failed to load dues & transaction history.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMealLedgerLogs = async () => {
    setLoadingLedger(true);
    try {
      const res = await api.get(`/mess/meal-ledger/${user._id}`);
      setMealRecords(res.data.records || []);
    } catch (error) {
      console.log('Failed to fetch daily meal records', error);
      toast.error('Failed to load daily meal consumption history.');
    } finally {
      setLoadingLedger(false);
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
            fetchBillingInfo();
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
              fetchBillingInfo();
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
    // Add legacy pending dues if any
    messBills.forEach(b => { if (b.status === 'PENDING') sum += b.totalAmount; });
    hostelFees.forEach(f => { if (f.status === 'PENDING') sum += f.totalAmount; });
    return sum;
  };

  if (loading) return <div className="text-center p-12 font-bold text-gray-500 italic">Auditing financial statement balances...</div>;

  const totalOutstanding = calculateTotalOutstanding();

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 font-sans">
      
      {/* Header Profile summary */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">Student Billing Portal</h2>
          <p className="text-sm text-gray-500 mt-1">Audit outstanding combined fee invoices, view dynamic consumption audits, and print receipt logs.</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-right flex flex-col justify-center">
          <span className="block text-[10px] uppercase font-bold text-red-500 tracking-wider">Total Outstanding Balance</span>
          <strong className="text-3xl font-black text-red-600">₹{totalOutstanding}</strong>
        </div>
      </div>

      {/* Financial Hold warning */}
      {financialHold && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-xs font-bold space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-extrabold text-sm">
            <span>⚠️</span> ADMINISTRATIVE FINANCIAL HOLD
          </div>
          <p className="font-medium">
            Due to severe outstanding fee balances older than 2 months or pending totals exceeding ₹10,000, your account has been placed on hold. Future outpass requests and room renewals will be restricted until cleared.
          </p>
        </div>
      )}

      {/* Dues Alert banner */}
      {totalOutstanding > 0 && !financialHold && (
        <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-orange-800 text-xs font-bold flex items-center gap-3">
          <span>⚠️</span>
          <span>Pay outstanding dues before the 10th to avoid late fines. Auto-fine of ₹200 applies thereafter.</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setActiveTab('billing')}
          className={`px-4 py-2 rounded-xl font-black text-xs transition ${
            activeTab === 'billing' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-150'
          }`}
        >
          📂 Combined Invoices
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl font-black text-xs transition ${
            activeTab === 'ledger' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-slate-50 text-slate-500 border border-gray-150'
          }`}
        >
          📅 Daily Meal Consumption logs
        </button>
      </div>

      {activeTab === 'billing' ? (
        <>
          {/* Invoices List */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-gray-800 tracking-tight mb-4">Combined Monthly Invoices</h3>
            {invoices.length === 0 && messBills.length === 0 && hostelFees.length === 0 ? (
              <div className="text-center py-8 text-gray-400 italic">No invoices issued yet.</div>
            ) : (
              <div className="space-y-4">
                {invoices.map(inv => (
                  <div key={inv._id} className="p-4 bg-gray-50 rounded-xl border border-gray-150 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-base text-gray-800">{new Date(inv.month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}</strong>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase ${
                          inv.status === 'PAID' ? 'bg-green-100 text-green-700' :
                          inv.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                        }`}>{inv.status}</span>
                        {inv.financialHold && (
                          <span className="bg-red-100 text-red-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">HOLD</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
                        <div>Mess Charges: <strong className="text-gray-700">₹{inv.messCharges}</strong> ({inv.totalBreakfasts + inv.totalLunches + inv.totalDinners} meals)</div>
                        <div>Hostel Rent: <strong className="text-gray-700">₹{inv.hostelRent}</strong></div>
                        <div>Maintenance & Elec: <strong className="text-gray-700">₹{inv.maintenanceFee + inv.electricityFee}</strong></div>
                        {inv.discount > 0 && <div className="text-green-600 font-bold">Discount: -₹{inv.discount}</div>}
                        {inv.fine > 0 && <div className="text-red-600 font-bold">Late Fine: +₹{inv.fine}</div>}
                        {inv.adjustments !== 0 && <div className="text-indigo-600">Adj: +₹{inv.adjustments}</div>}
                      </div>
                      <span className="block text-[10px] text-gray-400">Due by: {new Date(inv.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="text-right flex flex-col justify-center items-end self-stretch md:self-auto gap-1">
                      <div className="text-lg font-black text-indigo-600">₹{inv.totalAmount}</div>
                      {inv.amountPaid > 0 && inv.status !== 'PAID' && <div className="text-[10px] text-indigo-400 font-bold">Paid: ₹{inv.amountPaid}</div>}
                      
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={() => setTimelineInvoice(inv)}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] px-2.5 py-1 rounded transition"
                        >
                          📜 Timeline
                        </button>
                        {inv.status === 'PAID' ? (
                          <span className="text-[9px] bg-green-150 text-green-800 font-black px-2.5 py-1 rounded uppercase">PAID</span>
                        ) : (
                          <button
                            disabled={payingInvoice === inv._id}
                            onClick={() => handlePayInvoice(inv)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-3 py-1 rounded shadow-sm transition"
                          >
                            {payingInvoice === inv._id ? 'Opening Checkout...' : 'Pay Combined Bill'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Legacy backwards mapping compatibility */}
                {messBills.map(b => (
                  <div key={b._id} className="p-4 bg-yellow-50/30 rounded-xl border border-yellow-100 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm text-gray-800">{b.month} (Mess Legacy)</strong>
                        <span className="text-[9px] bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded">LEGACY</span>
                      </div>
                      <span className="text-xs text-gray-500">Meals skipped: {b.totalMealsSkipped} | Consumed: {b.consumedMeals}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-yellow-700">₹{b.totalAmount}</div>
                      <span className="text-[10px] font-black uppercase text-green-600">{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payment History & Ledger logs */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="text-lg font-black text-gray-800 tracking-tight mb-4">Completed Payments History</h3>
            {payments.length === 0 ? (
              <div className="text-center py-6 text-gray-400 italic">No payment history found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-250 text-xs">
                  <thead className="bg-gray-50 font-black text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 text-left">Paid Date</th>
                      <th className="px-6 py-3 text-left">Transaction Reference</th>
                      <th className="px-6 py-3 text-left">Paid via</th>
                      <th className="px-6 py-3 text-left">Paid Amount</th>
                      <th className="px-6 py-3 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm font-sans font-medium text-gray-600">
                    {payments.map(p => (
                      <tr key={p._id}>
                        <td className="px-6 py-3 whitespace-nowrap">{new Date(p.paidAt).toLocaleDateString()}</td>
                        <td className="px-6 py-3 whitespace-nowrap font-mono text-xs">{p.razorpayPaymentId || 'Simulated SandBox API'}</td>
                        <td className="px-6 py-3 whitespace-nowrap">{p.paymentMethod || 'Online Transfer'}</td>
                        <td className="px-6 py-3 whitespace-nowrap font-black text-green-600">₹{p.amount}</td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => openReceiptModal(p._id)}
                            className="px-3 py-1 bg-green-50 hover:bg-green-150 text-green-700 rounded border border-green-200 transition font-bold text-xs"
                          >
                            📄 Download Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Frozen Daily Meal logs calendar */
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-6">
          <div>
            <h3 className="text-lg font-black text-gray-800 tracking-tight">📅 Immutable Daily Meal Ledger logs</h3>
            <p className="text-xs text-gray-400 mt-0.5">Transparent list showing daily choices and lock-in reason logs to verify exact invoice totals.</p>
          </div>

          {loadingLedger ? (
            <div className="text-center py-8 text-gray-400 italic">Reading ledger logs...</div>
          ) : mealRecords.length === 0 ? (
            <div className="text-center py-8 text-gray-400 italic">No frozen daily meal logs compiled yet.</div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {mealRecords.map(rec => (
                <div key={rec._id} className="p-3 bg-gray-50 border rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div>
                    <strong className="text-xs text-slate-800">{new Date(rec.date).toLocaleDateString('default', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                    {rec.manuallyModified && (
                      <span className="ml-2 inline-block bg-yellow-100 text-yellow-800 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">🛠️ Corrected Override</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <span>🍳 Breakfast:</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${rec.breakfastIncluded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {rec.breakfastIncluded ? '✓ Included' : '✗ Skipped'}
                      </span>
                      <span className="text-[9px] text-gray-400">({rec.breakfastReason})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>🍛 Lunch:</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${rec.lunchIncluded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {rec.lunchIncluded ? '✓ Included' : '✗ Skipped'}
                      </span>
                      <span className="text-[9px] text-gray-400">({rec.lunchReason})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span>🍲 Dinner:</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${rec.dinnerIncluded ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {rec.dinnerIncluded ? '✓ Included' : '✗ Skipped'}
                      </span>
                      <span className="text-[9px] text-gray-400">({rec.dinnerReason})</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invoice Timeline Modal */}
      {timelineInvoice && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-lg w-full p-6 space-y-4 animate-fadeIn">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-800">Your Payment Timeline Tracker</h3>
                <p className="text-xs text-gray-400 mt-1">Invoice month: {timelineInvoice.month}</p>
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
                          Issuer: {item.actorRole}
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

      {/* Receipt Modal Dialog */}
      {receiptDetail && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border max-w-lg w-full p-6 space-y-6">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-green-600 tracking-wider bg-green-50 px-2 py-0.5 rounded">SUCCESSFUL TRANSACTION RECEIPT</span>
                <h3 className="text-xl font-black text-gray-850 font-sans tracking-tight mt-1">Smart Hostel ERP Billing</h3>
              </div>
              <button 
                onClick={() => setReceiptDetail(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
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
                <strong>{receiptDetail.razorpayPaymentId || 'Simulated Dev Fallback'}</strong>
              </div>
              <div>
                <span className="block">Payment Date & Time</span>
                <strong>{new Date(receiptDetail.paidAt).toLocaleString()}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow transition"
              >
                🖨️ Print Receipt
              </button>
              <button
                onClick={() => setReceiptDetail(null)}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-200 text-gray-700 rounded-lg text-xs"
              >
                Close
              </button>
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
                <span className="text-[10px] uppercase font-black text-indigo-600 tracking-wider bg-indigo-50 px-2 py-0.5 rounded">INITIATE TRANSACTION</span>
                <h4 className="text-xl font-black text-gray-850 mt-1">Hostel & Mess Payments</h4>
              </div>
              <button
                onClick={() => setPartialPayInvoice(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border space-y-1.5 text-xs text-slate-600">
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
              <span className="text-[10px] text-gray-400 font-semibold block">Custom partial payments will automatically update invoice status to PARTIAL.</span>
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
