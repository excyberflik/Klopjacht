import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface User {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  role: string;
  organization?: string;
  club?: string;
  createdAt: string;
  lastLogin?: string;
}

const UserManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'game_lead',
    organization: '',
    club: ''
  });

  // Check if user is super admin
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'super_admin') {
      navigate('/admin');
      return;
    }
    fetchUsers();
  }, [navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${formData.role === 'game_lead' ? 'Game Lead' : 'User'} created successfully!\n\nName: ${data.user.name}\nEmail: ${data.user.email}\nRole: ${data.user.role}`);
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          role: 'game_lead',
          organization: '',
          club: ''
        });
        setShowCreateForm(false);
        
        // Refresh users list
        fetchUsers();
      } else {
        const errorData = await response.json();
        console.error('User creation error:', errorData);
        
        let errorMessage = 'Failed to create user:\n\n';
        if (errorData.details && Array.isArray(errorData.details)) {
          errorMessage += errorData.details.map((detail: any) => `• ${detail.msg}`).join('\n');
        } else {
          errorMessage += errorData.error || errorData.message || 'Unknown error';
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (window.confirm(`Are you sure you want to delete user "${userName}"?\n\nThis action cannot be undone.`)) {
      try {
        const response = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          }
        });

        if (response.ok) {
          alert(`User "${userName}" has been deleted successfully.`);
          fetchUsers();
        } else {
          const errorData = await response.json();
          alert(`Failed to delete user: ${errorData.message || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('Failed to delete user. Please try again.');
      }
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>👥 User Management</h1>
        <p>Manage Game Leads and Administrators</p>

        <div className="user-management-content">
          <div className="user-stats">
            <div className="stat-card">
              <h4>Total Users</h4>
              <div className="stat-number">{users.length}</div>
            </div>
            <div className="stat-card">
              <h4>Game Leads</h4>
              <div className="stat-number">{users.filter(u => u.role === 'game_lead').length}</div>
            </div>
            <div className="stat-card">
              <h4>Admins</h4>
              <div className="stat-number">{users.filter(u => u.role === 'admin').length}</div>
            </div>
          </div>

          {!showCreateForm ? (
            <div className="users-section">
              <div className="section-header">
                <h3>All Users</h3>
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowCreateForm(true)}
                >
                  ➕ Create New Game Lead
                </button>
              </div>

              {loading ? (
                <div>Loading users...</div>
              ) : users.length === 0 ? (
                <div className="no-users">No users found</div>
              ) : (
                <div className="users-grid">
                  {users.map(user => {
                    const userId = user.id || user._id || '';
                    return (
                      <div key={userId} className="user-card">
                        <div className="user-card-header">
                          <h4>{user.name}</h4>
                          <span className={`role-badge ${user.role}`}>
                            {user.role === 'game_lead' ? 'Game Lead' : 
                             user.role === 'super_admin' ? 'Super Admin' : 
                             user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </span>
                        </div>
                        <div className="user-card-body">
                          <div><strong>Email:</strong> {user.email}</div>
                          <div><strong>Organization:</strong> {user.organization || 'Not set'}</div>
                          <div><strong>Club:</strong> {user.club || 'Not set'}</div>
                          <div><strong>Created:</strong> {new Date(user.createdAt).toLocaleDateString()}</div>
                          <div><strong>Last Login:</strong> {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</div>
                        </div>
                        <div className="user-card-actions">
                          {user.role !== 'super_admin' && userId && (
                            <button 
                              className="btn-small btn-danger" 
                              onClick={() => handleDeleteUser(userId, user.name)}
                              disabled={loading}
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="create-user-form">
              <div className="section-header">
                <h3>Create New Game Lead</h3>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => setShowCreateForm(false)}
                >
                  ← Cancel
                </button>
              </div>

              <form onSubmit={handleCreateUser} style={{ maxWidth: '500px', margin: '0 auto' }}>
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter full name"
                    required
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

                <div className="form-group">
                  <label>Email Address *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter email address"
                    required
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

                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Enter password (min 6 chars, 1 upper, 1 lower, 1 number)"
                    required
                    minLength={6}
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

                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      fontSize: '1rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #333',
                      backgroundColor: '#1A1A1A',
                      color: '#FFFFFF'
                    }}
                  >
                    <option value="game_lead">Game Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Organization</label>
                  <input
                    type="text"
                    value={formData.organization}
                    onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                    placeholder="Enter organization name (optional)"
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

                <div className="form-group">
                  <label>Club Name</label>
                  <input
                    type="text"
                    value={formData.club}
                    onChange={(e) => setFormData(prev => ({ ...prev, club: e.target.value }))}
                    placeholder="Enter club name (optional)"
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

                <div className="form-actions" style={{ marginTop: '2rem' }}>
                  <button 
                    type="submit" 
                    className="btn btn-success"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Game Lead'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        <div className="actions" style={{ marginTop: '2rem' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin')}>
            ← Back to Dashboard
          </button>
        </div>
      </header>
    </div>
  );
};

export default UserManagement;

export {};
