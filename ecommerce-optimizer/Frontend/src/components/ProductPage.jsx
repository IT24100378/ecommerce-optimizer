import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

function formatPrice(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function StarDisplay({ rating, size = 'text-xl' }) {
  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={`${size} ${i <= rating ? 'text-yellow-400' : 'text-gray-600'}`}>★</span>
      ))}
    </div>
  );
}

function StarPicker({ rating, onChange }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className={`text-3xl transition-all duration-100 hover:scale-110 ${
            i <= (hover || rating) ? 'text-yellow-400' : 'text-gray-600'
          } cursor-pointer`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function isValidRating(rating) {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

export default function ProductPage({ product, user, onAddToCart, added, onBack, onRequireAuth }) {
  const [reviews, setReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [canReviewData, setCanReviewData] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: null, comment: '' });
  const [editingReview, setEditingReview] = useState(false);
  const [editForm, setEditForm] = useState({ rating: null, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [imgError, setImgError] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const availableStock = Number(product.availableStock ?? product.stockQuantity ?? 0);
  const outOfStock = availableStock <= 0;
  const basePrice = Number(product.basePrice ?? 0);
  const effectivePrice = Number(product.effectivePrice ?? product.basePrice ?? 0);
  const hasDiscount = effectivePrice < basePrice;

  const fetchReviews = useCallback(async () => {
    setLoadingReviews(true);
    try {
      const { data } = await axios.get(`${API}/api/reviews`, {
        params: { productId: product.id },
      });
      setReviews(data);
    } catch (e) {
      console.error('Failed to fetch reviews', e);
    } finally {
      setLoadingReviews(false);
    }
  }, [product.id]);

  const fetchCanReview = useCallback(async () => {
    if (!user) { setCanReviewData(null); return; }
    try {
      const { data } = await axios.get(`${API}/api/reviews/can-review`, {
        params: { userId: user.id, productId: product.id },
      });
      setCanReviewData(data);
      if (data.existingReview) {
        setEditForm({
          rating: data.existingReview.rating,
          comment: data.existingReview.comment || '',
        });
      }
    } catch (e) {
      console.error('Failed to check review eligibility', e);
    }
  }, [user, product.id]);

  useEffect(() => {
    fetchReviews();
    fetchCanReview();
  }, [fetchReviews, fetchCanReview]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) { onRequireAuth('signin'); return; }
    if (!isValidRating(reviewForm.rating)) {
      setReviewError('Please select a star rating between 1 and 5');
      return;
    }
    setSubmitting(true);
    setReviewError('');
    try {
      await axios.post(`${API}/api/reviews`, {
        userId: user.id,
        productId: product.id,
        rating: reviewForm.rating,
        comment: reviewForm.comment,
      });
      setReviewForm({ rating: null, comment: '' });
      await Promise.all([fetchReviews(), fetchCanReview()]);
    } catch (e) {
      setReviewError(e.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = async (e) => {
    e.preventDefault();
    if (!user || !canReviewData?.existingReview) return;
    if (!isValidRating(editForm.rating)) {
      setReviewError('Please select a star rating between 1 and 5');
      return;
    }
    setSubmitting(true);
    setReviewError('');
    try {
      await axios.put(`${API}/api/reviews/${canReviewData.existingReview.id}`, {
        userId: user.id,
        rating: editForm.rating,
        comment: editForm.comment,
      });
      setEditingReview(false);
      await Promise.all([fetchReviews(), fetchCanReview()]);
    } catch (e) {
      setReviewError(e.response?.data?.error || 'Failed to update review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!user || !canReviewData?.existingReview) return;
    try {
      await axios.delete(`${API}/api/reviews/${canReviewData.existingReview.id}`, {
        data: { userId: user.id },
      });
      setDeleteConfirm(false);
      setCanReviewData(null);
      await fetchReviews();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to delete review');
    }
  };

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : 0;

  return (
    <div className="bg-gray-950 min-h-screen pb-20">
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors group"
        >
          <svg
            className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Products
        </button>
      </div>

      {/* Product Detail */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* Image */}
          <div className="bg-gray-900 rounded-3xl overflow-hidden aspect-square border border-gray-800 flex items-center justify-center">
            {product.imageUrl && !imgError ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-600 p-8">
                <svg className="w-24 h-24 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-lg">No image available</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col justify-center">
            <span className="inline-block bg-gray-800 text-cyan-400 text-xs font-semibold px-3 py-1 rounded-full mb-3 self-start">
              {product.category}
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-white mb-4 leading-tight">
              {product.name}
            </h1>

            {reviews.length > 0 && (
              <div className="flex items-center gap-3 mb-4">
                <StarDisplay rating={Math.round(avgRating)} />
                <span className="text-gray-300 text-sm">
                  {avgRating.toFixed(1)} ({reviews.length}{' '}
                  {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}

            <div className="mb-6">
              <div className="text-4xl font-black text-cyan-400">
                {formatPrice(effectivePrice)}
              </div>
              {hasDiscount && (
                <div className="text-sm text-gray-500 line-through mt-1">
                  {formatPrice(basePrice)}
                </div>
              )}
            </div>

            {product.description && (
              <p className="text-gray-300 text-base leading-relaxed mb-8">
                {product.description}
              </p>
            )}

            <div className="mb-4">
              {outOfStock ? (
                <span className="inline-flex items-center bg-red-500/20 text-red-300 text-xs font-semibold px-3 py-1 rounded-full border border-red-500/30">
                  Out of Stock
                </span>
              ) : (
                <span className="inline-flex items-center bg-green-500/20 text-green-300 text-xs font-semibold px-3 py-1 rounded-full border border-green-500/30">
                  In Stock ({availableStock})
                </span>
              )}
            </div>

            <button
              onClick={() => onAddToCart(product)}
              disabled={outOfStock}
              className={`flex items-center justify-center gap-3 font-bold py-4 px-8 rounded-2xl text-lg transition-all duration-200 ${
                outOfStock
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  :
                added
                  ? 'bg-green-600 text-white scale-95'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white hover:shadow-xl hover:shadow-cyan-500/25 hover:-translate-y-0.5'
              }`}
            >
              {outOfStock ? (
                <>Out of Stock</>
              ) : added ? (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Added to Cart!
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  Add to Cart
                </>
              )}
            </button>

            <p className="text-gray-600 text-xs mt-4">SKU: {product.sku}</p>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="border-t border-gray-800 pt-12">
          <h2 className="text-2xl font-bold text-white mb-8">
            Customer Reviews
            {reviews.length > 0 && (
              <span className="text-gray-500 font-normal text-lg ml-2">({reviews.length})</span>
            )}
          </h2>

          {/* Write / Manage Review */}
          <div className="mb-10 bg-gray-900 border border-gray-800 rounded-2xl p-6">
            {!user ? (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">Sign in to write a review</p>
                <button
                  onClick={() => onRequireAuth('signin')}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                >
                  Sign In
                </button>
              </div>
            ) : canReviewData === null ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
              </div>
            ) : canReviewData.existingReview && !editingReview ? (
              /* Show the customer's existing review with edit/delete options */
              <div>
                <h3 className="text-white font-semibold mb-3">Your Review</h3>
                <div className="flex items-center gap-3 mb-2">
                  <StarDisplay rating={canReviewData.existingReview.rating} />
                  {canReviewData.existingReview.isEdited && (
                    <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                      Edited
                    </span>
                  )}
                </div>
                <p className="text-gray-300 text-sm mb-4">
                  {canReviewData.existingReview.comment || (
                    <em className="text-gray-500">No comment</em>
                  )}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingReview(true);
                      setEditForm({
                        rating: canReviewData.existingReview.rating,
                        comment: canReviewData.existingReview.comment || '',
                      });
                      setReviewError('');
                    }}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    Edit Review
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="bg-red-600/20 hover:bg-red-600/40 text-red-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors border border-red-600/30"
                  >
                    Delete Review
                  </button>
                </div>
              </div>
            ) : editingReview ? (
              /* Edit review form */
              <form onSubmit={handleEditReview}>
                <h3 className="text-white font-semibold mb-4">Edit Your Review</h3>
                {reviewError && <p className="text-red-400 text-sm mb-3">{reviewError}</p>}
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Rating <span className="text-red-400">*</span></label>
                  <StarPicker
                    rating={editForm.rating}
                    onChange={r => setEditForm(p => ({ ...p, rating: r }))}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Comment</label>
                  <textarea
                    value={editForm.comment}
                    onChange={e => setEditForm(p => ({ ...p, comment: e.target.value }))}
                    rows={4}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                    placeholder="Share your experience..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting || !isValidRating(editForm.rating)}
                    className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                  >
                    {submitting ? 'Saving…' : 'Update Review'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingReview(false); setReviewError(''); }}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : canReviewData.canReview ? (
              /* New review form */
              <form onSubmit={handleSubmitReview}>
                <h3 className="text-white font-semibold mb-4">Write a Review</h3>
                {reviewError && <p className="text-red-400 text-sm mb-3">{reviewError}</p>}
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Rating <span className="text-red-400">*</span></label>
                  <StarPicker
                    rating={reviewForm.rating}
                    onChange={r => setReviewForm(p => ({ ...p, rating: r }))}
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-gray-400 text-sm mb-2">Comment (optional)</label>
                  <textarea
                    value={reviewForm.comment}
                    onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                    rows={4}
                    className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                    placeholder="Share your experience with this product..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !isValidRating(reviewForm.rating)}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
                >
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </button>
              </form>
            ) : (
              /* Cannot review (not purchased yet) */
              <div className="text-center py-4">
                <svg
                  className="w-10 h-10 text-gray-600 mx-auto mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                <p className="text-gray-400 text-sm">
                  {canReviewData.reason || 'Purchase this product to write a review'}
                </p>
              </div>
            )}
          </div>

          {/* Delete confirmation modal */}
          {deleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => setDeleteConfirm(false)}
              />
              <div className="relative bg-gray-950 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl modal-pop">
                <h3 className="text-white font-bold text-lg mb-2">Delete Review?</h3>
                <p className="text-gray-400 text-sm mb-6">
                  Are you sure you want to delete your review? This cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteReview}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews list */}
          {loadingReviews ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-5xl mb-4">⭐</div>
              <p className="text-lg font-medium text-gray-400">No reviews yet</p>
              <p className="text-sm">Be the first to review this product!</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map(review => (
                <div
                  key={review.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {review.user?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className="text-white font-semibold text-sm">
                          {review.user?.name || 'Anonymous'}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StarDisplay rating={review.rating} size="text-base" />
                          {review.isEdited && (
                            <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                              Edited
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-gray-500 text-xs flex-shrink-0">
                      {new Date(review.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-gray-300 text-sm leading-relaxed pl-12">{review.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
