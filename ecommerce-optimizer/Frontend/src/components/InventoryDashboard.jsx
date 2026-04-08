import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

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

function StockBar({ stockLevel, threshold }) {
  const pct = threshold > 0 ? Math.min((stockLevel / (threshold * 3)) * 100, 100) : Math.min(stockLevel, 100);
  const isLow = stockLevel <= threshold;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold ${isLow ? 'text-red-600' : 'text-green-600'}`}>{stockLevel}</span>
    </div>
  );
}

export default function InventoryDashboard() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ productId: '', stockLevel: '', lowStockThreshold: '' });
  const [editForm, setEditForm] = useState({ stockLevel: '', lowStockThreshold: '' });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/api/inventory`);
      setInventory(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const lowStockItems = inventory.filter(i => i.stockLevel <= i.lowStockThreshold);

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/api/inventory`, form);
      setShowCreate(false);
      setForm({ productId: '', stockLevel: '', lowStockThreshold: '' });
      fetchInventory();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create inventory record');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/api/inventory/${editRecord.id}`, editForm);
      setEditRecord(null);
      fetchInventory();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/api/inventory/${deleteId}`);
      setDeleteId(null);
      fetchInventory();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete record');
    }
  };

  return (
    <div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(-16px);} to { opacity:1; transform:translateY(0);} }`}</style>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200">
          + Add Record
        </button>
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-700">Low Stock Alert!</p>
            <p className="text-red-600 text-sm">
              {lowStockItems.map(i => i.product?.name || `Product #${i.productId}`).join(', ')} {lowStockItems.length === 1 ? 'is' : 'are'} running low on stock.
            </p>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">ID</th>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left">Stock Level</th>
                <th className="px-4 py-3 text-left">Threshold</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Last Updated</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-10">No inventory records yet.</td></tr>
              ) : inventory.map(record => {
                const isLow = record.stockLevel <= record.lowStockThreshold;
                return (
                  <tr key={record.id} className={`border-t border-gray-100 hover:bg-gray-50 transition-colors duration-150 ${isLow ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-indigo-600">#{record.id}</td>
                    <td className="px-4 py-3 font-medium">{record.product?.name || `Product #${record.productId}`}</td>
                    <td className="px-4 py-3 w-40">
                      <StockBar stockLevel={record.stockLevel} threshold={record.lowStockThreshold} />
                    </td>
                    <td className="px-4 py-3 text-gray-500">{record.lowStockThreshold}</td>
                    <td className="px-4 py-3">
                      {isLow
                        ? <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-semibold">Low Stock</span>
                        : <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-semibold">In Stock</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{new Date(record.lastUpdated).toLocaleDateString()}</td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={() => { setEditRecord(record); setEditForm({ stockLevel: record.stockLevel, lowStockThreshold: record.lowStockThreshold }); }}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors duration-150">Edit</button>
                      <button onClick={() => setDeleteId(record.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors duration-150">Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <Modal title="Add Inventory Record" onClose={() => setShowCreate(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            {[['productId', 'Product ID', 'number'], ['stockLevel', 'Stock Level', 'number'], ['lowStockThreshold', 'Low Stock Threshold', 'number']].map(([f, l, t]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type={t} required={f === 'productId'} value={form[f]}
                  onChange={e => setForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
                {saving ? 'Saving…' : 'Add Record'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Modal */}
      {editRecord && (
        <Modal title={`Edit Inventory #${editRecord.id}`} onClose={() => setEditRecord(null)}>
          <form onSubmit={handleEdit} className="space-y-4">
            {[['stockLevel', 'Stock Level'], ['lowStockThreshold', 'Low Stock Threshold']].map(([f, l]) => (
              <div key={f}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
                <input type="number" value={editForm[f]} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
                {saving ? 'Saving…' : 'Update'}
              </button>
              <button type="button" onClick={() => setEditRecord(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <Modal title="Confirm Delete" onClose={() => setDeleteId(null)}>
          <p className="text-gray-600 mb-6">Delete inventory record #{deleteId}?</p>
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
