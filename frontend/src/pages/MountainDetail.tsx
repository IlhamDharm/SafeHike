import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Compass,
  CloudSun,
  Wind,
  Droplets,
  ShieldAlert,
  Sparkles,
  Navigation,
  Footprints,
  Clock,
  TrendingUp,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Info,
  BarChart3,
  Map,
  Mountain,
  Phone,
  CalendarDays,
  TreePine,
  Flame,
  Tent,
  Users,
  Award,
  Timer,
  Eye,
  Thermometer,
  GaugeCircle,
} from 'lucide-react';

import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import api from '../lib/api';

// Fix Leaflet icon standard URLs
import iconMarker from 'leaflet/dist/images/marker-icon.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const customMountainIcon = L.icon({
  iconUrl: iconMarker,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'info' | 'weather' | 'hiking' | 'stats' | 'map';

interface Trail {
  id: number;
  name: string;
  distance: number;
  estimated_duration: number;
}

interface MountainBase {
  id: number;
  name: string;
  location: string;
  elevation: number;
  difficulty: string;
  latitude: number | null;
  longitude: number | null;
  trails: Trail[];
}

interface WeatherData {
  mountain: string;
  weather: {
    temp: number;
    feels_like: number;
    humidity: number;
    wind_speed: number;
    description: string;
    icon: string;
  };
}

interface MountainInfo {
  mountain_id: number;
  mountain_name: string;
  description: string;
  mountain_type: string;
  volcano_status: string;
  vegetation: string;
  basecamp_name: string;
  basecamp_elevation_m: number;
  permitted_status: string;
  first_ascent_year: number;
  permit_required: boolean;
  phone_emergency: string;
}

interface MonthlyVisitor {
  month: string;
  visitors: number;
}

interface TrailDist {
  name: string;
  percentage: number;
}

interface MountainStats {
  mountain_id: number;
  mountain_name: string;
  monthly_visitors: MonthlyVisitor[];
  total_yearly_visitors: number;
  summit_success_rate: number;
  average_trip_duration_days: number;
  trail_distribution: TrailDist[];
  hiker_experience_distribution: { Pemula: number; Menengah: number; Expert: number };
}

// ─── Difficulty badge color ───────────────────────────────────────────────────

function difficultyColor(difficulty: string) {
  switch (difficulty?.toLowerCase()) {
    case 'mudah': return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20';
    case 'menengah': return 'text-amber-300 bg-amber-500/10 border-amber-500/20';
    case 'sulit':
    case 'ekstrem': return 'text-red-300 bg-red-500/10 border-red-500/20';
    default: return 'text-blue-300 bg-blue-500/10 border-blue-500/20';
  }
}

// ─── Weather safety advice ────────────────────────────────────────────────────

function getWeatherAdvice(weather: WeatherData['weather']) {
  const tips: { icon: React.ReactNode; text: string; color: string }[] = [];
  if (weather.wind_speed > 10) tips.push({ icon: <Wind className="h-4 w-4" />, text: 'Angin kencang — waspadai jalur terbuka dan area puncak', color: 'text-amber-400' });
  if (weather.humidity > 80) tips.push({ icon: <Droplets className="h-4 w-4" />, text: 'Kelembapan tinggi — kemungkinan kabut dan jalur licin', color: 'text-sky-400' });
  if (weather.temp < 10) tips.push({ icon: <Thermometer className="h-4 w-4" />, text: 'Suhu sangat dingin — wajib membawa jaket tebal & sleeping bag', color: 'text-blue-400' });
  if (weather.temp >= 10 && weather.temp <= 18) tips.push({ icon: <Thermometer className="h-4 w-4" />, text: 'Suhu sejuk ideal — nyaman untuk pendakian', color: 'text-emerald-400' });
  if (weather.description.includes('rain') || weather.description.includes('hujan')) {
    tips.push({ icon: <AlertTriangle className="h-4 w-4" />, text: 'Cuaca hujan — pertimbangkan menunda pendakian', color: 'text-red-400' });
  }
  if (tips.length === 0) tips.push({ icon: <CheckCircle2 className="h-4 w-4" />, text: 'Kondisi cuaca baik untuk pendakian hari ini', color: 'text-emerald-400' });
  return tips;
}

// ─── Mountain image seed map ──────────────────────────────────────────────────
// Tiap gunung mendapat nomor Picsum Photo berdasarkan nama,
// sehingga gambarnya konsisten (landscape alam yang indah), selalu tersedia.
const MOUNTAIN_PICSUM_SEEDS: Record<string, number> = {
  'prau':       15,   // alpine meadow
  'rinjani':    29,   // volcanic lake
  'semeru':     36,   // high volcano
  'merapi':     45,   // active volcano
  'merbabu':    52,   // highland grass
  'bromo':      67,   // volcanic sea of sand
  'papandayan': 83,   // fumaroles
  'sindoro':    91,   // twin volcano
  'sumbing':    102,  // highland
  'lawu':       117,  // forest
  'arjuno':     128,  // east java peak
  'welirang':   134,  // fumaroles
  'gede':       146,  // west java
  'pangrango':  152,  // forest
  'ciremai':    163,  // west java high
  'slamet':     171,  // central java
  'ijen':       184,  // crater lake blue fire
  'batur':      195,  // bali caldera
  'agung':      207,  // sacred bali
  'kerinci':    218,  // sumatra
  'leuser':     223,  // sumatra rainforest
};

function getMountainImageUrl(mountainName: string, mountainId: number): string {
  const nameLower = mountainName.toLowerCase();
  for (const [key, seed] of Object.entries(MOUNTAIN_PICSUM_SEEDS)) {
    if (nameLower.includes(key)) {
      return `https://picsum.photos/seed/${seed}/1600/600`;
    }
  }
  // Fallback: seed by mountain ID — always a different but consistent beautiful landscape
  return `https://picsum.photos/seed/${mountainId + 300}/1600/600`;
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function MountainDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabId>('info');
  const [imageError, setImageError] = useState(false);

  // Core data
  const [mountain, setMountain] = useState<MountainBase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab-specific data (lazy loaded)
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherFetched, setWeatherFetched] = useState(false);

  const [info, setInfo] = useState<MountainInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoFetched, setInfoFetched] = useState(false);

  const [stats, setStats] = useState<MountainStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsFetched, setStatsFetched] = useState(false);

  // AI Trip Planner state
  const [selectedTrail, setSelectedTrail] = useState('');
  const [experience, setExperience] = useState<'Pemula' | 'Menengah' | 'Hafal Jalur'>('Pemula');
  const [durationDays, setDurationDays] = useState(2);
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // ── Initial load: core mountain data ─────────────────────────────────────
  useEffect(() => {
    async function fetchMountain() {
      setLoading(true);
      setError(null);
      setImageError(false); // reset image error on mountain change
      try {
        const res = await api.get(`/mountains/${id}`);
        setMountain(res.data);
        if (res.data.trails?.length > 0) setSelectedTrail(res.data.trails[0].name);
      } catch (err) {
        console.error(err);
        setError('Gagal memuat informasi gunung. Pastikan koneksi server aktif.');
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchMountain();
  }, [id]);

  // ── Lazy fetch per tab ────────────────────────────────────────────────────
  const fetchInfo = useCallback(async () => {
    if (infoFetched || !id) return;
    setInfoLoading(true);
    try {
      const res = await api.get(`/mountains/${id}/info`);
      setInfo(res.data);
    } catch (e) { console.warn('Info data unavailable', e); }
    finally { setInfoLoading(false); setInfoFetched(true); }
  }, [id, infoFetched]);

  const fetchWeather = useCallback(async () => {
    if (weatherFetched || !id) return;
    setWeatherLoading(true);
    try {
      const res = await api.get(`/weather/${id}`);
      setWeather(res.data);
    } catch (e) { console.warn('Weather data unavailable', e); }
    finally { setWeatherLoading(false); setWeatherFetched(true); }
  }, [id, weatherFetched]);

  const fetchStats = useCallback(async () => {
    if (statsFetched || !id) return;
    setStatsLoading(true);
    try {
      const res = await api.get(`/mountains/${id}/stats`);
      setStats(res.data);
    } catch (e) { console.warn('Stats data unavailable', e); }
    finally { setStatsLoading(false); setStatsFetched(true); }
  }, [id, statsFetched]);

  useEffect(() => {
    if (activeTab === 'info') fetchInfo();
    if (activeTab === 'weather') fetchWeather();
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, fetchInfo, fetchWeather, fetchStats]);

  const handleGenerateAiPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mountain) return;
    setGeneratingAi(true);
    try {
      const res = await api.post('/trip-planner/recommendations', {
        mountain_name: mountain.name,
        trail_name: selectedTrail || (mountain.trails[0]?.name ?? 'Jalur Utama'),
        user_experience: experience,
        duration_days: durationDays,
      });
      setAiPlan(res.data);
    } catch {
      alert('Gagal merancang rencana dengan AI. Coba beberapa saat lagi.');
    } finally {
      setGeneratingAi(false);
    }
  };

  // ── Loading / Error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400 mb-4" />
        <p className="text-slate-400 font-medium">Memuat detail gunung…</p>
      </div>
    );
  }

  if (error || !mountain) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Gunung Tidak Ditemukan</h2>
        <p className="text-slate-400 max-w-md mb-6">{error || 'Data gunung yang Anda cari tidak tersedia.'}</p>
        <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 font-semibold text-white transition-all">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  const lat = mountain.latitude ?? -7.5;
  const lng = mountain.longitude ?? 110.5;

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'info',    label: 'Info Umum',       icon: <Info className="h-4 w-4" /> },
    { id: 'weather', label: 'Prakiraan Cuaca', icon: <CloudSun className="h-4 w-4" /> },
    { id: 'hiking',  label: 'Pendakian',       icon: <Footprints className="h-4 w-4" /> },
    { id: 'stats',   label: 'Statistik',       icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'map',     label: 'Peta',            icon: <Map className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors bg-slate-800/60 hover:bg-slate-700 px-4 py-2 rounded-xl text-sm font-semibold border border-slate-700/50"
          >
            <ArrowLeft className="h-4 w-4" /> Beranda
          </button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3.5 w-3.5" /> Jalur Terverifikasi
          </span>
        </div>
      </header>

      {/* ── Hero Banner with Mountain Image ── */}
      <div className="relative border-b border-slate-800/60 overflow-hidden" style={{ minHeight: '340px' }}>
        {/* Background Image */}
        {!imageError ? (
          <img
            src={getMountainImageUrl(mountain.name, mountain.id)}
            alt={mountain.name}
            onError={() => setImageError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ filter: 'brightness(0.35)' }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-violet-950/30 to-slate-950" />
        )}

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/40" />

        {/* Decorative glow orbs */}
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-emerald-600/10 rounded-full blur-2xl pointer-events-none" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 uppercase tracking-wider backdrop-blur-sm">
            <Compass className="h-3.5 w-3.5" /> Eksplorasi Gunung Indonesia
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="space-y-3">
              <h1 className="text-5xl sm:text-6xl font-black text-white tracking-tight leading-none drop-shadow-2xl">
                {mountain.name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-200">
                <div className="flex items-center gap-1.5 bg-slate-900/50 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-700/50">
                  <MapPin className="h-4 w-4 text-emerald-400" />
                  <span>{mountain.location}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-900/50 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-700/50">
                  <TrendingUp className="h-4 w-4 text-violet-400" />
                  <span className="font-bold text-white">{mountain.elevation.toLocaleString()} mdpl</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 backdrop-blur-sm ${difficultyColor(mountain.difficulty)}`}>
                  <ShieldAlert className="h-3.5 w-3.5" /> {mountain.difficulty}
                </span>
              </div>
            </div>

            {/* Quick stats bar */}
            <div className="flex items-center gap-4 sm:gap-6 text-sm bg-slate-900/60 backdrop-blur-md px-5 py-4 rounded-2xl border border-slate-700/50">
              <div className="text-center">
                <div className="text-2xl font-black text-white">{mountain.trails.length}</div>
                <div className="text-xs text-slate-400">Jalur</div>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div className="text-center">
                <div className="text-2xl font-black text-white">{mountain.elevation.toLocaleString()}</div>
                <div className="text-xs text-slate-400">mdpl</div>
              </div>
              <div className="w-px h-10 bg-slate-700" />
              <div className="text-center">
                <div className="text-2xl font-black text-white capitalize">{mountain.difficulty}</div>
                <div className="text-xs text-slate-400">Tingkat</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="sticky top-[57px] z-40 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-all relative flex-shrink-0
                  ${activeTab === tab.id
                    ? 'text-violet-300 bg-violet-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">

        {/* ════════ TAB: INFO UMUM ════════ */}
        {activeTab === 'info' && (
          <div className="space-y-6 animate-fade-in">
            {infoLoading ? (
              <TabLoader text="Memuat informasi umum…" />
            ) : info ? (
              <>
                {/* Description card */}
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3">
                  <div className="flex items-center gap-2 text-violet-300 font-bold">
                    <Mountain className="h-5 w-5" />
                    <h2 className="text-lg">Tentang {mountain.name}</h2>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-sm">{info.description}</p>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoCard icon={<Flame className="h-5 w-5 text-orange-400" />} label="Tipe Gunung" value={info.mountain_type} accent="orange" />
                  <InfoCard icon={<GaugeCircle className="h-5 w-5 text-red-400" />} label="Status Vulkanik" value={info.volcano_status} accent="red" />
                  <InfoCard icon={<TreePine className="h-5 w-5 text-emerald-400" />} label="Vegetasi" value={info.vegetation} accent="emerald" />
                  <InfoCard icon={<Tent className="h-5 w-5 text-amber-400" />} label="Basecamp Utama" value={`${info.basecamp_name} (${info.basecamp_elevation_m} m)`} accent="amber" />
                  <InfoCard icon={<Eye className="h-5 w-5 text-sky-400" />} label="Status Izin Masuk" value={info.permitted_status} accent="sky" />
                  <InfoCard icon={<CalendarDays className="h-5 w-5 text-violet-400" />} label="Pendakian Pertama" value={`Tahun ${info.first_ascent_year}`} accent="violet" />
                </div>

                {/* Emergency & permit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-red-500/5 border border-red-500/20 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-xl">
                      <Phone className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-0.5">Kontak Darurat SAR</div>
                      <div className="text-lg font-bold text-red-300 font-mono">{info.phone_emergency}</div>
                    </div>
                  </div>
                  <div className={`p-5 rounded-2xl border flex items-center gap-4 ${info.permit_required ? 'bg-amber-500/5 border-amber-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                    <div className={`p-3 rounded-xl ${info.permit_required ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                      <CheckCircle2 className={`h-6 w-6 ${info.permit_required ? 'text-amber-400' : 'text-emerald-400'}`} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-medium mb-0.5">Izin Pendakian</div>
                      <div className={`text-base font-bold ${info.permit_required ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {info.permit_required ? 'Wajib Mengurus Izin' : 'Tidak Diperlukan Izin'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="Data informasi umum tidak tersedia." />
            )}
          </div>
        )}

        {/* ════════ TAB: PRAKIRAAN CUACA ════════ */}
        {activeTab === 'weather' && (
          <div className="space-y-6 animate-fade-in">
            {weatherLoading ? (
              <TabLoader text="Memuat data cuaca real-time…" />
            ) : weather?.weather ? (
              <>
                {/* Main weather card */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-sky-900/40 to-slate-900/70 border border-sky-700/30 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-sky-500/10 rounded-xl">
                        <CloudSun className="h-7 w-7 text-sky-300" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white">Cuaca Puncak {mountain.name}</h2>
                        <p className="text-xs text-slate-400">Data real-time · Diperbarui baru saja</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">Live</span>
                  </div>

                  {/* Temp hero */}
                  <div className="flex items-end gap-6">
                    <div>
                      <div className="text-7xl font-black text-white leading-none">{Math.round(weather.weather.temp)}°</div>
                      <div className="text-slate-400 text-sm mt-1 capitalize">{weather.weather.description}</div>
                      <div className="text-slate-500 text-xs">Terasa seperti {Math.round(weather.weather.feels_like)}°C</div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
                    <WeatherStat icon={<Wind className="h-5 w-5 text-teal-400" />} label="Kec. Angin" value={`${weather.weather.wind_speed} m/s`} />
                    <WeatherStat icon={<Droplets className="h-5 w-5 text-blue-400" />} label="Kelembapan" value={`${weather.weather.humidity}%`} />
                    <WeatherStat icon={<Thermometer className="h-5 w-5 text-orange-400" />} label="Terasa" value={`${Math.round(weather.weather.feels_like)}°C`} />
                  </div>
                </div>

                {/* Safety advice */}
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
                  <div className="flex items-center gap-2 font-bold text-white">
                    <ShieldAlert className="h-5 w-5 text-amber-400" />
                    <h3>Saran Keselamatan Berdasarkan Cuaca</h3>
                  </div>
                  <ul className="space-y-3">
                    {getWeatherAdvice(weather.weather).map((tip, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className={`mt-0.5 shrink-0 ${tip.color}`}>{tip.icon}</span>
                        <span className="text-slate-300">{tip.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Wind compass card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
                    <div className="text-xs text-slate-400 font-medium">Indeks UV (Estimasi)</div>
                    <div className="text-3xl font-black text-amber-300">{weather.weather.humidity > 70 ? 'Rendah' : 'Sedang'}</div>
                    <div className="text-xs text-slate-500">Berdasarkan kelembapan udara</div>
                  </div>
                  <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
                    <div className="text-xs text-slate-400 font-medium">Kondisi Pendakian</div>
                    <div className={`text-3xl font-black ${weather.weather.wind_speed < 8 && weather.weather.humidity < 85 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {weather.weather.wind_speed < 8 && weather.weather.humidity < 85 ? 'Baik' : 'Waspada'}
                    </div>
                    <div className="text-xs text-slate-500">Angin &amp; kelembapan saat ini</div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="Data cuaca tidak tersedia. Koordinat gunung mungkin belum diset." />
            )}
          </div>
        )}

        {/* ════════ TAB: PENDAKIAN ════════ */}
        {activeTab === 'hiking' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 animate-fade-in">
            {/* Trail list — 3 cols */}
            <div className="lg:col-span-3 space-y-5">
              <div className="flex items-center gap-2">
                <Footprints className="h-5 w-5 text-violet-400" />
                <h2 className="text-xl font-bold text-white">Jalur Pendakian Resmi ({mountain.trails.length})</h2>
              </div>

              {mountain.trails.length === 0 ? (
                <EmptyState text="Belum ada data jalur spesifik untuk gunung ini." />
              ) : (
                <div className="space-y-4">
                  {mountain.trails.map((trail, idx) => (
                    <div
                      key={trail.id}
                      className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-violet-500/40 transition-all hover:shadow-lg hover:shadow-violet-500/5 group"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-xs font-black text-violet-300">
                            {idx + 1}
                          </div>
                          <h4 className="font-bold text-white group-hover:text-violet-300 transition-colors">{trail.name}</h4>
                        </div>
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          Aktif
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800/60">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Navigation className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>Jarak: <strong className="text-white">{trail.distance} km</strong></span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                          <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                          <span>Durasi: <strong className="text-white">{trail.estimated_duration} jam</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AI Trip Planner — 2 cols */}
            <div className="lg:col-span-2">
              <div className="p-6 rounded-2xl bg-gradient-to-b from-violet-900/20 to-slate-900/70 border border-violet-500/30 shadow-2xl relative overflow-hidden sticky top-28">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Sparkles className="h-40 w-40 text-violet-300" />
                </div>

                <div className="relative z-10 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
                      <Sparkles className="h-5 w-5 text-violet-300" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">AI Trip Planner</h3>
                      <p className="text-xs text-slate-400">Rencana otomatis berbasis AI</p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerateAiPlan} className="space-y-4 pt-1">
                    {mountain.trails.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pilih Jalur</label>
                        <select
                          value={selectedTrail}
                          onChange={(e) => setSelectedTrail(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                        >
                          {mountain.trails.map((t) => (
                            <option key={t.id} value={t.name}>{t.name} ({t.distance} km)</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Pengalaman Pendaki</label>
                      <select
                        value={experience}
                        onChange={(e) => setExperience(e.target.value as any)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                      >
                        <option value="Pemula">Pemula (Butuh Panduan Ekstra)</option>
                        <option value="Menengah">Menengah (Cukup Berpengalaman)</option>
                        <option value="Hafal Jalur">Expert / Hafal Jalur</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Durasi Pendakian (Hari)</label>
                      <input
                        type="number" min="1" max="7"
                        value={durationDays}
                        onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-200 focus:outline-none focus:border-violet-500 transition-colors"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={generatingAi}
                      className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 font-bold text-sm text-white shadow-lg shadow-violet-600/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-60"
                    >
                      {generatingAi ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Merancang Rencana…</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Buat Rencana AI</>
                      )}
                    </button>
                  </form>

                  {aiPlan && (
                    <div className="mt-2 p-4 rounded-xl bg-slate-950/80 border border-violet-500/30 text-xs space-y-3">
                      <div className="font-bold text-sm text-violet-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Hasil Rencana AI
                      </div>
                      <div className="text-slate-300 leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto pr-1">
                        {aiPlan.recommendations || aiPlan.recommendation || JSON.stringify(aiPlan, null, 2)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB: STATISTIK ════════ */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-fade-in">
            {statsLoading ? (
              <TabLoader text="Memuat data statistik…" />
            ) : stats ? (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatSummaryCard
                    icon={<Users className="h-6 w-6 text-violet-400" />}
                    label="Total Pengunjung / Tahun"
                    value={stats.total_yearly_visitors.toLocaleString()}
                    sub="pendaki terdaftar"
                    accent="violet"
                  />
                  <StatSummaryCard
                    icon={<Award className="h-6 w-6 text-emerald-400" />}
                    label="Summit Success Rate"
                    value={`${stats.summit_success_rate}%`}
                    sub="berhasil mencapai puncak"
                    accent="emerald"
                  />
                  <StatSummaryCard
                    icon={<Timer className="h-6 w-6 text-amber-400" />}
                    label="Rata-rata Durasi Trip"
                    value={`${stats.average_trip_duration_days} hari`}
                    sub="waktu pendakian rata-rata"
                    accent="amber"
                  />
                </div>

                {/* Monthly visitors bar chart */}
                <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-violet-400" />
                    <h3 className="font-bold text-white">Grafik Pengunjung per Bulan</h3>
                  </div>
                  <MonthlyBarChart data={stats.monthly_visitors} />
                </div>

                {/* Trail distribution */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Footprints className="h-5 w-5 text-violet-400" /> Distribusi per Jalur
                    </h3>
                    <div className="space-y-3">
                      {stats.trail_distribution.map((t, i) => (
                        <div key={i} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-medium text-slate-300">
                            <span>{t.name}</span>
                            <span className="text-violet-300">{t.percentage}%</span>
                          </div>
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-700"
                              style={{ width: `${t.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
                    <h3 className="font-bold text-white flex items-center gap-2">
                      <Users className="h-5 w-5 text-violet-400" /> Distribusi Pengalaman Pendaki
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(stats.hiker_experience_distribution).map(([label, pct], i) => {
                        const colors = ['from-emerald-500 to-teal-500', 'from-amber-500 to-orange-500', 'from-violet-500 to-indigo-500'];
                        const textColors = ['text-emerald-300', 'text-amber-300', 'text-violet-300'];
                        return (
                          <div key={label} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-medium text-slate-300">
                              <span>{label}</span>
                              <span className={textColors[i]}>{pct}%</span>
                            </div>
                            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full bg-gradient-to-r ${colors[i]} rounded-full transition-all duration-700`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text="Data statistik tidak tersedia." />
            )}
          </div>
        )}

        {/* ════════ TAB: PETA ════════ */}
        {activeTab === 'map' && (
          <div className="space-y-5 animate-fade-in">
            <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="h-5 w-5 text-emerald-400" />
                  <h2 className="font-bold text-lg text-white">Peta Topografi &amp; Koordinat GPS</h2>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                  {lat.toFixed(4)}°, {lng.toFixed(4)}°
                </span>
              </div>

              <div className="h-[500px] w-full relative z-10">
                <MapContainer
                  center={[lat, lng]}
                  zoom={12}
                  scrollWheelZoom={true}
                  className="h-full w-full"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[lat, lng]} icon={customMountainIcon}>
                    <Popup>
                      <div className="text-slate-900 p-1">
                        <div className="font-bold text-sm">{mountain.name}</div>
                        <div className="text-xs text-slate-600">{mountain.elevation.toLocaleString()} mdpl</div>
                        <div className="text-xs text-slate-500">{mountain.location}</div>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[lat, lng]}
                    radius={5000}
                    pathOptions={{ color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.08 }}
                  />
                </MapContainer>
              </div>

              <div className="p-4 bg-slate-900/90 text-xs text-slate-400 flex items-center gap-2 border-t border-slate-800">
                <Info className="h-4 w-4 text-violet-400 shrink-0" />
                <span>Gunakan scroll untuk zoom. Lingkaran ungu menunjukkan area sekitar puncak dalam radius 5 km.</span>
              </div>
            </div>

            {/* Coordinate info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 text-sm space-y-1">
                <div className="text-xs text-slate-400 font-medium">Lintang (Latitude)</div>
                <div className="font-mono text-white font-bold text-base">{lat.toFixed(6)}°</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 text-sm space-y-1">
                <div className="text-xs text-slate-400 font-medium">Bujur (Longitude)</div>
                <div className="font-mono text-white font-bold text-base">{lng.toFixed(6)}°</div>
              </div>
              <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 text-sm space-y-1">
                <div className="text-xs text-slate-400 font-medium">Elevasi Puncak</div>
                <div className="font-mono text-white font-bold text-base">{mountain.elevation.toLocaleString()} mdpl</div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ─── Shared Sub-Components ────────────────────────────────────────────────────

function TabLoader({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-16 text-center text-slate-500 text-sm rounded-2xl bg-slate-900/40 border border-slate-800/60">
      {text}
    </div>
  );
}

function InfoCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  const accentBg: Record<string, string> = {
    orange: 'bg-orange-500/5 border-orange-500/20',
    red: 'bg-red-500/5 border-red-500/20',
    emerald: 'bg-emerald-500/5 border-emerald-500/20',
    amber: 'bg-amber-500/5 border-amber-500/20',
    sky: 'bg-sky-500/5 border-sky-500/20',
    violet: 'bg-violet-500/5 border-violet-500/20',
  };
  return (
    <div className={`p-5 rounded-2xl border flex items-start gap-4 ${accentBg[accent] ?? 'bg-slate-900/70 border-slate-800/80'}`}>
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-400 font-medium mb-1">{label}</div>
        <div className="font-semibold text-white text-sm leading-snug">{value}</div>
      </div>
    </div>
  );
}

function WeatherStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="text-center space-y-1">
      <div className="flex justify-center">{icon}</div>
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-bold text-white">{value}</div>
    </div>
  );
}

function StatSummaryCard({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string; sub: string; accent: string }) {
  const accentBg: Record<string, string> = {
    violet: 'bg-violet-500/5 border-violet-500/20',
    emerald: 'bg-emerald-500/5 border-emerald-500/20',
    amber: 'bg-amber-500/5 border-amber-500/20',
  };
  return (
    <div className={`p-6 rounded-2xl border space-y-3 ${accentBg[accent] ?? 'bg-slate-900/70 border-slate-800/80'}`}>
      <div>{icon}</div>
      <div>
        <div className="text-xs text-slate-400 font-medium">{label}</div>
        <div className="text-3xl font-black text-white mt-1">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{sub}</div>
      </div>
    </div>
  );
}

function MonthlyBarChart({ data }: { data: MonthlyVisitor[] }) {
  const max = Math.max(...data.map((d) => d.visitors), 1);
  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1.5 h-32">
        {data.map((d, i) => {
          const pct = (d.visitors / max) * 100;
          const isHighSeason = ['Jun', 'Jul', 'Agu'].includes(d.month);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700 z-10">
                {d.visitors.toLocaleString()}
              </div>
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${isHighSeason ? 'bg-gradient-to-t from-violet-600 to-indigo-400' : 'bg-gradient-to-t from-slate-700 to-slate-600'} hover:brightness-110`}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-slate-500 font-medium">{d.month}</div>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-r from-violet-600 to-indigo-400" /> Musim Ramai (Jun–Agu)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-sm bg-slate-600" /> Bulan Lainnya</span>
      </div>
    </div>
  );
}
