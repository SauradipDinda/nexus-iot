import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Activity, Mail, Lock, Eye, EyeOff, User, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import './AuthPages.css';

const RegisterPage = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validate required fields
    if (!form.name || !form.email || !form.password) {
      toast.error('Please fill in all fields');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    // Validate password match
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    // Validate password strength
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    // Validate name length
    if (form.name.length < 2 || form.name.length > 50) {
      toast.error('Name must be between 2 and 50 characters');
      return;
    }

    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created! Welcome to Nexus IoT 🎉');
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg">
        <div className="bg-orb orb-1" />
        <div className="bg-orb orb-2" />
        <div className="bg-orb orb-3" />
      </div>

      <div className="auth-container">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Activity size={28} />
          </div>
          <div>
            <h1><span className="gradient-text">Nexus</span> IoT</h1>
            <p>Professional IoT Monitoring Platform</p>
          </div>
        </div>

        <motion.div 
          className="auth-card"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.25, 0.8, 0.25, 1] }}
        >
          <div className="auth-card-header">
            <h2>Create Account</h2>
            <p>Start monitoring your IoT devices today</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div className="input-wrapper">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  name="name"
                  className="form-input with-icon"
                  placeholder="John Doe"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  name="email"
                  className="form-input with-icon"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  className="form-input with-icon with-icon-right"
                  placeholder="Min. 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="input-icon-right"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  className="form-input with-icon"
                  placeholder="Repeat your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg auth-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Creating account...
                </>
              ) : (
                <>
                  <Wifi size={18} />
                  Create Account
                </>
              )}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login">Sign in</Link>
            </p>
          </div>
        </motion.div>

        <div className="auth-features">
          {['Free to start', 'Unlimited devices', 'Real-time data', 'Smart alerts'].map((f) => (
            <div key={f} className="auth-feature-tag">
              <span className="status-dot online" />
              {f}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
