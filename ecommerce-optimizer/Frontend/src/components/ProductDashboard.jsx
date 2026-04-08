import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProductForm from './ProductForm';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/products';

export default function ProductDashboard() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [brokenImages, setBrokenImages] = useState(new Set());

    const handleImageError = (id) => {
        setBrokenImages((prev) => new Set([...prev, id]));
    };

    // Fetch all active products on component mount
    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(API_URL);
            setProducts(data);
            setError('');
        } catch (err) {
            setError('Failed to load products. Please ensure the backend server is running.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this product?')) return;
        try {
            await axios.delete(`${API_URL}/${id}`);
            // Remove the deleted row from state without a full re-fetch
            setProducts((prev) => prev.filter((p) => p.id !== id));
        } catch (err) {
            alert('Failed to delete product. Please try again.');
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
        handleFormClose();
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">Product Catalog</h1>
                    <button
                        onClick={() => { setEditingProduct(null); setShowForm(true); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg shadow"
                    >
                        + Add New Product
                    </button>
                </div>

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
                            />
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
                                                {Number(product.stockQuantity ?? 0)}
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
