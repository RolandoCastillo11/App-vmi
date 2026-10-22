import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Navigation, MapPin, BrainCircuit, Timer, Package, CheckCircle2, RefreshCw, ChevronRight, ArrowDownToLine, ListOrdered } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// Helper to center map
function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
}

export default function RouteScreen() {
  const [shops, setShops] = useState<Location[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'map' | 'loading'>('map');

  // Distribution Center (Center of Mexico City for demo)
  const distCenter: Location = {
    id: 'dc',
    name: 'Centro de Distribución VMI',
    lat: 19.4326,
    lng: -99.1332,
    address: 'Zócalo, CDMX'
  };

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    setLoading(true);
    const mockShops: Location[] = [
      { id: 'shp-1', name: 'Abarrotes Lupita', lat: 19.4194, lng: -99.1456, address: 'Roma Norte' },
      { id: 'shp-2', name: 'Miscelánea El Güero', lat: 19.4284, lng: -99.1676, address: 'Juárez' },
      { id: 'shp-3', name: 'Tiendita La Esperanza', lat: 19.4454, lng: -99.1234, address: 'Morelos' },
      { id: 'shp-4', name: 'Mini Super Express', lat: 19.4000, lng: -99.1300, address: 'Doctores' }
    ];

    let shopData: Location[] = [];
    try {
      const snapshot = await getDocs(collection(db, 'shops'));
      shopData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Location));
      
      if (shopData.length === 0) {
        // Seed initial shops
        for (const s of mockShops) {
          const { id, ...dataToSave } = s;
          const docRef = await addDoc(collection(db, 'shops'), dataToSave);
          shopData.push({ id: docRef.id, ...dataToSave });
        }
      }
    } catch (error) {
      console.warn("Could not load Firestore shops, using default locations:", error);
      shopData = mockShops;
    } finally {
      setShops(shopData);
      setLoading(false);
      handleOptimizeRoute(shopData);
    }
  };

  const handleOptimizeRoute = async (targetShops: Location[]) => {
    setOptimizing(true);
    try {
      const response = await fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: distCenter, destinations: targetShops })
      });
      const data = await response.json();
      if (data.route) {
        setOptimizedRoute(data.route);
      }
    } catch (error) {
      console.error("Error optimizing route:", error);
    }
    setOptimizing(false);
  };

  const currentStop = optimizedRoute[currentStopIndex] || distCenter;
  const nextStop = optimizedRoute[currentStopIndex + 1];

  const polylinePositions = optimizedRoute.map(loc => [loc.lat, loc.lng] as [number, number]);

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans pb-24">
      {/* Tab Switcher */}
      <div className="flex bg-surface-card border-b border-border-subtle p-1 m-4 rounded-2xl soft-shadow z-30 relative shrink-0">
        <button 
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'map' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted'}`}
        >
          <Navigation size={16} /> Navegación
        </button>
        <button 
          onClick={() => setActiveTab('loading')}
          className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${activeTab === 'loading' ? 'bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow' : 'text-text-muted'}`}
        >
          <Package size={16} /> Carga LIFO
        </button>
      </div>

      {activeTab === 'map' ? (
        <div className="flex-1 relative flex flex-col overflow-hidden">
          {/* Map Header */}
          <header className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none">
            <div className="flex justify-between items-start">
              <div className="bg-surface-card/90 backdrop-blur-md px-4 py-2 rounded-full border border-border-subtle soft-shadow flex items-center gap-2 pointer-events-auto">
                <Navigation className="text-[var(--color-role-primary)] w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-main">Hoy: {optimizing ? 'Optimizando...' : `${optimizedRoute.length} paradas`}</span>
              </div>
              <button 
                onClick={() => loadShops()}
                className="p-3 bg-surface-card/90 backdrop-blur-md rounded-full border border-border-subtle soft-shadow pointer-events-auto text-[var(--color-role-primary)]"
              >
                <RefreshCw className={`w-5 h-5 ${optimizing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </header>

          {/* Main Map */}
          <div className="flex-1 relative">
            <MapContainer 
              center={[distCenter.lat, distCenter.lng]} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <Marker position={[distCenter.lat, distCenter.lng]}>
                 <Popup>{distCenter.name}</Popup>
              </Marker>
              {shops.map(shop => (
                <Marker key={shop.id} position={[shop.lat, shop.lng]}>
                  <Popup>
                    <div className="p-1">
                      <h4 className="font-bold text-xs">{shop.name}</h4>
                      <p className="text-[10px] text-text-muted">{shop.address}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}
              {optimizedRoute.length > 0 && (
                <Polyline positions={polylinePositions} color="var(--color-role-primary)" weight={4} opacity={0.8} />
              )}
              <ChangeView center={[currentStop.lat, currentStop.lng]} zoom={14} />
            </MapContainer>

            {/* Floating Route Info Overlay */}
            <div className="absolute top-20 left-4 right-4 z-10">
              <AnimatePresence mode='wait'>
                <motion.div 
                  key={currentStopIndex}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-surface-card text-text-main p-4 rounded-2xl soft-shadow border border-border-subtle flex items-center justify-between shadow-2xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-role-primary)] text-[var(--color-text-light)] flex items-center justify-center font-bold shadow-lg">
                      {currentStopIndex + 1}
                    </div>
                    <div>
                      <p className="text-[9px] uppercase font-bold tracking-widest leading-none mb-1 text-text-muted">Próxima Parada</p>
                      <h3 className="text-sm font-bold truncate max-w-[150px]">{currentStop.name}</h3>
                    </div>
                  </div>
                  <button 
                    onClick={() => setCurrentStopIndex(prev => Math.min(prev + 1, optimizedRoute.length - 1))}
                    className="bg-[var(--color-role-primary)] text-[var(--color-text-light)] px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                  >
                    Completar <CheckCircle2 className="w-4 h-4" />
                  </button>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Route Summary */}
          <div className="bg-surface-card rounded-t-[2.5rem] border-t border-border-subtle p-6 z-20 shadow-2xl overflow-y-auto max-h-[40vh] no-scrollbar">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-text-main leading-tight">Optimización de Ruta</h2>
                <p className="text-text-muted text-xs mt-0.5">Calculada por Motor VMI Logística</p>
              </div>
              <div className="bg-bg-main text-[var(--color-role-primary)] px-3 py-1.5 rounded-lg border border-border-subtle flex items-center gap-2">
                <BrainCircuit size={16} />
                <span className="text-[10px] font-bold uppercase">Optimizado</span>
              </div>
            </div>

            <div className="space-y-4">
              {optimizedRoute.map((stop, index) => (
                <div key={stop.id} className="relative flex items-start gap-4">
                  {index < optimizedRoute.length - 1 && (
                    <div className="absolute left-[7px] top-[18px] bottom-[-24px] w-[2px] bg-border-subtle" />
                  )}
                  <div className={`w-4 h-4 rounded-full mt-1.5 z-10 flex items-center justify-center border-2 ${index <= currentStopIndex ? 'bg-[var(--color-role-primary)] border-[var(--color-role-primary)]' : 'bg-surface-card border-border-subtle'}`}>
                    {index < currentStopIndex && <CheckCircle2 className="w-3 h-3 text-[var(--color-text-light)]" />}
                  </div>
                  <div className={`flex-1 p-3 rounded-xl border transition-all ${index === currentStopIndex ? 'bg-bg-main/80 border-[var(--color-role-primary)]' : 'bg-bg-main/30 border-border-subtle opacity-60'}`}>
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-text-main">{index === 0 && stop.id === 'dc' ? 'Inicio' : stop.name}</h4>
                      <span className="text-[9px] font-mono text-text-muted">Paso {index + 1}</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-1">{stop.address}</p>
                    {index === currentStopIndex && (
                       <div className="flex items-center gap-3 mt-3 text-[var(--color-role-primary)]">
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase">
                            <Timer size={12} /> 12 min
                          </div>
                          <div className="flex items-center gap-1 text-[9px] font-bold uppercase">
                            <Package size={12} /> 8 cajas
                          </div>
                       </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* LIFO LOADING MANIFEST */
        <main className="flex-1 px-4 py-2 space-y-6 overflow-y-auto no-scrollbar">
          <div className="bg-[var(--color-role-primary)] rounded-[2rem] p-6 text-[var(--color-text-light)] shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full translate-x-10 -translate-y-10"></div>
            <div className="relative z-10">
              <h2 className="text-xl font-bold mb-1">Acomodo del Camión</h2>
              <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">Logística LIFO Automatizada</p>
              <div className="mt-6 flex items-center gap-4 bg-white/10 p-4 rounded-2xl backdrop-blur-sm border border-white/10">
                <ArrowDownToLine className="w-8 h-8 shrink-0" />
                <p className="text-xs leading-relaxed">
                  Carga primero los productos del **final de la ruta** (al fondo). Los del primer cliente quedan en la puerta.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2 px-2">
              <ListOrdered className="w-4 h-4" /> Secuencia de Carga
            </h3>
            
            <div className="space-y-3">
              {[...optimizedRoute].reverse().map((stop, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={stop.id} 
                  className={`relative bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow overflow-hidden ${index === 0 ? 'border-l-4 border-l-amber-500' : index === optimizedRoute.length - 1 ? 'border-l-4 border-l-blue-500' : ''}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-bg-main flex items-center justify-center font-bold text-text-main border border-border-subtle text-xs">
                        {optimizedRoute.length - index}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-text-main">{stop.name}</h4>
                        <span className="text-[9px] font-bold text-text-muted uppercase">{index === 0 ? 'Al Fondo (Cargar Primero)' : index === optimizedRoute.length - 1 ? 'En la Puerta (Cargar al Final)' : 'Carga Intermedia'}</span>
                      </div>
                    </div>
                    <div className="bg-bg-main px-2 py-1 rounded text-[9px] font-mono font-bold text-text-muted border border-border-subtle">
                      PARADA {optimizedRoute.length - index}
                    </div>
                  </div>
                  
                  <div className="bg-bg-main/50 rounded-xl p-3 border border-dashed border-border-subtle">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-text-muted mb-2 uppercase tracking-tight">
                      <Package size={14} className="text-[var(--color-role-primary)]" /> Detalle de Pedido
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-[10px] text-text-main flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        12x Refresco 2L
                      </div>
                      <div className="text-[10px] text-text-main flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        8x Botellón Agua
                      </div>
                      <div className="text-[10px] text-text-main flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        4x Jugos 1L
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
