import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  ClipboardList, Plus, Loader2, Home, 
  Users, Calendar, AlertCircle, Cloud, Camera, Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';

interface House {
  id: number;
  house_number: string;
  subcontractor_name: string;
  progress_percentage: number;
  status: string;
}

export default function PICDashboard() {
  const { token, logout, user } = useAuth();
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedHouse, setSelectedHouse] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    task_description: '',
    manpower: 1,
    issues: '',
    weather: 'Sunny',
    progress_added: 5,
    photo_url: ''
  });

  const fetchData = async () => {
    try {
      const res = await fetch('/api/houses', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHouses(data);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHouse) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ ...formData, house_id: selectedHouse })
      });
      if (res.ok) {
        setIsLogModalOpen(false);
        setFormData({
          task_description: '',
          manpower: 1,
          issues: '',
          weather: 'Sunny',
          progress_added: 5,
          photo_url: ''
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 pb-24 md:pb-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Engineer Log</h1>
          <p className="text-slate-500">Welcome back, {user?.name}</p>
        </div>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-red-600 transition-colors">Logout</button>
      </div>

      <div className="bg-emerald-600 p-6 rounded-2xl text-white shadow-lg shadow-emerald-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Daily Site Entry</h2>
            <p className="text-emerald-100 text-sm">Update progress for today's tasks</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Active Houses</h3>
        {houses.filter(h => h.status !== 'Finished').map((house) => (
          <motion.div 
            key={house.id}
            layoutId={`house-${house.id}`}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900">{house.house_number}</h4>
                <p className="text-xs text-slate-500">{house.subcontractor_name}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-slate-400 mb-1">Current Progress</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${house.progress_percentage}%` }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700">{house.progress_percentage}%</span>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedHouse(house.id); setIsLogModalOpen(true); }}
                className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Log Entry Modal */}
      <AnimatePresence>
        {isLogModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Daily Site Log</h3>
                <button onClick={() => setIsLogModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Manpower</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="number" 
                        required
                        value={formData.manpower}
                        onChange={e => setFormData({...formData, manpower: parseInt(e.target.value)})}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Weather</label>
                    <div className="relative">
                      <Cloud className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <select 
                        value={formData.weather}
                        onChange={e => setFormData({...formData, weather: e.target.value})}
                        className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
                      >
                        <option>Sunny</option>
                        <option>Rainy</option>
                        <option>Cloudy</option>
                        <option>Stormy</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Task Performed</label>
                  <textarea 
                    required
                    placeholder="Describe work done today..."
                    value={formData.task_description}
                    onChange={e => setFormData({...formData, task_description: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Progress Added (%)</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={formData.progress_added}
                    onChange={e => setFormData({...formData, progress_added: parseInt(e.target.value)})}
                    className="w-full accent-emerald-600 h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-400">0%</span>
                    <span className="text-sm font-bold text-emerald-600">{formData.progress_added}%</span>
                    <span className="text-xs text-slate-400">100%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Issues Encountered (Optional)</label>
                  <div className="relative">
                    <AlertCircle className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                    <textarea 
                      placeholder="Any delays or problems?"
                      value={formData.issues}
                      onChange={e => setFormData({...formData, issues: e.target.value})}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 h-20 resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Photo
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="flex-[2] py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-5 h-5" /> Submit Log</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex justify-around items-center md:hidden z-40">
        <button className="flex flex-col items-center gap-1 text-emerald-600">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Home</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <ClipboardList className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Logs</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-slate-400">
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-bold uppercase">Schedule</span>
        </button>
      </div>
    </div>
  );
}
