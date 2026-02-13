import React, { useState } from 'react';
import AuthModal from '../auth/AuthModal';
import { FaUser } from 'react-icons/fa';

interface AuthButtonProps {
  onLogin?: (user: any) => void;
}

const AuthButton: React.FC<AuthButtonProps> = ({ onLogin }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  const handleAuthSuccess = (userData: any) => {
    setUser(userData);
    onLogin?.(userData);
    setIsAuthModalOpen(false);
  };

  const handleLogout = () => {
    // Implement logout logic
    setUser(null);
  };

  return (
    <>
      {user ? (
        <div className="relative group">
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition"
          >
            <FaUser />
            <span>{user.username}</span>
            <span className="text-xs opacity-0 group-hover:opacity-100 transition ml-2">
              Logout
            </span>
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setIsAuthModalOpen(true)}
          className="flex items-center space-x-2 bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition"
        >
          <FaUser />
          <span>Sign In</span>
        </button>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
};

export default AuthButton;