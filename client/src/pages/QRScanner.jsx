import { useState, useRef, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

export default function QRScanner() {
  const [qrToken, setQrToken] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastScan, setLastScan] = useState(null);
  const inputRef = useRef(null);

  // Auto-focus the input so hardware barcode scanners can directly type into it
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!qrToken.trim()) return;

    setProcessing(true);
    try {
      const res = await api.post('/leaves/verify-qr', { qrToken: qrToken.trim() });
      if (res.data.success) {
        toast.success(res.data.message);
        setLastScan({
          success: true,
          action: res.data.action,
          student: res.data.student,
          message: res.data.message,
          time: new Date().toLocaleTimeString()
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Verification Failed');
      setLastScan({
        success: false,
        message: error.response?.data?.message || 'Invalid Token',
        time: new Date().toLocaleTimeString()
      });
    } finally {
      setProcessing(false);
      setQrToken(''); // Clear ready for next scan
      inputRef.current?.focus();
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10">
      <div className="bg-white p-8 rounded shadow border-2 border-gray-200">
        <h2 className="text-2xl font-bold mb-2 text-center">Security QR Verification</h2>
        <p className="text-center text-sm text-gray-500 mb-8">
          Scan the student's QR code or manually enter the token to verify exit/return.
        </p>

        <form onSubmit={handleVerify} className="mb-8">
          <div className="relative">
            <input 
              ref={inputRef}
              type="text" 
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
              placeholder="Waiting for scanner input..."
              className="w-full p-4 text-center font-mono text-lg bg-gray-50 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:ring-0 outline-none"
              disabled={processing}
            />
            {processing && (
              <div className="absolute right-4 top-4">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <button type="submit" className="hidden">Submit</button>
        </form>

        {/* Last Scan Result Display */}
        {lastScan && (
          <div className={`p-4 rounded-lg border text-center ${lastScan.success ? (lastScan.action === 'EXIT' ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-green-50 border-green-200 text-green-800') : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="text-sm font-bold uppercase tracking-wider opacity-70 mb-1">{lastScan.time}</div>
            {lastScan.success ? (
              <>
                <div className="text-2xl font-black mb-1">{lastScan.action === 'EXIT' ? 'EXIT AUTHORIZED' : 'RETURN AUTHORIZED'}</div>
                <div className="text-lg">{lastScan.student}</div>
                <div className="text-sm mt-2 opacity-80">{lastScan.message}</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-black mb-1">ACCESS DENIED</div>
                <div className="text-lg">{lastScan.message}</div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
