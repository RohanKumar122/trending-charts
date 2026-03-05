import { useState, useEffect } from 'react';
import axios from 'axios';
import { Coins, Gem, RefreshCcw, TrendingUp, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/rates';

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchRates = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const response = await axios.get(API_URL);
      const rates = response.data;
      
      setData(rates);

      // If we got cached data during a manual refresh, we poll for the new data
      if (isManualRefresh && rates.source === 'cache') {
        setStatusMsg('Live update in progress...');
        
        // Wait 18 seconds (Groww usually takes 15s) and fetch again
        setTimeout(async () => {
          try {
            const retryResponse = await axios.get(API_URL);
            setData(retryResponse.data);
            setStatusMsg('Rates updated to latest!');
            setTimeout(() => setStatusMsg(''), 3000);
          } catch (e) {
            console.error('Retry failed', e);
          } finally {
            setRefreshing(false);
          }
        }, 18000);
      } else {
        setRefreshing(false);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Connection issue. Please check your internet or try again later.');
      setRefreshing(false);
    } finally {
      if (!isManualRefresh) setLoading(false);
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

      {statusMsg && (
        <motion.div 
          className="status-toast"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
        >
          {refreshing && <Loader2 size={14} className="animate-spin" style={{ marginRight: '8px' }} />}
          {statusMsg}
        </motion.div>
      )}

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
              <div className="card-footer" style={{ background: 'rgba(255, 215, 0, 0.05)' }}>
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
              <div className="card-footer" style={{ background: 'rgba(229, 228, 226, 0.1)' }}>
                Premium Industrial Grade
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="controls">
        <button 
          className="refresh-btn" 
          onClick={() => fetchRates(true)} 
          disabled={loading || refreshing}
        >
          <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Live Updating...' : 'Refresh Rates'}
        </button>
      </div>

      {data && (
        <div className="updated-time">
          <Clock size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Last updated: {new Date(data.timestamp).toLocaleString()}
          {data.source === 'cache' && refreshing && (
            <span style={{ marginLeft: '10px', color: '#63b3ed', fontSize: '0.8rem' }}>(Background Syncing...)</span>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 1s linear infinite; }
        
        .status-toast {
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(49, 130, 206, 0.2);
          color: #63b3ed;
          padding: 8px 16px;
          border-radius: 20px;
          margin: 10px auto;
          width: fit-content;
          font-size: 0.85rem;
          border: 1px solid rgba(99, 179, 237, 0.3);
          backdrop-filter: blur(4px);
        }

        .controls {
          display: flex;
          justify-content: center;
          margin-top: 2rem;
        }

        .card-footer {
          padding: 0.6rem 1rem;
          border-radius: 12px;
          margin-top: 1rem;
          font-size: 0.85rem;
          text-align: center;
        }
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
