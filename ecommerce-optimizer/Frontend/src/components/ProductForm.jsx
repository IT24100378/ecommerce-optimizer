import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/products';

const EMPTY_FORM = {
    name: '',
    description: '',
    sku: '',
    category: '',
    basePrice: '',
    imageUrl: '',
};

export default function ProductForm({ initialData, onSuccess, onCancel }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Populate form when editing an existing product
    useEffect(() => {
        if (initialData) {
            setForm({
                name: initialData.name || '',
                description: initialData.description || '',
                sku: initialData.sku || '',
                category: initialData.category || '',
                basePrice: initialData.basePrice || '',
                imageUrl: initialData.imageUrl || '',
            });
        } else {
            setForm(EMPTY_FORM);
        }
    }, [initialData]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);

        const payload = {
            ...form,
            basePrice: parseFloat(form.basePrice) || 0,
        };

        try {
            let savedProduct;
            if (initialData) {
                // UPDATE existing product
                const { data } = await axios.put(`${API_URL}/${initialData.id}`, payload);
                savedProduct = data.product;
            } else {
                // CREATE new product
                const { data } = await axios.post(API_URL, payload);
                savedProduct = data.product;
            }
            onSuccess(savedProduct, !!initialData);
        } catch (err) {
            const message =
                err.response?.data?.error || 'An error occurred. Please try again.';
            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    const fields = [
        { id: 'name', label: 'Product Name', type: 'text', required: true, placeholder: 'e.g. Wireless Headphones' },
        { id: 'sku', label: 'SKU', type: 'text', required: true, placeholder: 'e.g. WH-1000XM5' },
        { id: 'category', label: 'Category', type: 'text', required: true, placeholder: 'e.g. Electronics' },
        { id: 'basePrice', label: 'Base Price ($)', type: 'number', required: true, placeholder: '0.00', step: '0.01', min: '0' },
        { id: 'imageUrl', label: 'Image URL', type: 'url', required: false, placeholder: 'https://example.com/image.jpg' },
    ];

    return (
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                    {error}
                </div>
            )}

            {fields.map(({ id, label, type, required, placeholder, step, min }) => (
                <div key={id}>
                    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
                        {label} {required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                        id={id}
                        name={id}
                        type={type}
                        required={required}
                        placeholder={placeholder}
                        step={step}
                        min={min}
                        value={form[id]}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
            ))}

            <p className="text-xs text-gray-500">
                Stock is managed in the Inventory module. New products start at stock 0.
            </p>

            {/* Description textarea */}
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                </label>
                <textarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="Optional product description…"
                    value={form.description}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
            </div>

            <div className="flex justify-end space-x-3 pt-2">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                    {submitting ? 'Saving…' : initialData ? 'Update Product' : 'Create Product'}
                </button>
            </div>
        </form>
    );
}
