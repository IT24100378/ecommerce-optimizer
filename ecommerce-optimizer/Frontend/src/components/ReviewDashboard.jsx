import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = 'http://localhost:5000';

function Stars({ rating }) {
  return (
    <span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-300'}>★</span>
      ))}
    </span>
  );
}

export default function ReviewDashboard() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adminView, setAdminView] = useState(false);
  const [filterProductId, setFilterProductId] = useState('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (adminView) params.adminView = 'true';
      if (filterProductId) params.productId = filterProductId;
      const res = await axios.get(`${API}/api/reviews`, { params });
      setReviews(res.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [adminView, filterProductId]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const handleToggleHide = async (review) => {
    try {
      await axios.put(`${API}/api/reviews/${review.id}`, { isHidded: !review.isHidded });
      fetchReviews();
    } catch (e) {
      alert('Failed to update review visibility');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Reviews</h1>
        <div className="flex gap-3 flex-wrap">
          <input type="number" placeholder="Filter by Product ID" value={filterProductId}
            onChange={e => setFilterProductId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={adminView} onChange={e => setAdminView(e.target.checked)}
              className="rounded" />
            Admin View (show hidden)
          </label>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-3 mb-4">
        <strong>Admin Moderation:</strong> You can hide or show customer reviews. Reviews can only be written, edited, or deleted by customers from the product page after purchasing.
      </div>

      {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>
      ) : (
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center text-gray-400 py-16 bg-white rounded-2xl shadow">No reviews found.</div>
          ) : reviews.map(review => (
            <div key={review.id}
              className={`bg-white rounded-2xl shadow p-5 transition-all duration-200 hover:shadow-md ${review.isHidded ? 'opacity-60 border-l-4 border-red-400' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <Stars rating={review.rating} />
                    <span className="font-semibold text-gray-800">{review.user?.name || `User ${review.userId}`}</span>
                    <span className="text-gray-400 text-sm">on <span className="text-indigo-600">{review.product?.name || `Product ${review.productId}`}</span></span>
                    {review.isHidded && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">Hidden</span>}
                    {review.isEdited && <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full font-medium">Edited</span>}
                  </div>
                  <p className="text-gray-600 text-sm">{review.comment || <em className="text-gray-400">No comment</em>}</p>
                  <p className="text-gray-400 text-xs mt-2">{new Date(review.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleToggleHide(review)}
                    className={`text-xs px-2 py-1 rounded font-medium transition-all duration-200 ${review.isHidded ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'}`}>
                    {review.isHidded ? 'Show' : 'Hide'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
