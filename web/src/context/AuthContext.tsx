import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse } from '../types';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  sendRegisterOtp: (email: string, fullName: string, password: string) => Promise<{ message: string; email: string; devOtp?: string }>;
  verifyRegisterOtp: (email: string, otp: string) => Promise<void>;
  resendRegisterOtp: (email: string) => Promise<{ message: string; devOtp?: string }>;
  forgotPassword: (email: string) => Promise<{ message: string; email: string; devOtp?: string }>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<{ message: string }>;
  logout: () => Promise<void>;
  updateUserData: (updated: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await apiClient.get<User>('/users/profile');
          setUser(res.data);
          localStorage.setItem('user', JSON.stringify(res.data));
        } catch {
          // Token expired or invalid
          setUser(null);
          localStorage.removeItem('user');
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/login', { email, password });
    const { user: loggedInUser, accessToken, refreshToken } = res.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const register = async (email: string, fullName: string, password: string) => {
    await apiClient.post('/auth/register', { email, fullName, password });
  };

  const sendRegisterOtp = async (email: string, fullName: string, password: string) => {
    const res = await apiClient.post<{ message: string; email: string }>('/auth/register', {
      email,
      fullName,
      password,
    });
    return res.data;
  };

  const verifyRegisterOtp = async (email: string, otp: string) => {
    const res = await apiClient.post<AuthResponse>('/auth/verify-otp', { email, otp });
    const { user: loggedInUser, accessToken, refreshToken } = res.data;

    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  };

  const resendRegisterOtp = async (email: string) => {
    const res = await apiClient.post<{ message: string }>('/auth/resend-otp', { email });
    return res.data;
  };

  const forgotPassword = async (email: string) => {
    const res = await apiClient.post<{ message: string; email: string; devOtp?: string }>(
      '/auth/forgot-password',
      { email },
    );
    return res.data;
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const res = await apiClient.post<{ message: string }>('/auth/reset-password', {
      email,
      otp,
      newPassword,
    });
    return res.data;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await apiClient.post('/auth/logout', { refreshToken });
      }
    } catch {
      // Ignore logout errors
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      setUser(null);
    }
  };

  const updateUserData = (updated: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const next = { ...prev, ...updated };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        sendRegisterOtp,
        verifyRegisterOtp,
        resendRegisterOtp,
        forgotPassword,
        resetPassword,
        logout,
        updateUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
