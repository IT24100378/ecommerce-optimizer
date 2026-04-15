import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProductForm from './ProductForm';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const PRODUCTS_API_URL = `${API_BASE}/api/products`;
const CATEGORIES_API_URL = `${API_BASE}/api/categories`;

export default function ProductDashboard() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [brokenImages, setBrokenImages] = useState(new Set());
    const [categories, setCategories] = useState([]);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [categoryError, setCategoryError] = useState('');
    const [creatingCategory, setCreatingCategory] = useState(false);

    const handleImageError = (id) => {
        setBrokenImages((prev) => new Set([...prev, id]));
    };

    // Fetch all active products on component mount
    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(PRODUCTS_API_URL);
            setProducts(data);
            setError('');
        } catch (err) {
            setError('Failed to load products. Please ensure the backend server is running.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data } = await axios.get(CATEGORIES_API_URL);
            setCategories(Array.isArray(data) ? data : []);
        } catch {
            setCategories([]);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await axios.delete(`${PRODUCTS_API_URL}/${id}`);
            // Remove the deleted row from state without a full re-fetch
            setProducts((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            alert('Failed to delete product. Please try again.');
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        setCategoryError('');
        const name = newCategoryName.trim();
        if (!name) {
            setCategoryError('Category name is required.');
            return;
        }

        try {
            setCreatingCategory(true);
            const { data } = await axios.post(CATEGORIES_API_URL, { name });
            setCategories((prev) => {
                const next = [...prev, data.category];
                return [...new Set(next)].sort((a, b) => a.localeCompare(b));
            });
            setNewCategoryName('');
            setShowCategoryModal(false);
        } catch (err) {
            setCategoryError(err.response?.data?.error || 'Failed to create category.');
        } finally {
            setCreatingCategory(false);
        }
    };

    const handleEdit = (product) => {
        setEditingProduct(product);
        setShowForm(true);
    };

    const handleFormClose = () => {
        setShowForm(false);
        setEditingProduct(null);
    };

    const handleFormSuccess = (savedProduct, isEdit) => {
        if (isEdit) {
            setProducts((prev) =>
                prev.map((p) => (p.id === savedProduct.id ? savedProduct : p))
            );
        } else {
            setProducts((prev) => [savedProduct, ...prev]);
        }
        if (savedProduct?.category) {
            setCategories((prev) => [...new Set([...prev, savedProduct.category])].sort((a, b) => a.localeCompare(b)));
        }
        handleFormClose();
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Product Catalog</h1>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { setCategoryError(''); setNewCategoryName(''); setShowCategoryModal(true); }}
                            className="bg-gray-700 hover:bg-gray-800 text-white font-semibold px-5 py-2 rounded-lg shadow"
                        >
                            + Add Category
                        </button>
                        <button
                            onClick={() => { setEditingProduct(null); setShowForm(true); }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg shadow"
                        >
                            + Add New Product
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mb-4">Stock levels are read-only here and managed from the Inventory module.</p>

                {/* Error banner */}
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                {/* Modal Form */}
                {showForm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
                            <div className="flex items-center justify-between p-5 border-b">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                                </h2>
                                <button
                                    onClick={handleFormClose}
                                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                >
                                    &times;
                                </button>
                            </div>
                            <ProductForm
                                initialData={editingProduct}
                                onSuccess={handleFormSuccess}
                                onCancel={handleFormClose}
                                categories={categories}
                            />
                        </div>
                    </div>
                )}

                {showCategoryModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                            <div className="flex items-center justify-between p-5 border-b">
                                <h2 className="text-xl font-semibold text-gray-800">Add New Category</h2>
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                                >
                                    &times;
                                </button>
                            </div>
                            <form onSubmit={handleCreateCategory} className="p-5 space-y-4">
                                {categoryError && (
                                    <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                                        {categoryError}
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="newCategoryName" className="block text-sm font-medium text-gray-700 mb-1">
                                        Category Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        id="newCategoryName"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        required
                                        placeholder="e.g. Mobile Phones"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    />
                                </div>
                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCategoryModal(false)}
                                        className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingCategory}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                                    >
                                        {creatingCategory ? 'Saving...' : 'Create Category'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Products Table */}
                <div className="bg-white shadow rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-10 text-center text-gray-500">Loading products…</div>
                    ) : products.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            No products found. Click "Add New Product" to get started.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {['Image', 'Name', 'SKU', 'Category', 'Price', 'Stock', 'Actions'].map((h) => (
                                            <th
                                                key={h}
                                                className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {products.map((product) => (
                                        <tr key={product.id} className="hover:bg-gray-50 transition">
                                            <td className="px-6 py-4">
                                                {product.imageUrl && !brokenImages.has(product.id) ? (
                                                    <img
                                                        src={product.imageUrl}
                                                        alt={product.name}
                                                        className="h-12 w-12 object-cover rounded-lg"
                                                        onError={() => handleImageError(product.id)}
                                                    />
                                                ) : (
                                                    <div
                                                        className="h-12 w-12 bg-gray-200 rounded-lg flex items-center justify-center text-gray-400 text-xs"
                                                        aria-label="No image available"
                                                    >
                                                        No img
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{product.name}</div>
                                                {product.description && (
                                                    <div className="text-sm text-gray-500 truncate max-w-xs">
                                                        {product.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">
                                                {product.sku}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                                                    {product.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                                                ${Number(product.basePrice).toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                                                {Number(product.availableStock ?? product.stockQuantity ?? 0)}
                                            </td>
                                            <td className="px-6 py-4 space-x-2">
                                                <button
                                                    onClick={() => handleEdit(product)}
                                                    className="bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-medium px-3 py-1.5 rounded"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product.id)}
                                                    className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium px-3 py-1.5 rounded"
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
