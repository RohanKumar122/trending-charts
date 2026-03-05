import { useState, useEffect } from 'react';
import axios from 'axios';
import { Coins, Gem, RefreshCcw, TrendingUp, Clock, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/rates';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRates = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const response = await axios.get(API_URL);
      setData(response.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Wait, we are fetching some LIVE rates for you! Please retry in a moment if it shows an error.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRates();
  }, []);

  return (
    <div className="container">
      <header>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          Metals Exchange
        </motion.h1>
        <motion.p 
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          Live Precious Metals Rates • Curated from Groww
        </motion.p>
      </header>

      {error && (
        <motion.div 
          className="error-msg"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <AlertTriangle size={20} />
          <span>{error}</span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="grid">
            <LoadingCard title="Gold Rates" icon={<Coins className="gold-text" size={24} />} />
            <LoadingCard title="Silver Rates" icon={<Gem className="silver-text" size={24} />} />
          </div>
        ) : (
          <motion.div 
            className="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Gold Card */}
            <motion.div 
              className="card"
              whileHover={{ y: -8 }}
              style={{ border: '1px solid rgba(255, 215, 0, 0.1)' }}
            >
              <div className="card-header">
                <div className="card-title">
                  <span className="gold-text">🪙</span> Gold
                </div>
                <TrendingUp size={18} className="gold-text" style={{ opacity: 0.6 }} />
              </div>
              
              <div className="price-display">
                <div className="price-item">
                  <div className="label">24K Gold (10g)</div>
                  <div className="value gold-text">{data?.gold?.gold24K || '₹ --'}</div>
                </div>
                <div className="price-item">
                  <div className="label">22K Gold (10g)</div>
                  <div className="value gold-text" style={{ opacity: 0.8 }}>{data?.gold?.gold22K || '₹ --'}</div>
                </div>
              </div>
              <div style={{ padding: '0.8rem 1rem', background: 'rgba(255, 215, 0, 0.05)', borderRadius: '12px', marginTop: '1rem', fontSize: '0.9rem' }}>
                Refinery Quality Assured
              </div>
            </motion.div>

            {/* Silver Card */}
            <motion.div 
              className="card"
              whileHover={{ y: -8 }}
              style={{ border: '1px solid rgba(229, 228, 226, 0.1)' }}
            >
              <div className="card-header">
                <div className="card-title">
                  <span className="silver-text">💎</span> Silver
                </div>
                <TrendingUp size={18} className="silver-text" style={{ opacity: 0.6 }} />
              </div>
              
              <div className="price-display">
                <div className="price-item">
                  <div className="label">Silver (1 Gram)</div>
                  <div className="value silver-text">{data?.silver?.silverPerGram || '₹ --'}</div>
                </div>
                <div className="price-item">
                  <div className="label">Silver (1 KG)</div>
                  <div className="value silver-text" style={{ opacity: 0.8 }}>{data?.silver?.silverPerKg || '₹ --'}</div>
                </div>
              </div>
              <div style={{ padding: '0.8rem 1rem', background: 'rgba(229, 228, 226, 0.1)', borderRadius: '12px', marginTop: '1rem', fontSize: '0.9rem' }}>
                Premium Industrial Grade
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        className="refresh-btn" 
        onClick={() => fetchRates(true)} 
        disabled={loading || refreshing}
      >
        <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        {refreshing ? 'Fetching...' : 'Refresh Rates'}
      </button>

      {data && (
        <div className="updated-time">
          <Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Last updated: {new Date(data.timestamp).toLocaleString()}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

function LoadingCard({ title, icon }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{icon} {title}</div>
      </div>
      <div className="price-display">
        <div className="price-item">
          <div className="loading-shimmer" style={{ width: '40%' }}></div>
          <div className="loading-shimmer" style={{ width: '30%' }}></div>
        </div>
        <div className="price-item">
          <div className="loading-shimmer" style={{ width: '40%' }}></div>
          <div className="loading-shimmer" style={{ width: '30%' }}></div>
        </div>
      </div>
    </div>
  );
}

export default App;
