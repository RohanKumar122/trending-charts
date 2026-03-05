import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Coins, Gem, RefreshCcw, TrendingUp, Clock, 
  AlertTriangle, Loader2, Sparkles, ShieldCheck,
  Trophy, Users, Activity, Zap, ZapOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BASE_API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/rates').replace('/api/rates', '');

function App() {
  const [data, setData] = useState(null);
  const [cricketData, setCricketData] = useState(null);
  const [activeTab, setActiveTab] = useState('metals');
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const fetchRates = async (isManualRefresh = false) => {
    const RATES_URL = `${BASE_API}/api/rates`;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    
    setError(null);
    try {
      const response = await axios.get(RATES_URL);
      const rates = response.data;
      setData(rates);

      if (isManualRefresh) {
        setStatusMsg('Rates Synced');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching rates:', err);
      setError('Unable to reach the server. Please check your connection.');
    } finally {
      if (!isManualRefresh) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCricket = async (isManualRefresh = false) => {
    const CRICKET_END = `${BASE_API}/api/cricket-scores`;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    
    try {
      const response = await axios.get(CRICKET_END);
      setCricketData(response.data);
      if (isManualRefresh) {
        setStatusMsg('Scores Updated');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching cricket:', err);
    } finally {
      if (!isManualRefresh) setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRates();
    fetchCricket();
    
    let interval;
    if (isAutoRefresh) {
      interval = setInterval(() => {
        if (activeTab === 'cricket') fetchCricket();
        else fetchRates();
      }, 60000);
    }
    
    return () => clearInterval(interval);
  }, [isAutoRefresh, activeTab]);

  return (
    <div className="container">
      <header>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="header-badge"
          style={{ 
            background: 'rgba(56, 189, 248, 0.1)', 
            color: '#38BDF8', 
            padding: '4px 12px', 
            borderRadius: '99px', 
            fontSize: '0.75rem', 
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '1rem'
          }}
        >
          <Sparkles size={14} /> LIVE TICKER
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'metals' ? 'Metals Exchange' : 'Cricket Live'}
        </motion.h1>
        
        <motion.p 
          className="subtitle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {activeTab === 'metals' 
            ? 'The most accurate real-time data for precious metals, sourced directly from premier Indian financial markets.'
            : 'Get the latest match scores, series updates, and real-time results from around the world.'}
        </motion.p>

        {/* Tab Navigation */}
        <div className="tab-nav">
          <button 
            className={`tab-btn ${activeTab === 'metals' ? 'active' : ''}`}
            onClick={() => setActiveTab('metals')}
          >
            <Coins size={18} /> Metals
          </button>
          <button 
            className={`tab-btn ${activeTab === 'cricket' ? 'active' : ''}`}
            onClick={() => setActiveTab('cricket')}
          >
            <Trophy size={18} /> Cricket
          </button>
        </div>

        {/* Auto Refresh Toggle */}
        <div className="auto-refresh-toggle">
          <div className="toggle-label">
            {isAutoRefresh ? <Zap size={14} className="zap-icon" /> : <ZapOff size={14} />}
            Auto Sync {isAutoRefresh ? 'ON' : 'OFF'}
          </div>
          <button 
            className={`toggle-switch ${isAutoRefresh ? 'on' : ''}`}
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
          >
            <div className="switch-handle" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {statusMsg && (
          <motion.div 
            className="status-toast"
            initial={{ y: 50, opacity: 0, scale: 0.9, x: '-50%' }}
            animate={{ y: 0, opacity: 1, scale: 1, x: '-50%' }}
            exit={{ y: 20, opacity: 0, scale: 0.9, x: '-50%' }}
          >
            {refreshing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {statusMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div 
          className="error-msg"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <AlertTriangle size={20} />
          <span>{error}</span>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <div className="grid">
            {activeTab === 'metals' ? (
              <>
                <LoadingCard title="Gold Reserve" icon={<Coins className="gold-text" size={28} />} />
                <LoadingCard title="Silver Assets" icon={<Gem className="silver-text" size={28} />} />
              </>
            ) : (
              <>
                <LoadingCard title="Loading Matches..." icon={<Activity size={28} />} />
                <LoadingCard title="Syncing Scores..." icon={<Activity size={28} />} />
              </>
            )}
          </div>
        ) : (
          <motion.div 
            key={activeTab}
            className="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'metals' ? (
              <>
                {/* Gold Card */}
                <motion.div className="card gold-card" whileHover={{ y: -8 }}>
                  <div className="card-header">
                    <div className="card-title">
                      <Coins className="gold-text" size={32} /> Gold Reserve
                    </div>
                    <TrendingUp size={20} className="gold-text" style={{ opacity: 0.5 }} />
                  </div>
                  <div className="price-display">
                    <div className="price-item">
                      <div className="label">Pure 24K Gold (10g)</div>
                      <div className="value gold-text">{data?.gold?.gold24K || '₹ --'}</div>
                    </div>
                    <div className="price-item">
                      <div className="label">Standard 22K (10g)</div>
                      <div className="value gold-text" style={{ opacity: 0.8 }}>{data?.gold?.gold22K || '₹ --'}</div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <ShieldCheck size={14} style={{ marginRight: '6px' }} /> Certified Purity Standards
                  </div>
                </motion.div>

                {/* Silver Card */}
                <motion.div className="card silver-card" whileHover={{ y: -8 }}>
                  <div className="card-header">
                    <div className="card-title">
                      <Gem className="silver-text" size={32} /> Silver Assets
                    </div>
                    <TrendingUp size={20} className="silver-text" style={{ opacity: 0.5 }} />
                  </div>
                  <div className="price-display">
                    <div className="price-item">
                      <div className="label">Fine Silver (1 Gram)</div>
                      <div className="value silver-text">{data?.silver?.silverPerGram || '₹ --'}</div>
                    </div>
                    <div className="price-item" style={{ borderBottom: 'none' }}>
                      <div className="label">Bulk Silver (1 KG)</div>
                      <div className="value silver-text" style={{ opacity: 0.8 }}>{data?.silver?.silverPerKg || '₹ --'}</div>
                    </div>
                  </div>
                  <div className="card-footer">
                    <ShieldCheck size={14} style={{ marginRight: '6px' }} /> Industrial Grade Verified
                  </div>
                </motion.div>
              </>
            ) : (
              <>
                {cricketData?.matches?.map((match) => (
                  <motion.div 
                    key={match.matchId} 
                    className="card cricket-card" 
                    whileHover={{ scale: 1.01 }}
                  >
                    <div className="match-series">{match.seriesName}</div>
                    <div className="match-teams">
                      <div className="team-row">
                        <span className="team-name">{match.team1.name}</span>
                        <span className="team-score">{match.team1.score || '--'}</span>
                      </div>
                      <div className="team-row">
                        <span className="team-name">{match.team2.name}</span>
                        <span className="team-score">{match.team2.score || '--'}</span>
                      </div>
                    </div>
                    <div className={`match-status ${match.state === 'Live' ? 'live' : ''}`}>
                      {match.state === 'Live' && <span className="live-dot" />}
                      {match.status}
                    </div>
                    <div className="match-desc">{match.matchDesc}</div>
                  </motion.div>
                ))}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        className="controls"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <button 
          className="refresh-btn" 
          onClick={() => activeTab === 'metals' ? fetchRates(true) : fetchCricket(true)} 
          disabled={loading || refreshing}
        >
          {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
          {refreshing ? 'Syncing...' : 'Update Data'}
        </button>
      </motion.div>

      {(activeTab === 'metals' ? data : cricketData) && (
        <motion.div 
          className="updated-time"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Clock size={12} />
          As of {new Date(activeTab === 'metals' ? data?.timestamp : cricketData?.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • IST
          {(activeTab === 'metals' ? data : cricketData)?.source === 'cache' && refreshing && (
            <span style={{ color: '#38BDF8' }}>(Syncing)</span>
          )}
        </motion.div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin { animation: spin 0.8s linear infinite; }
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
        {[1, 2].map((i) => (
          <div key={i} className="price-item" style={{ border: 'none' }}>
            <div className="loading-shimmer" style={{ width: '30%', height: '14px', marginBottom: '8px' }}></div>
            <div className="loading-shimmer" style={{ width: '60%', height: '32px' }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
