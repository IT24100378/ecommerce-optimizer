import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const PROMOTION_TYPES = [
  { value: 'EVENT', label: 'Event Promotion' },
  { value: 'CATEGORY', label: 'Product Category Promotion' },
  { value: 'PRODUCT', label: 'Product Promotion' },
];
const emptyForm = {
  campaignName: '',
  type: '',
  promoCode: '',
  discountPercentage: '',
  startDate: '',
  endDate: '',
  categoryId: '',
  productId: '',
  isActive: true,
};

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

function PromoForm({ data, setData, onSubmit, onCancel, onPreview, label, saving }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [metaError, setMetaError] = useState('');
  const [previewing, setPreviewing] = useState(false);
  const [previewState, setPreviewState] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      axios.get(`${API}/api/products`).catch(() => ({ data: [] })),
      axios.get(`${API}/api/categories`).catch(() => ({ data: [] })),
    ]).then(([productsRes, categoriesRes]) => {
      if (!mounted) return;
      const productList = Array.isArray(productsRes.data) ? productsRes.data : [];
      setProducts(productList);
      const categoryNames = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      setCategories(categoryNames);
    }).catch(() => {
      if (mounted) setMetaError('Failed to load products/categories for promotion targeting.');
    });

    return () => { mounted = false; };
  }, []);

  const selectedType = data.type;

  const validateClient = () => {
    const discount = Number.parseFloat(data.discountPercentage);
    if (!Number.isFinite(discount) || discount <= 0) {
      return 'Discount percentage must be positive.';
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Start and end dates are required.';
    }
    if (end < start) {
      return 'End date must be after or equal to start date.';
    }

    if (!selectedType) {
      return 'Promotion type is required.';
    }

    if (selectedType === 'EVENT' && !String(data.promoCode || '').trim()) {
      return 'Promo code is required for Event promotions.';
    }
    if (selectedType === 'CATEGORY' && !data.categoryId) {
      return 'Category is required for Category promotions.';
    }
    if (selectedType === 'PRODUCT' && !data.productId) {
      return 'Product is required for Product promotions.';
    }

    return '';
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const validationError = validateClient();
    if (validationError) {
      setMetaError(validationError);
      return;
    }
    setMetaError('');
    onSubmit(event);
  };

  const handlePreview = async () => {
    const validationError = validateClient();
    if (validationError) {
      setMetaError(validationError);
      setPreviewState(null);
      return;
    }

    setMetaError('');
    setPreviewing(true);
    try {
      const preview = await onPreview(data);
      setPreviewState(preview);
    } catch (error) {
      setPreviewState({ ok: false, message: error.message || 'Failed to check conflicts.' });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {metaError && <p className="text-sm text-red-600">{metaError}</p>}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Category</label>
        <select
          required
          value={data.type}
          onChange={(e) => setData((prev) => ({
            ...prev,
            type: e.target.value,
            promoCode: e.target.value === 'EVENT' ? prev.promoCode : '',
            categoryId: e.target.value === 'CATEGORY' ? prev.categoryId : '',
            productId: e.target.value === 'PRODUCT' ? prev.productId : '',
          }))}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">Select promotion category</option>
          {PROMOTION_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
        <input
          type="text"
          required
          value={data.campaignName}
          onChange={(e) => setData((prev) => ({ ...prev, campaignName: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {selectedType === 'EVENT' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
          <input
            type="text"
            required
            value={data.promoCode}
            onChange={(e) => setData((prev) => ({ ...prev, promoCode: e.target.value.toUpperCase() }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-500 mt-1">Only Event promotions support promo-code discounts at checkout.</p>
        </div>
      )}

      {selectedType === 'CATEGORY' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Category</label>
          <select
            required
            value={data.categoryId}
            onChange={(e) => setData((prev) => ({ ...prev, categoryId: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Select category</option>
            {categories.map((categoryName) => (
              <option key={categoryName} value={categoryName}>{categoryName}</option>
            ))}
          </select>
        </div>
      )}

      {selectedType === 'PRODUCT' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
          <select
            required
            value={data.productId}
            onChange={(e) => setData((prev) => ({ ...prev, productId: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">Select product</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={data.discountPercentage}
          onChange={(e) => setData((prev) => ({ ...prev, discountPercentage: e.target.value }))}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {[['startDate', 'Start Date'], ['endDate', 'End Date']].map(([f, l]) => (
        <div key={f}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{l}</label>
          <input
            type="datetime-local"
            required
            value={data[f]}
            onChange={(e) => setData((prev) => ({ ...prev, [f]: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      ))}

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={data.isActive} onChange={e => setData(p => ({ ...p, isActive: e.target.checked }))} />
        Active
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={handlePreview}
          disabled={saving || previewing}
          className="flex-1 border border-indigo-300 text-indigo-700 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-all duration-200 disabled:opacity-50"
        >
          {previewing ? 'Checking...' : 'Check Conflicts'}
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-50">
          {saving ? 'Saving…' : label}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-all duration-200">Cancel</button>
      </div>
      {previewState && (
        <div className={`rounded-lg border p-3 text-xs ${previewState.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
          <p className="font-semibold">{previewState.ok ? 'No Conflicts' : 'Blocking Promotion Detected'}</p>
          <p className="mt-1">{previewState.message}</p>
          {!previewState.ok && previewState.conflict && (
            <div className="mt-2 space-y-1">
              <p><span className="font-semibold">Campaign:</span> {previewState.conflict.campaignName}</p>
              <p><span className="font-semibold">Type:</span> {previewState.conflict.type}</p>
              <p><span className="font-semibold">Target:</span> {previewState.conflict.target || 'N/A'}</p>
              <p>
                <span className="font-semibold">Range:</span>{' '}
                {previewState.conflict.startDate ? new Date(previewState.conflict.startDate).toLocaleString() : '-'}{' '}
                to{' '}
                {previewState.conflict.endDate ? new Date(previewState.conflict.endDate).toLocaleString() : '-'}
              </p>
            </div>
          )}
        </div>
      )}
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
      const previewRes = await axios.post(`${API}/api/promotions/preview`, {
        campaignName: form.campaignName,
        type: form.type,
        promoCode: form.type === 'EVENT' ? form.promoCode : null,
        discountPercentage: form.discountPercentage,
        startDate: form.startDate,
        endDate: form.endDate,
        categoryName: form.type === 'CATEGORY' ? form.categoryId : null,
        productId: form.type === 'PRODUCT' ? Number(form.productId) : null,
        isActive: form.isActive,
      });
      if (!previewRes.data?.ok) {
        alert(previewRes.data?.message || 'This promotion overlaps with an existing promotion.');
        return;
      }

      await axios.post(`${API}/api/promotions`, {
        campaignName: form.campaignName,
        type: form.type,
        promoCode: form.type === 'EVENT' ? form.promoCode : null,
        discountPercentage: form.discountPercentage,
        startDate: form.startDate,
        endDate: form.endDate,
        categoryName: form.type === 'CATEGORY' ? form.categoryId : null,
        categoryId: null,
        productId: form.type === 'PRODUCT' ? Number(form.productId) : null,
        isActive: form.isActive,
      });
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
      const previewRes = await axios.post(`${API}/api/promotions/preview`, {
        promotionId: editPromo.id,
        campaignName: editForm.campaignName,
        type: editForm.type,
        promoCode: editForm.type === 'EVENT' ? editForm.promoCode : null,
        discountPercentage: editForm.discountPercentage,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        categoryName: editForm.type === 'CATEGORY' ? editForm.categoryId : null,
        productId: editForm.type === 'PRODUCT' ? Number(editForm.productId) : null,
        isActive: editForm.isActive,
      });
      if (!previewRes.data?.ok) {
        alert(previewRes.data?.message || 'This promotion overlaps with an existing promotion.');
        return;
      }

      await axios.put(`${API}/api/promotions/${editPromo.id}`, {
        campaignName: editForm.campaignName,
        type: editForm.type,
        promoCode: editForm.type === 'EVENT' ? editForm.promoCode : null,
        discountPercentage: editForm.discountPercentage,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        categoryName: editForm.type === 'CATEGORY' ? editForm.categoryId : null,
        categoryId: null,
        productId: editForm.type === 'PRODUCT' ? Number(editForm.productId) : null,
        isActive: editForm.isActive,
      });
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

  const previewPayloadFromForm = (promoForm, promotionId = null) => ({
    promotionId,
    campaignName: promoForm.campaignName,
    type: promoForm.type,
    promoCode: promoForm.type === 'EVENT' ? promoForm.promoCode : null,
    discountPercentage: promoForm.discountPercentage,
    startDate: promoForm.startDate,
    endDate: promoForm.endDate,
    categoryName: promoForm.type === 'CATEGORY' ? promoForm.categoryId : null,
    productId: promoForm.type === 'PRODUCT' ? Number(promoForm.productId) : null,
    isActive: promoForm.isActive,
  });

  const handlePreviewCreate = async (promoForm) => {
    const { data } = await axios.post(`${API}/api/promotions/preview`, previewPayloadFromForm(promoForm));
    return {
      ok: Boolean(data?.ok),
      message: data?.message || (data?.ok ? 'No overlap detected.' : 'Overlap found.'),
      conflict: data?.conflict || null,
      reason: data?.reason || null,
    };
  };

  const handlePreviewEdit = async (promoForm) => {
    const { data } = await axios.post(`${API}/api/promotions/preview`, previewPayloadFromForm(promoForm, editPromo?.id));
    return {
      ok: Boolean(data?.ok),
      message: data?.message || (data?.ok ? 'No overlap detected.' : 'Overlap found.'),
      conflict: data?.conflict || null,
      reason: data?.reason || null,
    };
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
                  <p>Type: <strong>{promo.type}</strong></p>
                  {promo.type === 'EVENT' && promo.promoCode && (
                    <p>Code: <span className="font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{promo.promoCode}</span></p>
                  )}
                  {promo.type === 'CATEGORY' && promo.categoryRef?.name && (
                    <p>Category: <strong>{promo.categoryRef.name}</strong></p>
                  )}
                  {promo.type === 'PRODUCT' && promo.productRef?.name && (
                    <p>Product: <strong>{promo.productRef.name}</strong></p>
                  )}
                  <p>Discount: <strong className="text-green-600">{promo.discountPercentage}% off</strong></p>
                  <p className="text-xs text-gray-400">{new Date(promo.startDate).toLocaleDateString()} – {new Date(promo.endDate).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    setEditPromo(promo);
                    setEditForm({
                      campaignName: promo.campaignName,
                      type: promo.type,
                      promoCode: promo.promoCode || '',
                      discountPercentage: promo.discountPercentage,
                      startDate: new Date(promo.startDate).toISOString().slice(0, 16),
                      endDate: new Date(promo.endDate).toISOString().slice(0, 16),
                      categoryId: promo.categoryRef?.name || '',
                      productId: promo.productRef?.id ? String(promo.productRef.id) : '',
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
          <PromoForm
            data={form}
            setData={setForm}
            onSubmit={handleCreate}
            onPreview={handlePreviewCreate}
            onCancel={() => setShowCreate(false)}
            label="Create Promotion"
            saving={saving}
          />
        </Modal>
      )}

      {editPromo && (
        <Modal title={`Edit: ${editPromo.campaignName}`} onClose={() => setEditPromo(null)}>
          <PromoForm
            data={editForm}
            setData={setEditForm}
            onSubmit={handleEdit}
            onPreview={handlePreviewEdit}
            onCancel={() => setEditPromo(null)}
            label="Update Promotion"
            saving={saving}
          />
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
