# User Authentication & Security Snippets 🔐

This document contains key, highly readable software engineering snippets representing the core security, authentication, and access control mechanisms of the **HostelFlow** platform.

---

## 1. MongoDB Mongoose User Schema
This snippet defines the database schema for all active users (students, wardens, admins, parents, and security personnel) using **Mongoose ODM**.

```javascript
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['ADMIN', 'WARDEN', 'STUDENT', 'PARENT', 'SECURITY'], 
    required: true 
  },
  emailVerified: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false },
  hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' }
});
```

### 📝 Technical Explanation:
This schema specifies the standard data boundaries for our users. It strictly enforces email uniqueness, role constraints using a string enum, and includes boolean state parameters (`emailVerified`, `isApproved`) to support the **non-bypassable security onboarding workflow**.

---

## 2. Password Hashing with Bcrypt
To guarantee security, user passwords are saved in hashed format using **bcrypt** inside a Mongoose pre-save middleware.

```javascript
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
```

### 📝 Technical Explanation:
This middleware executes automatically before a user document is saved to MongoDB. It checks if the password field has changed (e.g., during registration or password change), generates a cryptographically secure salt, hashes the plain-text password, and replaces it, ensuring no plain-text passwords ever exist in the storage layer.

---

## 3. JWT Token Generation
Upon successful login, a cryptographically signed **JSON Web Token (JWT)** is generated to secure subsequent client HTTP requests.

```javascript
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};
```

### 📝 Technical Explanation:
This utility signs a JWT payload containing the user's database ID and role using a secure server-side signature key (`JWT_SECRET`). The token is returned to the client and expires after 7 days, maintaining a solid balance between user experience and session security.

---

## 4. Protected Route & Role Verification Middleware (RBAC)
This Express middleware verifies incoming JWT credentials and blocks unauthorized roles from calling administrative controllers.

```javascript
const protectAndAuthorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No session token' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access Denied: Role Unauthorized' });
      }
      next();
    } catch (err) {
      return res.status(401).json({ message: 'Session expired or invalid' });
    }
  };
};
```

### 📝 Technical Explanation:
This middleware decodes and verifies the client’s bearer token. If verification passes, it fetches the user details from the database (excluding the password hash) and attaches it to the Express `req.user` context. It then checks if the user's role exists inside `allowedRoles` to either authorize entry or reject with a `403 Forbidden` status.
