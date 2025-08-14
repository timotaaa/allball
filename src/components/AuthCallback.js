import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthCallback() {
  const [status, setStatus] = useState('Verifying...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          setError(error.message);
          setStatus('Authentication failed');
          return;
        }

        if (data.session) {
          setStatus('Successfully signed in! Redirecting...');
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        } else {
          setStatus('No active session found');
        }
      } catch (err) {
        setError(err.message);
        setStatus('An error occurred');
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <div className="container">
      <div className="auth-callback">
        <h2>Authentication</h2>
        <div className="callback-status">
          <p>{status}</p>
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              <button 
                className="button primary" 
                onClick={() => window.location.href = '/'}
              >
                Return to App
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
