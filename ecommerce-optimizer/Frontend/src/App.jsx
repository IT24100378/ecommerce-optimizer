import React, { useState, useEffect } from 'react';
import ProductDashboard from './components/ProductDashboard';
import OrderDashboard from './components/OrderDashboard';
import ReviewDashboard from './components/ReviewDashboard';
import InventoryDashboard from './components/InventoryDashboard';
import PromotionDashboard from './components/PromotionDashboard';
import UserDashboard from './components/UserDashboard';
import ForecastDashboard from './components/ForecastDashboard';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'products', label: 'Products', icon: '📦' },
  { id: 'orders', label: 'Orders', icon: '🛒' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
  { id: 'inventory', label: 'Inventory', icon: '🏭' },
  { id: 'promotions', label: 'Promotions', icon: '🎁' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'forecasts', label: 'AI Forecasts', icon: '🤖' },
];

function StatCard({ label, value, icon, color }) {
  return (
    <div className={`bg-white rounded-2xl shadow p-6 flex items-center gap-4 border-l-4 ${color} transition-all duration-200 hover:shadow-lg hover:-translate-y-1`}>
      <div className="text-4xl">{icon}</div>
      <div>
        <p className="text-gray-500 text-sm font-medium">{label}</p>
        <p className="text-3xl font-bold text-gray-800">{value ?? '–'}</p>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [products, orders, reviews, inventory, promotions, users] = await Promise.all([
          axios.get(`${API}/api/products`),
          axios.get(`${API}/api/orders`),
          axios.get(`${API}/api/reviews?adminView=true`),
          axios.get(`${API}/api/inventory`),
          axios.get(`${API}/api/promotions`),
          axios.get(`${API}/api/users`),
        ]);
        setStats({
          products: products.data.length,
          orders: orders.data.length,
          reviews: reviews.data.length,
          inventory: inventory.data.length,
          promotions: promotions.data.length,
          users: users.data.length,
        });
      } catch {
        // ignore errors on dashboard
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Products', value: stats.products, icon: '📦', color: 'border-indigo-500' },
    { label: 'Orders', value: stats.orders, icon: '🛒', color: 'border-blue-500' },
    { label: 'Reviews', value: stats.reviews, icon: '⭐', color: 'border-yellow-500' },
    { label: 'Inventory Items', value: stats.inventory, icon: '🏭', color: 'border-green-500' },
    { label: 'Promotions', value: stats.promotions, icon: '🎁', color: 'border-pink-500' },
    { label: 'Users', value: stats.users, icon: '👥', color: 'border-purple-500' },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Dashboard Overview</h1>
      <p className="text-gray-500 mb-8">Welcome to the E-Commerce Inventory Optimizer</p>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map(c => <StatCard key={c.label} {...c} />)}
        </div>
      )}
      <div className="mt-10 bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Quick Info</h2>
        <p className="text-gray-500 text-sm">Use the sidebar to navigate between modules. Each module allows full CRUD operations on the respective data. The AI Forecasts module lets you generate future sales predictions for selected products.</p>
      </div>
    </div>
  );
}

function AdminLogin({ onLogin, error, loading }) {
  const [email, setEmail] = useState('admin@ecommerce.local');
  const [password, setPassword] = useState('Admin@12345');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onLogin({ email, password });
        }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4"
      >
        <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>
        <p className="text-sm text-gray-500">Use your admin credentials to access the dashboard.</p>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-200 disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    try {
      const savedUser = JSON.parse(localStorage.getItem('sf_user') || 'null');
      const savedToken = localStorage.getItem('sf_token');
      if (savedUser?.role === 'ADMIN' && savedToken) {
        setAdminUser(savedUser);
        axios.defaults.headers.common.Authorization = `Bearer ${savedToken}`;
      }
    } catch {
      localStorage.removeItem('sf_user');
      localStorage.removeItem('sf_token');
    }
  }, []);

  const handleAdminLogin = async ({ email, password }) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data } = await axios.post(`${API}/api/users/login`, { email, password });
      if (data.role !== 'ADMIN' || !data.token) {
        setAuthError('Only admin users can access this page.');
        return;
      }
      localStorage.setItem('sf_user', JSON.stringify(data));
      localStorage.setItem('sf_token', data.token);
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      setAdminUser(data);
    } catch (e) {
      setAuthError(e.response?.data?.error || 'Invalid email or password');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminUser(null);
    setAuthError('');
    localStorage.removeItem('sf_user');
    localStorage.removeItem('sf_token');
    delete axios.defaults.headers.common.Authorization;
  };

  if (!adminUser) {
    return <AdminLogin onLogin={handleAdminLogin} error={authError} loading={authLoading} />;
  }

  const renderContent = () => {
    switch (active) {
      case 'dashboard': return <DashboardOverview />;
      case 'products': return <ProductDashboard />;
      case 'orders': return <OrderDashboard />;
      case 'reviews': return <ReviewDashboard />;
      case 'inventory': return <InventoryDashboard />;
      case 'promotions': return <PromotionDashboard />;
      case 'users': return <UserDashboard />;
      case 'forecasts': return <ForecastDashboard />;
      default: return <DashboardOverview />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 flex flex-col shadow-2xl z-20`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-indigo-700">
          {sidebarOpen && (
            <span className="text-white font-bold text-base leading-tight">
              📈 Inventory<br />Optimizer
            </span>
          )}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="text-indigo-200 hover:text-white transition-colors duration-200 ml-auto"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-200 rounded-lg mx-1 my-0.5
                ${active === item.id
                  ? 'bg-white bg-opacity-20 text-white font-semibold shadow-inner'
                  : 'text-indigo-200 hover:bg-white hover:bg-opacity-10 hover:text-white'}`}
              style={{ width: sidebarOpen ? 'calc(100% - 8px)' : 'calc(100% - 8px)' }}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-sm truncate">{item.label}</span>}
            </button>
          ))}
        </nav>
        {sidebarOpen && (
          <div className="px-4 py-3 border-t border-indigo-700 space-y-2">
            <a
              href="/"
              className="flex items-center gap-2 text-indigo-300 hover:text-white text-xs transition-colors duration-200"
            >
              🛍️ View Customer Store
            </a>
            <p className="text-indigo-400 text-xs">E-Commerce Optimizer v1.0</p>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <h2 className="text-lg font-semibold text-gray-700 capitalize">
            {navItems.find(n => n.id === active)?.icon} {navItems.find(n => n.id === active)?.label}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{adminUser.email}</span>
            <button
              onClick={handleAdminLogout}
              className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg font-medium"
            >
              Logout
            </button>
          </div>
        </header>
        <div className="p-8">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
