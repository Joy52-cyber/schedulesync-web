import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from localStorage on first load
  // In AuthContext.jsx - add this logging
useEffect(() => {
  try {
    const storedToken = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    
    console.log('🔍 AuthContext hydrating:', {
      hasStoredToken: !!storedToken,
      tokenLength: storedToken?.length,
      hasStoredUser: !!storedUser,
      userValid: storedUser ? 'valid JSON' : 'missing'
    });
    
    if (storedToken && storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setToken(storedToken);
      setUser(parsedUser);
      console.log('✅ Auth restored:', { user: parsedUser.email, tokenLength: storedToken.length });
    } else {
      console.log('❌ Auth not restored - missing data');
    }
  } catch (err) {
    console.error("❌ Error restoring auth from storage:", err);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } finally {
    setLoading(false);
  }
}, []);

  const login = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  // ✅ NEW: Helper to update user data without full re-login
  // (Used when Onboarding Wizard completes to save the new username locally)
  const updateUser = (updates) => {
    setUser((prev) => {
      const updatedUser = { ...prev, ...updates };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      return updatedUser;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        logout,
        updateUser, // Exposing this function
        isAuthenticated: !!user && !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    console.warn("useAuth called outside AuthProvider, using defaults");
    // Return safe defaults instead of throwing
    return {
      user: null,
      token: null,
      loading: false,
      login: () => {},
      logout: () => {},
      updateUser: () => {},
      isAuthenticated: false
    };
  }
  return ctx;
}