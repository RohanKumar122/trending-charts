import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Coins, Gem, RefreshCcw, TrendingUp, Clock, 
  AlertTriangle, Loader2, Sparkles, ShieldCheck,
  Trophy, Users, Activity, Zap, ZapOff, X, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';

const BASE_API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/rates').replace('/api/rates', '');

function App() {
  const [data, setData] = useState(null);
  const [cricketData, setCricketData] = useState(null);
  const [cricketError, setCricketError] = useState(null);
  const [activeTab, setActiveTab] = useState('metals');
  const [isAutoRefresh, setIsAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [showHistory, setShowHistory] = useState(null); // 'gold' or 'silver'
  const [historyLoading, setHistoryLoading] = useState(false);

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
    setCricketError(null);
    
    try {
      const response = await axios.get(CRICKET_END);
      setCricketData(response.data);
      if (isManualRefresh) {
        setStatusMsg('Scores Updated');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error fetching cricket:', err);
      setCricketError('Unable to load cricket scores. The server may be unavailable or the scraper was blocked.');
    } finally {
      if (!isManualRefresh) setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await axios.get(`${BASE_API}/api/history`);
      setHistoryData(response.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchRates();
    fetchCricket();
    fetchHistory();
    
    let interval;
    if (isAutoRefresh) {
      interval = setInterval(() => {
        if (activeTab === 'cricket') fetchCricket();
        else {
          fetchRates();
          fetchHistory();
        }
      }, 60000);
    }
    
    return () => clearInterval(interval);
  }, [isAutoRefresh, activeTab]);

  const getPriceTrend = (metal) => {
    if (!historyData || !Array.isArray(historyData) || historyData.length < 2) {
      return { diff: 0, percent: 0, direction: 'none' };
    }
    
    // Filter out malformed records and sort by time descending
    const validHistory = historyData
      .filter(item => item && item.gold && item.silver)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (validHistory.length < 2) return { diff: 0, percent: 0, direction: 'none' };
    
    const latest = validHistory[0];
    
    // Find the record closest to 24 hours ago
    const now = new Date(latest.timestamp).getTime();
    const targetTime = now - (24 * 60 * 60 * 1000);
    
    let previous = validHistory[1];
    let minDiff = Math.abs(new Date(previous.timestamp).getTime() - targetTime);

    for (let i = 2; i < validHistory.length; i++) {
      const time = new Date(validHistory[i].timestamp).getTime();
      const diff = Math.abs(time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        previous = validHistory[i];
      }
    }

    let currentVal, previousVal;
    
    try {
      if (metal === 'gold') {
        currentVal = latest.gold?.num24K;
        previousVal = previous.gold?.num24K;
      } else {
        currentVal = latest.silver?.numKg;
        previousVal = previous.silver?.numKg;
      }

      if (!currentVal || !previousVal) {
        return { diff: 0, percent: 0, direction: 'none' };
      }

      const diff = currentVal - previousVal;
      const percent = ((diff / previousVal) * 100).toFixed(2);
      
      return {
        diff,
        percent: Math.abs(percent),
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'none'
      };
    } catch (e) {
      console.error("Trend calculation error:", e);
      return { diff: 0, percent: 0, direction: 'none' };
    }
  };

  const TrendBadge = ({ trend, metal }) => {
    if (trend.direction === 'none') return <div className="trend-badge none"><Minus size={12} /> --%</div>;
    
    return (
      <div className={`trend-badge ${trend.direction}`}>
        {trend.direction === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        <span>
          ₹{Math.abs(trend.diff).toLocaleString('en-IN')} / {trend.percent}%
        </span>
      </div>
    );
  };

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
                <motion.div 
                  className="card gold-card clickable" 
                  whileHover={{ y: -8 }}
                  onClick={() => setShowHistory('gold')}
                >
                  <div className="card-header">
                    <div className="card-title">
                      <Coins className="gold-text" size={32} /> Gold Reserve
                    </div>
                    <TrendBadge trend={getPriceTrend('gold')} />
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
                    <ShieldCheck size={14} style={{ marginRight: '6px' }} /> View Historical Comparison
                  </div>
                </motion.div>

                {/* Silver Card */}
                <motion.div 
                  className="card silver-card clickable" 
                  whileHover={{ y: -8 }}
                  onClick={() => setShowHistory('silver')}
                >
                  <div className="card-header">
                    <div className="card-title">
                      <Gem className="silver-text" size={32} /> Silver Assets
                    </div>
                    <TrendBadge trend={getPriceTrend('silver')} />
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
                    <ShieldCheck size={14} style={{ marginRight: '6px' }} /> View Historical Comparison
                  </div>
                </motion.div>
              </>
            ) : (
              <>
                {cricketError ? (
                  <motion.div
                    className="card"
                    style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <AlertTriangle size={36} style={{ margin: '0 auto 1rem', color: '#f59e0b' }} />
                    <div style={{ color: '#f59e0b', fontWeight: 700, marginBottom: '0.5rem' }}>Cricket Scores Unavailable</div>
                    <div style={{ color: '#94A3B8', fontSize: '0.875rem' }}>{cricketError}</div>
                  </motion.div>
                ) : cricketData?.matches?.length === 0 ? (
                  <motion.div
                    className="card"
                    style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <Trophy size={36} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
                    <div style={{ color: '#94A3B8' }}>No live matches at the moment.</div>
                  </motion.div>
                ) : (
                  cricketData?.matches?.map((match) => (
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
                  ))
                )}
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
          onClick={() => {
            if (activeTab === 'metals') {
              fetchRates(true);
              fetchHistory();
            } else {
              fetchCricket(true);
            }
          }} 
          disabled={loading || refreshing}
        >
          {refreshing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCcw size={18} />}
          {refreshing ? 'Syncing...' : 'Update Data'}
        </button>
      </motion.div>

      <HistoryModal 
        isOpen={!!showHistory} 
        onClose={() => setShowHistory(null)} 
        metal={showHistory} 
        data={historyData}
        loading={historyLoading}
      />

      {data && (
        <motion.div 
          className="updated-time"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Clock size={12} />
          As of {new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • IST
          {data.source === 'cache' && refreshing && (
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

function HistoryModal({ isOpen, onClose, metal, data, loading }) {
  if (!isOpen) return null;

  const filteredData = data
    .filter(item => {
      if (!item || !item.gold || !item.silver) return false;
      const price = metal === 'gold' ? item.gold.num24K : item.silver.numKg;
      return price && price > 0;  // filter out zero/undefined prices
    })
    .map(item => ({
      // ✅ Fix: toLocaleTimeString doesn't accept day/month — use toLocaleString instead
      time: new Date(item.timestamp).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      price: metal === 'gold' ? item.gold.num24K : item.silver.numKg,
      rawTime: new Date(item.timestamp)
    })).sort((a, b) => a.rawTime - b.rawTime);

  const metalName = metal === 'gold' ? 'Gold (24K per 10g)' : 'Silver (1KG)';
  const color = metal === 'gold' ? '#FFD700' : '#E5E4E2';

  // ✅ Fix: Metal-aware Y-axis — gold is in the ₹70k-90k range, silver in ₹80k-100k per kg
  const yAxisFormatter = (val) => `₹${(val / 1000).toFixed(1)}k`;

  // ✅ Fix: Safe price formatter — never crashes on undefined/null
  const safePrice = (price) => (price != null ? `₹${Number(price).toLocaleString('en-IN')}` : '₹--');

  return (
    <motion.div 
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div 
        className="modal-content"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{metalName} Price History</h2>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="chart-container">
          {loading ? (
            <div className="chart-loading">
              <Loader2 className="animate-spin" size={40} />
              <p>Fetching history...</p>
            </div>
          ) : filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="time" 
                  stroke="#94A3B8" 
                  fontSize={9}
                  tick={{ fill: '#94A3B8' }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="#94A3B8" 
                  fontSize={10}
                  tick={{ fill: '#94A3B8' }}
                  domain={['auto', 'auto']}
                  tickFormatter={yAxisFormatter}
                  width={55}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  formatter={(val) => [safePrice(val), 'Price']}
                  labelStyle={{ color: '#94A3B8', fontSize: '0.75rem' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="price" 
                  stroke={color} 
                  fillOpacity={1} 
                  fill="url(#colorPrice)" 
                  strokeWidth={3}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="no-data">Insufficient historical data for comparison.</div>
          )}
        </div>

        <div className="history-list">
          <h3>Recent Updates</h3>
          <div className="list-items ">
            {[...filteredData].reverse().slice(0, 5).map((item, i, arr) => {
              const prev = arr[i + 1];
              const diff = prev ? item.price - prev.price : 0;
              return (
                <div key={i} className="history-item">
                  <span className="time">{item.time}</span>
                  <span className="price">{safePrice(item.price)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
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
