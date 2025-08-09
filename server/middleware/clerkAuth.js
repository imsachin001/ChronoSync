import { verifyToken } from '@clerk/backend';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
console.log('CLERK_SECRET_KEY:', CLERK_SECRET_KEY);

export const clerkAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    const payload = await verifyToken(token, {
      secretKey: CLERK_SECRET_KEY,
    });

    // Add user info to request
    req.user = {
      id: payload.sub,
      email: payload.email,
      firstName: payload.first_name,
      lastName: payload.last_name,
      fullName: payload.name
    };

    next();
  } catch (error) {
    console.error('Clerk token verification failed:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
}; 