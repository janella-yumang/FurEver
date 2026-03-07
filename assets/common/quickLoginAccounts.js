/**
 * Quick Login Accounts - Offline mode
 * These accounts work without database or internet connection
 * Used for local testing and development
 */

export const QUICK_LOGIN_ACCOUNTS = [
  {
    id: 'quick-user-001',
    email: 'user@furever.com',
    name: 'Test User',
    password: 'password123',
    type: 'customer',
    isAdmin: false,
    role: 'customer',
    phone: '09123456789',
    shippingAddress: '123 Test St, Test City',
    preferredPets: ['Dog', 'Cat'],
  },
  {
    id: 'quick-admin-001',
    email: 'admin@furever.com',
    name: 'Test Admin',
    password: 'password123',
    type: 'admin',
    isAdmin: true,
    role: 'admin',
    phone: '09111111111',
    shippingAddress: '456 Admin Ave, Admin City',
    preferredPets: ['Cat'],
  },
];

/**
 * Find quick login account by email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {object|null} - User account or null if not found
 */
export const findQuickLoginAccount = (email, password) => {
  return QUICK_LOGIN_ACCOUNTS.find(
    (account) =>
      account.email.toLowerCase() === email.toLowerCase() &&
      account.password === password
  ) || null;
};

/**
 * Get quick login account by email (without password check)
 * @param {string} email - User email
 * @returns {object|null} - User account or null if not found
 */
export const getQuickLoginAccountByEmail = (email) => {
  return QUICK_LOGIN_ACCOUNTS.find(
    (account) => account.email.toLowerCase() === email.toLowerCase()
  ) || null;
};

/**
 * Generate a mock JWT token for quick login (works offline)
 * Note: This is only for development/testing. In production, always use backend JWT.
 * @param {object} account - Quick login account object
 * @param {string} jwtSecret - JWT secret (local fallback)
 * @returns {string} - Mock JWT token
 */
export const generateOfflineJWT = (account, jwtSecret = 'offline-dev-secret') => {
  // For offline mode, create a simple JWT-like token
  // In production, always use backend-generated tokens
  // Using btoa() instead of Buffer (which doesn't exist in React Native)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      userId: account.id,
      email: account.email,
      name: account.name,
      isAdmin: account.isAdmin,
      role: account.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
    })
  );
  const signature = btoa('offline-mode');
  
  return `${header}.${payload}.${signature}`;
};
