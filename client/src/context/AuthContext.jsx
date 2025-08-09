import React, { createContext, useContext } from 'react';
import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const { isSignedIn, isLoaded, getToken } = useClerkAuth();
  const { user } = useUser();

  const getTokenWrapper = async () => {
    if (isSignedIn) {
      try {
        // Try to get a backend-verifiable token (JWT)
        let token = await getToken();
        if (!token) {
          // Try with a template if you have one set up in Clerk dashboard
          token = await getToken({ template: 'backend' });
        }
        console.log('Clerk token being sent to backend:', token);
        return token;
      } catch (error) {
        console.error('Error getting token:', error);
        return null;
      }
    }
    return null;
  };

  const logout = () => {
    // Clerk handles logout automatically
    // This is just for compatibility with existing code
  };

  const value = {
    isAuthenticated: isSignedIn,
    isLoading: !isLoaded,
    user: user ? {
      id: user.id,
      name: user.fullName,
      email: user.primaryEmailAddress?.emailAddress,
      imageUrl: user.imageUrl
    } : null,
    getToken: getTokenWrapper,
    logout: () => {}
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 