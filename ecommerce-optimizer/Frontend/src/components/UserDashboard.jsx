import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

const ROLES = ['CUSTOMER', 'ADMIN'];

const ROLE_COLORS = {
  ADMIN: 'bg-red-100 text-red-700',
  VENDOR: 'bg-purple-100 text-purple-700',
  CUSTOMER: 'bg-blue-100 text-blue-700',
};

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-screen overflow-y-auto"
        style={{ animation: 'slideIn 0.2s ease' }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const emptyForm = { name: '', email: '', password: '', role: 'CUSTOMER', address: '', preferences: '' };

export default function UserDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [viewUserData, setViewUserData] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'CUSTOMER', address: '', preferences: '' });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/api/users`);
      setUsers(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const fetchUserDetails = async (id) => {
    try {
      const res = await axios.get(`${API}/api/users/${id}`);
      setViewUserData(res.data);
    } catch {
      setViewUserData(null);
    }
  };

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/api/users`, form);
      setShowCreate(false);
      setForm(emptyForm);
      fetchUsers();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/api/users/${editUser.id}`, editForm);
      setEditUser(null);
      fetchUsers();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/api/users/${deleteId}`);
      setDeleteId(null);
      fetchUsers();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(-16px);} to { opacity:1; transform:translateY(0);} }`}</style>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Users</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200">
          + Add User
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Address</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-10">No users found.</td></tr>
              ) : users.map(user => (
                <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-indigo-600">#{user.id}</td>
                  <td className="px-4 py-3 font-medium">{user.name}</td>
                  <td className="px-4 py-3 text-gray-500">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[user.role] || 'bg-gray-100 text-gray-600'}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{user.address || '–'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => { setViewUser(user); fetchUserDetails(user.id); }}
                      className="text-green-600 hover:text-green-800 text-xs font-medium transition-colors duration-150">History</button>
                    <button onClick={() => {
                      const safeRole = ROLES.includes(user.role) ? user.role : 'CUSTOMER';
                      setEditUser(user);
                      setEditForm({ name: user.name, email: user.email, role: safeRole, address: user.address || '', preferences: user.preferences || '' });
                    }}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors duration-150">Edit</button>
                    <button onClick={() => setDeleteId(user.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors duration-150">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <Modal title="Add New User" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {[['name', 'Name', 'text'], ['email', 'Email', 'email'], ['password', 'Password', 'password']].map(([f, l, t]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type={t} required value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {[['address', 'Address'], ['preferences', 'Preferences']].map(([f, l]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type="text" value={form[f]} onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create User'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <Modal title={`Edit User: ${editUser.name}`} onClose={() => setEditUser(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {[['name', 'Name', 'text'], ['email', 'Email', 'email']].map(([f, l, t]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type={t} value={editForm[f]} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {[['address', 'Address'], ['preferences', 'Preferences']].map(([f, l]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type="text" value={editForm[f]} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
                {saving ? 'Saving…' : 'Update User'}
              </button>
              <button type="button" onClick={() => setEditUser(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* View Purchase History Modal */}
      {viewUser && (
        <Modal title={`${viewUser.name}'s Purchase History`} onClose={() => { setViewUser(null); setViewUserData(null); }}>
          {!viewUserData ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
          ) : viewUserData.orders?.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No orders found for this user.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {viewUserData.orders?.map(order => (
                <div key={order.id} className="border border-gray-200 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-indigo-600">Order #{order.id}</span>
                    <span className="text-sm font-bold">${Number(order.totalAmount).toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{new Date(order.orderDate).toLocaleDateString()} · <span className="font-medium text-gray-600">{order.status}</span></p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {order.items?.map(item => (
                      <li key={item.id}>• {item.product?.name || `Product #${item.productId}`} × {item.quantity} @ ${Number(item.price).toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => { setViewUser(null); setViewUserData(null); }}
            className="mt-4 w-full border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Close</button>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="Confirm Delete" onClose={() => setDeleteId(null)}>
          <p className="text-gray-600 mb-6">Delete user #{deleteId}?</p>
          <div className="flex gap-3">
            <button onClick={handleDelete}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-all duration-200">Delete</button>
            <button onClick={() => setDeleteId(null)}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
