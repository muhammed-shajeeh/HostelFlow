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

  // Simulated Payment Sandbox States
  const [showSimulatedModal, setShowSimulatedModal] = useState(false);
  const [simulatedPaymentData, setSimulatedPaymentData] = useState(null);
  const [simulatingSuccess, setSimulatingSuccess] = useState(false);

  // Timeline Tracker State
  const [timelineInvoice, setTimelineInvoice] = useState(null);

  useEffect(() => {
    fetchStudentDetails();
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

  const handlePayInvoice = async (invoice) => {
    setPayingInvoice(invoice._id);
    try {
      const res = await api.post('/mess/pay-invoice', { invoiceId: invoice._id });
      const { key, amount, orderId, studentName, studentEmail } = res.data;

      if (key === 'mock_key_id') {
        setSimulatedPaymentData({ orderId, amount: amount / 100, invoiceId: invoice._id, invoice });
        setShowSimulatedModal(true);
      } else {
        const options = {
          key,
          amount,
          currency: 'INR',
          name: 'Smart Hostel ERP',
          description: `Combined Monthly Invoice - ${invoice.month}`,
          order_id: orderId,
          handler: async function (response) {
            try {
              const verifyRes = await api.post('/mess/verify-invoice', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });
              toast.success(verifyRes.data.message);
              fetchStudentDetails();
            } catch (err) {
              toast.error('Verification failed: payment might be delayed.');
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
      toast.error(error.response?.data?.message || 'Payment initiation failed.');
    } finally {
      setPayingInvoice(null);
    }
  };

  const submitSimulatedPayment = async (success = true) => {
    setSimulatingSuccess(true);
    try {
      if (!success) {
        toast.error('Simulated transaction failed.');
        setShowSimulatedModal(false);
        return;
      }

      const mockPaymentId = `pay_mock_${Math.random().toString(36).substring(2, 10)}`;
      const mockSignature = `sig_mock_${Math.random().toString(36).substring(2, 10)}`;

      const res = await api.post('/mess/verify-invoice', {
        razorpay_order_id: simulatedPaymentData.orderId,
        razorpay_payment_id: mockPaymentId,
        razorpay_signature: mockSignature
      });

      toast.success(res.data.message);
      setShowSimulatedModal(false);
      fetchStudentDetails();
    } catch (error) {
      toast.error('Simulated verification failed');
    } finally {
      setSimulatingSuccess(false);
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

  const { student, attendance, leaves, complaints } = data;
  const totalOutstanding = calculateTotalOutstanding();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 font-sans pb-12">
      <Link to="/parent/dashboard" className="text-indigo-600 font-bold hover:underline mb-2 inline-block">&larr; Back to Dashboard</Link>
      
      {/* Financial Hold Warning Banner for Parents */}
      {financialHold && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-xs font-bold space-y-1">
          <div className="flex items-center gap-2 text-red-700 font-extrabold text-sm">
            <span>⚠️</span> GUARDIAN FINANCIAL DUES WARNING
          </div>
          <p className="font-medium">
            This student's account is currently flagged on <strong>Administrative Financial Hold</strong> due to balances older than 2 months or pending outstanding amounts exceeding ₹10,000. Kindly settle dues to restore outpass leave approvals.
          </p>
        </div>
      )}

      {/* Header profiling summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-black text-indigo-600">
            {student.fullName.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-800 tracking-tight">{student.fullName}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{student.department} | Admission ID: {student.admissionNumber}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="bg-gray-50 px-4 py-2 rounded-xl border text-center">
            <span className="block text-[9px] uppercase font-bold text-gray-400">Attendance</span>
            <strong className={`text-xl font-black ${attendance.percentage >= 75 ? 'text-green-600' : 'text-red-600'}`}>
              {attendance.percentage}%
            </strong>
          </div>
          <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-center">
            <span className="block text-[9px] uppercase font-bold text-red-500">Outstanding Balance</span>
            <strong className="text-xl font-black text-red-600">₹{totalOutstanding}</strong>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Dues, Payments & Ledgers */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Fee & Billing Portal */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border space-y-6">
            <div>
              <h3 className="text-lg font-black text-gray-800 tracking-tight flex items-center gap-2">
                <span>💳</span> Child Fee & Billing Portal
              </h3>
              <p className="text-xs text-gray-400 mt-1">Review active invoices, variable mess charges, and complete pending payments securely online.</p>
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
                        {inv.discount > 0 && <div className="text-green-600">Discount: -₹{inv.discount}</div>}
                        {inv.fine > 0 && <div className="text-red-600">Late Fine: +₹{inv.fine}</div>}
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
                          <span className="text-[9px] bg-green-100 text-green-800 font-bold px-2 py-1 rounded uppercase">PAID</span>
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

          {/* Frozen Daily Meal logs calendar for parents */}
          <section className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-gray-800 tracking-tight flex items-center gap-2">
                <span>📅</span> Immutable Daily Meal Ledger logs
              </h3>
              <p className="text-[11px] text-gray-400">Day-by-day frozen consumption records verifying total mess charges.</p>
            </div>

            {loadingLedger ? (
              <div className="text-center py-4 italic text-gray-400">Reading records...</div>
            ) : mealRecords.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No daily consumption records found.</p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
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

          {/* Payments transaction records */}
          <section className="bg-white p-6 rounded-2xl border shadow-sm">
            <h3 className="text-sm font-black uppercase text-gray-400 tracking-wider mb-4">Transaction Dues History</h3>
            {payments.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-4">No successful payment logs recorded.</p>
            ) : (
              <div className="overflow-x-auto text-xs">
                <table className="min-w-full divide-y divide-gray-150">
                  <thead className="bg-gray-50 font-black text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Ref ID</th>
                      <th className="px-4 py-2 text-left">Purpose</th>
                      <th className="px-4 py-2 text-left">Amount</th>
                      <th className="px-4 py-2 text-center">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600 font-sans font-medium">
                    {payments.map(p => (
                      <tr key={p._id}>
                        <td className="px-4 py-2 whitespace-nowrap">{new Date(p.paidAt).toLocaleDateString()}</td>
                        <td className="px-4 py-2 whitespace-nowrap font-mono text-[10px]">{p.razorpayPaymentId || 'Simulated Dev Fallback'}</td>
                        <td className="px-4 py-2 whitespace-nowrap capitalize">{p.billType.replace('_', ' ')} dues</td>
                        <td className="px-4 py-2 whitespace-nowrap font-black text-green-600">₹{p.amount}</td>
                        <td className="px-4 py-2 whitespace-nowrap text-center">
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

        {/* Right column: Monitoring lists (Leaves, Complaints) */}
        <div className="space-y-8">
          
          {/* Leaves status overview */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>✈️</span> Recent Leaves Overview
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {leaves.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">No leaves requested.</p>
              ) : (
                leaves.map((leave, i) => (
                  <div key={i} className="border-b pb-2 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-gray-800">{leave.leaveType}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        leave.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 
                        leave.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                      }`}>{leave.status}</span>
                    </div>
                    <p className="text-xs text-gray-500">{new Date(leave.departureDate).toLocaleDateString()} to {new Date(leave.expectedReturnDate).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Complaints logs */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span>🛠️</span> Complaint History Logs
            </h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {complaints.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4 text-center">No complaints logged.</p>
              ) : (
                complaints.map((c, i) => (
                  <div key={i} className="bg-gray-50 p-3 rounded-lg border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-black text-indigo-600 uppercase">{c.category}</span>
                      <span className="text-[9px] text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-semibold text-gray-700 line-clamp-1">{c.title}</p>
                    <p className={`text-[9px] font-bold mt-1 uppercase ${
                      c.status === 'RESOLVED' ? 'text-green-600' : 'text-orange-500'
                    }`}>{c.status}</p>
                  </div>
                ))
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

      {/* Simulated Sandbox Payment Modal */}
      {showSimulatedModal && simulatedPaymentData && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[110] p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full border border-indigo-100">
            <div className="text-center mb-6">
              <div className="inline-block bg-indigo-100 p-3 rounded-full text-indigo-600 text-3xl mb-2">🛡️</div>
              <h4 className="text-xl font-bold text-gray-850">Simulated Guardian checkout</h4>
              <p className="text-xs text-gray-500 mt-1">Development Sandbox Mode. Verify children billing cycle checks.</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border mb-6 text-xs space-y-1.5 text-gray-600">
              <div className="flex justify-between"><span className="text-gray-400">Child name:</span><strong>{student.fullName}</strong></div>
              <div className="flex justify-between border-t mt-2 pt-2"><span className="font-bold text-gray-750">Total Amount:</span><strong className="text-indigo-600 font-extrabold text-base">₹{simulatedPaymentData.amount}</strong></div>
            </div>

            <div className="flex gap-4">
              <button
                disabled={simulatingSuccess}
                onClick={() => submitSimulatedPayment(false)}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 py-2.5 rounded-xl font-bold transition text-xs border border-red-200"
              >
                Cancel payment
              </button>
              <button
                disabled={simulatingSuccess}
                onClick={() => submitSimulatedPayment(true)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-750 text-white py-2.5 rounded-xl font-bold transition text-xs shadow"
              >
                {simulatingSuccess ? 'Confirming authorization...' : 'Authorise payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
