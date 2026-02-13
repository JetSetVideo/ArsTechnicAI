import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaGoogle, FaEnvelope } from 'react-icons/fa';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: any) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'google'>('signup');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const handleGoogleSignIn = async () => {
    try {
      // Implement Google OAuth flow
      const response = await fetch('/api/auth/google', { method: 'POST' });
      const googleAuthUrl = await response.json();
      window.location.href = googleAuthUrl;
    } catch (error) {
      console.error('Google Sign-In error', error);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const user = await response.json();
        onAuthSuccess(user);
        onClose();
      } else {
        // Handle registration errors
        const errorData = await response.json();
        alert(errorData.message);
      }
    } catch (error) {
      console.error('Sign-up error', error);
    }
  };

  const renderAuthContent = () => {
    switch (authMode) {
      case 'signup':
        return (
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <input
              type="text"
              placeholder="Username"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              required
              className="w-full p-2 border rounded"
            />
            <input
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              required
              className="w-full p-2 border rounded"
            />
            <input
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              required
              className="w-full p-2 border rounded"
            />
            <button 
              type="submit" 
              className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
            >
              Sign Up
            </button>
          </form>
        );
      
      case 'google':
        return (
          <div className="space-y-4">
            <button 
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center bg-red-500 text-white p-2 rounded hover:bg-red-600"
            >
              <FaGoogle className="mr-2" /> Continue with Google
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          className="bg-white p-8 rounded-lg shadow-xl w-96"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">
              {authMode === 'signup' ? 'Create Account' : 'Sign In with Google'}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="space-y-4 mb-4">
            <button
              onClick={() => setAuthMode('signup')}
              className={`w-full p-2 rounded ${
                authMode === 'signup' ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              <FaEnvelope className="inline mr-2" /> Sign Up with Email
            </button>
            <button
              onClick={() => setAuthMode('google')}
              className={`w-full p-2 rounded ${
                authMode === 'google' ? 'bg-red-100' : 'bg-gray-100'
              }`}
            >
              <FaGoogle className="inline mr-2" /> Sign In with Google
            </button>
          </div>

          {renderAuthContent()}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthModal;