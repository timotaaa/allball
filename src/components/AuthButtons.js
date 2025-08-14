import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import AuthModal from './AuthModal';

export default function AuthButtons({ user }) {
  const [showAuthModal, setShowAuthModal] = useState(false);

  if (user) {
    return (
      <>
        <button className="mode-btn active auth-btn" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
        <AuthModal 
          show={showAuthModal} 
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return (
    <>
      <button className="mode-btn active auth-btn" onClick={() => setShowAuthModal(true)}>
        Sign in
      </button>
      <AuthModal 
        show={showAuthModal} 
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => setShowAuthModal(false)}
      />
    </>
  );
}


