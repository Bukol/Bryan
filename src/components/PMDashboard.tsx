import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Home, CheckCircle2, Construction, Clock, TrendingUp, 
  Award, AlertTriangle, Plus, Loader2, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';

interface Stats {
  total_houses: number;
  finished: number;
  ongoing: number;
  not_started: number;
}

interface Subcontractor {
  id: number;
  name: string;
  total_awarded: number;
  current_houses: number;
  avg_progress: number;
  completed_houses: number;
  ongoing_houses: number;
}

export default function PMDashboard() {
  const { token, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [subs, setSubs] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);
  const [selectedSub, setSelectedSub] = useState<number | null>(null);
  const [awardCount, setAwardCount] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [awardLoading, setAwardLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/dashboard/pm', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data.stats);
      setSubs(data.subcontractors);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const socket = io();
    socket.on('data_updated', fetchData);
    return () => { socket.disconnect(); };
  }, [token]);

  const handleAward = async () => {
    if (!selectedSub) return;
    setAwardLoading(true);
    try {
      const res = await fetch('/api/houses/award', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ subcontractor_id: selectedSub, count: awardCount, start_date: startDate })
      });
      if (res.ok) {
        setIsAwardModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAwardLoading(false);
    }
  };

  const getPerformanceTag = (progress: number) => {
    if (progress > 75) return { label: 'High Performer', color: 'bg-emerald-100 text-emerald-700', icon: Star };
    if (progress > 40) return { label: 'On Track', color: 'bg-blue-100 text-blue-700', icon: TrendingUp };
    return { label: 'Under Evaluation', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle };
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  const pieData = [
    { name: 'Finished', value: stats?.finished || 0, color: '#10b981' },
    { name: 'Ongoing', value: stats?.ongoing || 0, color: '#3b82f6' },
    { name: 'Not Started', value: stats?.not_started || 0, color: '#94a3b8' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 pb-24 md:pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Manager Dashboard</h1>
          <p className="text-slate-500">Green Valley Estates Overview</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-red-600 transition-colors">Logout</button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Home} label="Total Houses" value={stats?.total_houses || 0} color="bg-slate-100 text-slate-600" />
        <StatCard icon={CheckCircle2} label="Finished" value={stats?.finished || 0} color="bg-emerald-100 text-emerald-600" />
        <StatCard icon={Construction} label="Ongoing" value={stats?.ongoing || 0} color="bg-blue-100 text-blue-600" />
        <StatCard icon={Clock} label="Not Started" value={stats?.not_started || 0} color="bg-amber-100 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Charts */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold mb-6">Subcontractor Progress Comparison</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subs}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="avg_progress" name="Avg Progress %" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-semibold mb-6">Overall Status</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Subcontractor List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Subcontractor Performance Evaluation</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold">Subcontractor</th>
                <th className="px-6 py-4 font-semibold">Awarded</th>
                <th className="px-6 py-4 font-semibold">Completed</th>
                <th className="px-6 py-4 font-semibold">Avg Progress</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subs.map((sub) => {
                const perf = getPerformanceTag(sub.avg_progress);
                const PerfIcon = perf.icon;
                return (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900">{sub.name}</td>
                    <td className="px-6 py-4 text-slate-600">{sub.total_awarded} houses</td>
                    <td className="px-6 py-4 text-slate-600">{sub.completed_houses}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden min-w-[100px]">
                          <div 
                            className="h-full bg-emerald-500 rounded-full" 
                            style={{ width: `${sub.avg_progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{Math.round(sub.avg_progress)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${perf.color}`}>
                        <PerfIcon className="w-3.5 h-3.5" />
                        {perf.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedSub(sub.id); setIsAwardModalOpen(true); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Award
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Award Modal */}
      <AnimatePresence>
        {isAwardModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative"
            >
              <h3 className="text-xl font-bold mb-6">Award Additional Houses</h3>
              
              {selectedSub && subs.find(s => s.id === selectedSub)?.avg_progress! < 40 && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                  <AlertTriangle className="text-amber-600 w-5 h-5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <strong>Warning:</strong> This subcontractor is currently underperforming. Consider awarding to a high performer instead.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Number of Houses</label>
                  <input 
                    type="number" 
                    min="1"
                    value={awardCount}
                    onChange={(e) => setAwardCount(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Start Date</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => setIsAwardModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAward}
                    disabled={awardLoading}
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {awardLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Award'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any, label: string, value: number | string, color: string }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}
