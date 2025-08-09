import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@klopjacht.com');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      // For demo purposes, navigate to admin dashboard
      navigate('/admin');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🔍 Admin Login</h1>
        <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Email:
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@klopjacht.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Password:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #333',
                backgroundColor: '#1A1A1A',
                color: '#FFFFFF'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={handleBack}>
              Back
            </button>
            <button type="submit" className="btn btn-primary">
              Login
            </button>
          </div>
        </form>
        
        <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#888' }}>
          <p>Demo credentials:</p>
          <p>Email: admin@klopjacht.com</p>
          <p>Password: SuperAdmin123!</p>
        </div>
      </header>
    </div>
  );
};

export default LoginPage;
