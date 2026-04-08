import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';
const emptyForm = { campaignName: '', promoCode: '', discountPercentage: '', startDate: '', endDate: '', isActive: true };

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

function PromoForm({ data, setData, onSubmit, onCancel, label, saving }) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {[['campaignName', 'Campaign Name', 'text'], ['promoCode', 'Promo Code', 'text'], ['discountPercentage', 'Discount %', 'number']].map(([f, l, t]) => (
        <div key={f}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
          <input type={t} required value={data[f]} onChange={e => setData(p => ({ ...p, [f]: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
      ))}
      {[['startDate', 'Start Date'], ['endDate', 'End Date']].map(([f, l]) => (
        <div key={f}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
          <input type="datetime-local" required value={data[f]} onChange={e => setData(p => ({ ...p, [f]: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
      ))}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={data.isActive} onChange={e => setData(p => ({ ...p, isActive: e.target.checked }))} />
        Active
      </label>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
          {saving ? 'Saving…' : label}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
      </div>
    </form>
  );
}

export default function PromotionDashboard() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editPromo, setEditPromo] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  // Promo tester
  const [testCode, setTestCode] = useState('');
  const [testPrice, setTestPrice] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const fetchPromotions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/api/promotions`);
      setPromotions(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPromotions(); }, [fetchPromotions]);

  const handleCreate = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API}/api/promotions`, form);
      setShowCreate(false);
      setForm(emptyForm);
      fetchPromotions();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to create promotion');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.put(`${API}/api/promotions/${editPromo.id}`, editForm);
      setEditPromo(null);
      fetchPromotions();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to update promotion');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/api/promotions/${deleteId}`);
      setDeleteId(null);
      fetchPromotions();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete promotion');
    }
  };

  const handleApply = async e => {
    e.preventDefault();
    setTestResult(null);
    setTestError('');
    try {
      const res = await axios.post(`${API}/api/promotions/apply`, { promoCode: testCode, originalPrice: parseFloat(testPrice) });
      setTestResult(res.data);
    } catch (e) {
      setTestError(e.response?.data?.error || 'Invalid promo code');
    }
  };

  return (
    <div>
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateY(-16px);} to { opacity:1; transform:translateY(0);} }`}</style>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Promotions</h1>
        <button onClick={() => setShowCreate(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200">
          + New Promotion
        </button>
      </div>

      {/* Promo Code Tester */}
      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">🧮 Promo Code Tester</h2>
        <form onSubmit={handleApply} className="flex gap-3 flex-wrap">
          <input type="text" placeholder="Promo Code" value={testCode} onChange={e => setTestCode(e.target.value)} required
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-40" />
          <input type="number" step="0.01" placeholder="Original Price" value={testPrice} onChange={e => setTestPrice(e.target.value)} required
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-40" />
          <button type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-all duration-200">
            Apply Code
          </button>
        </form>
        {testError && <p className="text-red-600 text-sm mt-2">{testError}</p>}
        {testResult && (
          <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 text-sm">
            <p>Original: <strong>${testResult.originalPrice.toFixed(2)}</strong></p>
            <p>Discount: <strong className="text-green-600">-{testResult.discountPercentage}% (–${testResult.discount.toFixed(2)})</strong></p>
            <p>Final Price: <strong className="text-indigo-700 text-lg">${testResult.discountedPrice.toFixed(2)}</strong></p>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {promotions.length === 0 ? (
            <div className="col-span-3 text-center text-gray-400 py-16 bg-white rounded-2xl shadow">No promotions yet.</div>
          ) : promotions.map(promo => {
            const now = new Date();
            const isCurrentlyActive = promo.isActive && new Date(promo.startDate) <= now && new Date(promo.endDate) >= now;
            return (
              <div key={promo.id} className="bg-white rounded-2xl shadow p-5 transition-all duration-200 hover:shadow-lg hover:-translate-y-1">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-gray-800 text-base">{promo.campaignName}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${isCurrentlyActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isCurrentlyActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="space-y-1 text-sm text-gray-600 mb-4">
                  <p>Code: <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{promo.promoCode}</span></p>
                  <p>Discount: <strong className="text-green-600">{promo.discountPercentage}% off</strong></p>
                  <p className="text-xs text-gray-400">{new Date(promo.startDate).toLocaleDateString()} – {new Date(promo.endDate).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditPromo(promo);
                    setEditForm({
                      campaignName: promo.campaignName, promoCode: promo.promoCode,
                      discountPercentage: promo.discountPercentage,
                      startDate: new Date(promo.startDate).toISOString().slice(0, 16),
                      endDate: new Date(promo.endDate).toISOString().slice(0, 16),
                      isActive: promo.isActive,
                    });
                  }}
                    className="flex-1 text-center text-xs py-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium transition-all duration-200">Edit</button>
                  <button onClick={() => setDeleteId(promo.id)}
                    className="flex-1 text-center text-xs py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-medium transition-all duration-200">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <Modal title="New Promotion" onClose={() => setShowCreate(false)}>
          <PromoForm data={form} setData={setForm} onSubmit={handleCreate} onCancel={() => setShowCreate(false)} label="Create Promotion" saving={saving} />
        </Modal>
      )}

      {editPromo && (
        <Modal title={`Edit: ${editPromo.campaignName}`} onClose={() => setEditPromo(null)}>
          <PromoForm data={editForm} setData={setEditForm} onSubmit={handleEdit} onCancel={() => setEditPromo(null)} label="Update Promotion" saving={saving} />
        </Modal>
      )}

      {deleteId && (
        <Modal title="Confirm Delete" onClose={() => setDeleteId(null)}>
          <p className="text-gray-600 mb-6">Delete this promotion?</p>
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
