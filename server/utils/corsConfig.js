const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://localhost',         // Capacitor Android WebView container
  'https://localhost',        // Capacitor Android Secure WebView container (CRITICAL MOBILITY FIX)
  'capacitor://localhost',    // Capacitor iOS WebView container
  'https://myhostelflow.vercel.app',
  'https://hostelflow-seven.vercel.app'
];

// Dynamically capture custom frontend URL if configured in server env
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL.trim().replace(/\/$/, ''));
}

// Institutional production deployment domain fallback
allowedOrigins.push('https://hostelflow-seven.vercel.app');

/**
 * Checks if the request origin matches the security whitelist
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true; // Allow requests with no origin (e.g. mobile apps, server-to-server, postman)
  
  const cleanOrigin = origin.trim().replace(/\/$/, '');
  
  // Exact match evaluation
  if (allowedOrigins.includes(cleanOrigin)) return true;
  
  // Dynamic Vercel preview branches/deployments adaptation
  if (cleanOrigin.endsWith('.vercel.app')) return true;
  
  return false;
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers choke on 204
};

module.exports = {
  allowedOrigins,
  isOriginAllowed,
  corsOptions
};
