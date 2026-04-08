import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
const MAX_DAYS = 366;

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function addDaysToDate(dateString, daysToAdd) {
  const base = new Date(`${dateString}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + daysToAdd);
  return formatDateInput(base);
}

function inclusiveDaysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

function ForecastResultCard({ forecast }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-gray-500">Date</p>
      <p className="text-sm font-semibold text-gray-800">
        {new Date(forecast.forecastForDate).toLocaleDateString()}
      </p>
      <p className="text-xs text-gray-500 mt-2">Predicted sales</p>
      <p className="text-2xl font-bold text-indigo-600">{forecast.predictedDemand}</p>
      <p className="text-xs text-gray-400">units</p>
    </div>
  );
}

function ForecastTimeline({ forecasts }) {
  if (!forecasts.length) return null;
  const maxValue = Math.max(...forecasts.map((f) => f.predictedDemand), 1);

  return (
    <div className="bg-white rounded-2xl shadow p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Prediction timeline</h3>
      <div className="flex items-end gap-2 h-40">
        {forecasts.map((forecast) => {
          const height = Math.max((forecast.predictedDemand / maxValue) * 100, 6);
          return (
            <div key={forecast.id} className="flex-1 min-w-0 text-center">
              <div className="text-xs text-gray-500 mb-1">{forecast.predictedDemand}</div>
              <div
                className="w-full rounded-t-md bg-indigo-500 hover:bg-indigo-600 transition-colors"
                style={{ height: `${height}%` }}
                title={`${new Date(forecast.forecastForDate).toLocaleDateString()}: ${forecast.predictedDemand}`}
              />
              <div className="text-[10px] text-gray-400 mt-1 truncate">
                {new Date(forecast.forecastForDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ForecastDashboard() {
  const today = useMemo(() => formatDateInput(new Date()), []);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [days, setDays] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    const loadProducts = async () => {
      setLoadingProducts(true);
      try {
        const response = await axios.get(`${API}/api/products`);
        setProducts(response.data || []);
      } catch (e) {
        setError(e.response?.data?.error || 'Failed to load products');
      } finally {
        setLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === String(selectedProductId)),
    [products, selectedProductId]
  );

  const handleStartDateChange = (nextStartDate) => {
    setStartDate(nextStartDate);
    if (!endDate || inclusiveDaysBetween(nextStartDate, endDate) < 1) {
      setEndDate(nextStartDate);
      setDays(1);
      return;
    }
    const rangeDays = inclusiveDaysBetween(nextStartDate, endDate);
    setDays(Math.min(rangeDays, MAX_DAYS));
  };

  const handleDaysChange = (value) => {
    const normalizedDays = Math.min(Math.max(Number(value) || 1, 1), MAX_DAYS);
    setDays(normalizedDays);
    setEndDate(addDaysToDate(startDate, normalizedDays - 1));
  };

  const handleEndDateChange = (nextEndDate) => {
    if (!nextEndDate || inclusiveDaysBetween(startDate, nextEndDate) < 1) {
      setEndDate(startDate);
      setDays(1);
      return;
    }
    const rangeDays = Math.min(inclusiveDaysBetween(startDate, nextEndDate), MAX_DAYS);
    setEndDate(addDaysToDate(startDate, rangeDays - 1));
    setDays(rangeDays);
  };

  const handlePredict = async (event) => {
    event.preventDefault();
    setError('');
    setPredicting(true);
    setResult(null);

    const parsedDays = Number(days);
    if (!startDate) {
      setError('Start date is required');
      setPredicting(false);
      return;
    }
    if (!endDate) {
      setError('End date is required');
      setPredicting(false);
      return;
    }
    if (!parsedDays || Number.isNaN(parsedDays) || parsedDays < 1 || parsedDays > MAX_DAYS) {
      setError(`Days must be between 1 and ${MAX_DAYS}`);
      setPredicting(false);
      return;
    }

    try {
      const response = await axios.post(`${API}/api/forecasts/predict`, {
        productId: Number(selectedProductId),
        startDate,
        endDate,
        days: parsedDays,
      });
      setResult(response.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate AI forecast');
    } finally {
      setPredicting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">AI Sales Forecast</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select an existing product and generate predictions for any single date or custom date range.
        </p>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-5">
        <form className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end" onSubmit={handlePredict}>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={loadingProducts || predicting}
              required
              className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
            >
              <option value="">Select a product</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              disabled={predicting}
              required
              className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Days</label>
            <input
              type="number"
              min={1}
              max={MAX_DAYS}
              value={days}
              onChange={(e) => handleDaysChange(e.target.value)}
              disabled={predicting}
              required
              className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
            />
            <p className="text-[11px] text-gray-500 mt-1">1 to {MAX_DAYS} days</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              disabled={predicting}
              required
              className="w-full border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              {startDate && endDate ? `${inclusiveDaysBetween(startDate, endDate)} day range` : ''}
            </p>
          </div>

          <button
            type="submit"
            disabled={!selectedProductId || predicting || loadingProducts}
            className="bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {predicting ? 'Predicting…' : 'Generate Forecast'}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow p-5">
            <h2 className="text-lg font-semibold text-gray-800">
              {result.product?.name || selectedProduct?.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              SKU: {result.product?.sku || selectedProduct?.sku} · Category: {result.product?.category || selectedProduct?.category}
            </p>
            <p className="text-sm text-indigo-600 font-medium mt-3">
              Showing AI predictions from {new Date(`${result.startDate}T00:00:00.000Z`).toLocaleDateString()} to{' '}
              {new Date(`${result.endDate}T00:00:00.000Z`).toLocaleDateString()} ({result.days} day
              {result.days > 1 ? 's' : ''}).
            </p>
          </div>

          <ForecastTimeline forecasts={result.predictions || []} />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {(result.predictions || []).map((forecast) => (
              <ForecastResultCard key={forecast.id} forecast={forecast} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
