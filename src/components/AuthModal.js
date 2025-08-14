import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthModal({ show, onClose, onSuccess }) {
  const [mode, setMode] = useState('signin'); // 'signin', 'signup', 'reset', 'verify'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [verificationEmail, setVerificationEmail] = useState('');

  const clearForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setMessage({ type: '', text: '' });
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setMessage({ type: 'error', text: 'Please enter both email and password.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Successfully signed in! Redirecting...' 
      });
      
      // Close modal and redirect after success
      setTimeout(() => {
        onClose();
        clearForm();
        if (onSuccess) onSuccess();
      }, 1500);

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Invalid email or password. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || !fullName.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all fields.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      console.log('Attempting signup with:', { email: email.trim(), fullName: fullName.trim() });
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            plan: 'free' // Default to free plan
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      console.log('Signup response:', { data, error });

      if (error) throw error;

      if (data.user && !data.session) {
        // User created but needs email verification
        setMessage({ 
          type: 'success', 
          text: 'Account created! Please check your email to verify your account.' 
        });
        
        // Switch to verification mode
        setVerificationEmail(email.trim());
        setMode('verify');
      } else if (data.session) {
        // User created and automatically signed in
        setMessage({ 
          type: 'success', 
          text: 'Account created and signed in successfully!' 
        });
        
        setTimeout(() => {
          onClose();
          clearForm();
          if (onSuccess) onSuccess();
        }, 2000);
      }

    } catch (error) {
      console.error('Signup error:', error);
      let errorMessage = 'Failed to create account. Please try again.';
      
      if (error.message) {
        if (error.message.includes('email')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password is too weak. Please use a stronger password.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setMessage({ type: 'error', text: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage({ type: 'error', text: 'Please enter your email address.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Password reset email sent! Check your inbox.' 
      });
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        onClose();
        clearForm();
      }, 3000);

    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send reset email. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: verificationEmail
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Verification email resent! Check your inbox.' 
      });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to resend verification email.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!show) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content auth-modal">
        <div className="modal-header">
          <h3 className="modal-title">
            {mode === 'signin' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'reset' && 'Reset Password'}
            {mode === 'verify' && 'Verify Email'}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {mode === 'signin' && (
          <form onSubmit={handleSignIn}>
            <div className="form-group">
              <label htmlFor="signin-email">Email Address</label>
              <input
                id="signin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signin-password">Password</label>
              <input
                id="signin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="input"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="button primary full-width" 
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </div>

            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={() => setMode('signup')}
              >
                Don't have an account? Sign up
              </button>
              <button 
                type="button" 
                className="link-button" 
                onClick={() => setMode('reset')}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}

        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="input"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input"
                required
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password (min 6 characters)"
                className="input"
                required
                minLength={6}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <input
                id="signup-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className="input"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="button primary full-width" 
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>

            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={() => setMode('signin')}
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handlePasswordReset}>
            <div className="form-group">
              <label htmlFor="reset-email">Email Address</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="input"
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="button primary full-width" 
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Reset Email'}
              </button>
            </div>

            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={() => setMode('signin')}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}

        {mode === 'verify' && (
          <div className="verification-content">
            <p>We've sent a verification email to:</p>
            <p className="verification-email">{verificationEmail}</p>
            <p>Please check your inbox and click the verification link to activate your account.</p>
            
            <div className="form-actions">
              <button 
                type="button" 
                className="button primary full-width" 
                onClick={handleResendVerification}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Resend Verification Email'}
              </button>
            </div>

            <div className="auth-links">
              <button 
                type="button" 
                className="link-button" 
                onClick={() => {
                  setMode('signin');
                  clearForm();
                }}
              >
                Back to sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
