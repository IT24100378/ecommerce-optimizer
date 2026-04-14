import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SHIPPED: 'bg-blue-100 text-blue-800',
  DELIVERED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
  RETURNED: 'bg-purple-100 text-purple-800',
};

const STATUSES = ['PENDING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6"
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

export default function OrderDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editOrder, setEditOrder] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [userId, setUserId] = useState('');
  const [items, setItems] = useState([{ productId: '', quantity: '', price: '' }]);
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/api/orders`);
      setOrders(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const addItem = () => setItems(prev => [...prev, { productId: '', quantity: '', price: '' }]);
  const removeItem = idx => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/api/orders`, { userId, items });
      setShowCreate(false);
      setUserId('');
      setItems([{ productId: '', quantity: '', price: '' }]);
      fetchOrders();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleEditStatus = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/api/orders/${editOrder.id}`, { status: editStatus });
      setEditOrder(null);
      fetchOrders();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/api/orders/${deleteId}`);
      setDeleteId(null);
      fetchOrders();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete order');
    }
  };

  return (
    <div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(-16px);} to { opacity:1; transform:translateY(0);} }`}</style>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Orders</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200">
          + New Order
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
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Items</th>
                <th className="px-4 py-3 text-left">Total</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-10">No orders yet.</td></tr>
              ) : orders.map(order => (
                <tr key={order.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3 font-medium text-indigo-600">#{order.id}</td>
                  <td className="px-4 py-3">{order.user?.name || `User ${order.userId}`}</td>
                  <td className="px-4 py-3 text-gray-500">{order.items?.length || 0} item(s)</td>
                  <td className="px-4 py-3 font-semibold">${Number(order.discountedTotal ?? order.totalAmount).toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(order.orderDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <button onClick={() => { setEditOrder(order); setEditStatus(order.status); }}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors duration-150">Edit</button>
                    <button onClick={() => setDeleteId(order.id)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors duration-150">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Order Modal */}
      {showCreate && (
        <Modal title="Create New Order" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <input type="number" value={userId} onChange={e => setUserId(e.target.value)} required
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Enter User ID" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Order Items</label>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input type="number" placeholder="Product ID" value={item.productId} onChange={e => updateItem(idx, 'productId', e.target.value)} required
                    className="flex-1 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} required
                    className="w-20 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  <input type="number" step="0.01" placeholder="Price" value={item.price} onChange={e => updateItem(idx, 'price', e.target.value)} required
                    className="w-24 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 font-bold px-1">✕</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addItem}
                className="text-indigo-600 text-sm hover:text-indigo-800 font-medium mt-1 transition-colors duration-150">+ Add Item</button>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
                {saving ? 'Creating…' : 'Create Order'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Status Modal */}
      {editOrder && (
        <Modal title={`Update Order #${editOrder.id}`} onClose={() => setEditOrder(null)}>
          <form onSubmit={handleEditStatus} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
                {saving ? 'Saving…' : 'Update Status'}
              </button>
              <button type="button" onClick={() => setEditOrder(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="Confirm Delete" onClose={() => setDeleteId(null)}>
          <p className="text-gray-600 mb-6">Are you sure you want to delete Order #{deleteId}? This action cannot be undone.</p>
          <div className="flex gap-3">
            <button onClick={handleDelete}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg font-medium hover:bg-red-700 transition-all duration-200">
              Delete
            </button>
            <button onClick={() => setDeleteId(null)}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
