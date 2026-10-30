import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import {
  Navigation,
  Package,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  ListOrdered,
  Share2,
  ExternalLink,
  PenTool,
  FileText,
  Truck,
  Clock,
  Maximize2,
  Eye,
  MapPinned,
  Radio,
  Wifi,
  WifiOff,
  Wallet,
  Banknote,
  Landmark,
  CreditCard,
  PackageMinus,
  Send,
  Route as RouteIcon,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  getSupabaseShops,
  updateSupabaseOrderStatus,
  updateDriverLiveLocation,
  saveRouteSettlement,
  Order,
  PodData,
} from '../lib/services';
import { isSupabaseConfigured } from '../lib/supabase';
import { cn } from '../lib/utils';
import { traceOptimalStreetRoute, LegMetric } from '../lib/routeGeometry';
import { useOfflineSync, enqueueOfflineDelivery } from '../lib/offlineSync';
import { sendLocalPushNotification } from '../lib/pushNotifications';
import SignaturePadModal from '../components/SignaturePadModal';
import RemisionTicketModal from '../components/RemisionTicketModal';

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  delivered?: boolean;
}

interface RouteStats {
  totalDistanceKm: number;
  traditionalDistanceKm: number;
  estimatedFuelLiters: number;
  traditionalFuelLiters: number;
  fuelSavedLiters: number;
  co2SavedKg: number;
  fuelSavingsPercent: number;
  estimatedDurationMin: number;
  stopsCount: number;
}

// Controlador Anti-Freeze de Leaflet
function MapController({
  route,
  fullStreetCoords,
  currentStop,
  focusMode,
  triggerCenter,
  activeTab,
}: {
  route: Location[];
  fullStreetCoords: [number, number][];
  currentStop: Location;
  focusMode: 'route' | 'stop';
  triggerCenter: number;
  activeTab: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const timer = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {}
    }, 150);
    return () => clearTimeout(timer);
  }, [map, activeTab]);

  useEffect(() => {
    if (!map) return;
    try {
      map.stop();
      if (focusMode === 'route' && (fullStreetCoords.length > 0 || route.length > 0)) {
        const pts =
          fullStreetCoords.length > 1
            ? fullStreetCoords
            : route.map((loc) => [loc.lat, loc.lng] as [number, number]);
        const bounds = L.latLngBounds(pts);
        map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14, animate: false });
      } else if (focusMode === 'stop' && currentStop) {
        map.panTo([currentStop.lat, currentStop.lng], { animate: true, duration: 0.35 });
      }
    } catch (err) {
      console.warn('Aviso controlador de mapa Leaflet:', err);
    }
  }, [map, route, fullStreetCoords, currentStop, focusMode, triggerCenter]);

  return null;
}

const createNumberedIcon = (number: number, isDelivered: boolean, isCurrent: boolean) => {
  const bg = isDelivered ? '#10b981' : isCurrent ? '#ea580c' : '#334155';
  const ring = isCurrent
    ? 'box-shadow: 0 0 0 6px rgba(234, 88, 12, 0.38); transform: scale(1.08);'
    : 'box-shadow: 0 3px 8px rgba(0,0,0,0.28);';

  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `<div style="background-color: ${bg}; width: 30px; height: 30px; border-radius: 9999px; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 800; font-size: 11px; font-family: -apple-system, sans-serif; ${ring} transition: all 0.25s ease;">
      ${isDelivered ? '✓' : number}
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const createCedisIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-cedis',
    html: `<div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); width: 36px; height: 36px; border-radius: 12px; border: 2.5px solid #ea580c; display: flex; align-items: center; justify-content: center; color: #f97316; font-size: 16px; box-shadow: 0 4px 12px rgba(234,88,12,0.35);">
      🏢
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const createLiveTruckIcon = () => {
  return L.divIcon({
    className: 'custom-leaflet-live-truck',
    html: `<div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); width: 36px; height: 36px; border-radius: 9999px; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 16px; box-shadow: 0 0 0 5px rgba(16,185,129,0.32), 0 4px 12px rgba(0,0,0,0.35);">
      🚚
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

export default function RouteScreen() {
  const [shops, setShops] = useState<Location[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<Location[]>([]);
  const [fullStreetCoords, setFullStreetCoords] = useState<[number, number][]>([]);
  const [routeLegs, setRouteLegs] = useState<LegMetric[]>([]);
  const [routeSource, setRouteSource] = useState<'osrm-streets' | 'arterial-corridor'>('osrm-streets');
  const [routeStats, setRouteStats] = useState<RouteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [currentStopIndex, setCurrentStopIndex] = useState(1);
  const [activeTab, setActiveTab] = useState<'map' | 'stops' | 'loading' | 'settlement'>('map');
  const [deliveredStops, setDeliveredStops] = useState<Record<string, boolean>>({});
  const [podRecords, setPodRecords] = useState<Record<string, PodData>>({});

  // GPS en Vivo del Camión #402
  const [isLiveGpsActive, setIsLiveGpsActive] = useState(false);
  const [truckPosition, setTruckPosition] = useState<[number, number]>([22.3385, -97.9042]);
  const [truckSpeedKmh, setTruckSpeedKmh] = useState(0);
  const gpsSimIndexRef = useRef(0);
  const gpsWatchIdRef = useRef<number | null>(null);

  // Offline Sync Hook
  const { isOnline, pendingCount, isSyncing, syncNow } = useOfflineSync();

  // Estado de liquidación enviada
  const [settlementSent, setSettlementSent] = useState(false);
  const [settlementNotes, setSettlementNotes] = useState(
    'Ruta 04 Tampico-Madero liquidada sin contratiempos en caja.'
  );

  // Modos de visualización del mapa
  const [focusMode, setFocusMode] = useState<'route' | 'stop'>('route');
  const [triggerCenter, setTriggerCenter] = useState(0);

  // Modales de POD y Ticket
  const [isPodOpen, setIsPodOpen] = useState(false);
  const [selectedStopForPod, setSelectedStopForPod] = useState<Location | null>(null);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [activeOrderForTicket, setActiveOrderForTicket] = useState<Order | null>(null);

  // Centro de Distribución: CEDIS Altamira - Almacenes Ibarra
  const distCenter: Location = {
    id: 'cedis-altamira',
    name: 'CEDIS Altamira - Almacenes Ibarra',
    lat: 22.3385,
    lng: -97.9042,
    address: 'Carr. Tampico-Mante Km 11, Laguna de la Puerta, Altamira',
  };

  useEffect(() => {
    loadShops();
    return () => {
      if (gpsWatchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(gpsWatchIdRef.current);
      }
    };
  }, []);

  // Simulación + Transmisión GPS en vivo sobre las calles trazadas
  useEffect(() => {
    if (!isLiveGpsActive || fullStreetCoords.length === 0) return;

    // También suscribir GPS real del dispositivo si está disponible
    if ('geolocation' in navigator && gpsWatchIdRef.current === null) {
      try {
        gpsWatchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => {
            // Si el usuario está físicamente en la zona conurbada Tampico-Madero-Altamira, usar su GPS real
            if (Math.abs(pos.coords.latitude - 22.27) < 0.25 && Math.abs(pos.coords.longitude + 97.86) < 0.25) {
              const realCoords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
              setTruckPosition(realCoords);
              const spd = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 34;
              setTruckSpeedKmh(spd);
            }
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000 }
        );
      } catch {}
    }

    const interval = setInterval(() => {
      gpsSimIndexRef.current = (gpsSimIndexRef.current + 1) % fullStreetCoords.length;
      const nextCoord = fullStreetCoords[gpsSimIndexRef.current];
      if (!nextCoord) return;

      const simulatedSpeed = 28 + (gpsSimIndexRef.current % 14);
      setTruckPosition(nextCoord);
      setTruckSpeedKmh(simulatedSpeed);

      const targetStop = optimizedRoute[currentStopIndex] || optimizedRoute[1] || distCenter;
      updateDriverLiveLocation({
        driverId: 'chofer-402',
        driverName: 'Carlos Mendoza (Chofer #402)',
        unitNumber: 'Camión #402 • Ford Cargo',
        lat: nextCoord[0],
        lng: nextCoord[1],
        speedKmh: simulatedSpeed,
        currentStopId: targetStop.id,
        currentStopName: targetStop.name,
        isActive: true,
        updatedAt: new Date().toISOString(),
      });
    }, 1800);

    return () => clearInterval(interval);
  }, [isLiveGpsActive, fullStreetCoords, optimizedRoute, currentStopIndex]);

  const toggleLiveGps = () => {
    const nextState = !isLiveGpsActive;
    setIsLiveGpsActive(nextState);
    if (nextState) {
      const targetStop = optimizedRoute[currentStopIndex] || optimizedRoute[1] || distCenter;
      sendLocalPushNotification({
        title: 'Transmisión GPS en Vivo Activa 🚚',
        body: `Camión #402 transmitiendo ubicación en tiempo real rumbo a ${targetStop.name}.`,
        tag: 'vmi-live-gps',
      });
    } else {
      setTruckSpeedKmh(0);
    }
  };

  const loadShops = async () => {
    setLoading(true);
    const mockShops: Location[] = [
      { id: 'shp-1', name: 'Abarrotes Don Lupe', lat: 22.2155, lng: -97.8578, address: 'Zona Centro, Tampico', phone: '8331002030' },
      { id: 'shp-2', name: 'Miscelánea La Fe', lat: 22.2110, lng: -97.8630, address: 'Col. Cascajal, Tampico', phone: '8331002031' },
      { id: 'shp-3', name: 'Mini Súper Miramar', lat: 22.2745, lng: -97.8105, address: 'Cd. Madero Centro', phone: '8331002032' },
      { id: 'shp-4', name: 'Abarrotes El Profe', lat: 22.2470, lng: -97.8340, address: 'Col. Árbol Grande, Cd. Madero', phone: '8331002033' },
      { id: 'shp-5', name: 'Tienda La Moderna', lat: 22.2590, lng: -97.8680, address: 'Col. Las Américas, Tampico', phone: '8331002034' },
      { id: 'shp-6', name: 'Miscelánea Laguna', lat: 22.3250, lng: -97.8980, address: 'Col. Laguna de la Puerta, Altamira', phone: '8331002035' },
    ];

    let shopData: Location[] = [];
    if (isSupabaseConfigured) {
      try {
        const sbShops = await getSupabaseShops();
        if (sbShops && sbShops.length > 0) {
          shopData = sbShops.map((s) => ({
            ...s,
            phone: s.contact?.match(/\d+/g)?.join('') || '8331002030',
          }));
        }
      } catch (err) {
        console.warn('Could not load Supabase shops, falling back:', err);
      }
    }

    if (shopData.length === 0) {
      try {
        const snapshot = await getDocs(collection(db, 'shops'));
        shopData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Location));
        if (shopData.length === 0 || (shopData[0] && Math.abs(shopData[0].lat - 19.4) < 1)) {
          shopData = mockShops;
        }
      } catch {
        shopData = mockShops;
      }
    }

    setShops(shopData);
    setLoading(false);
    handleOptimizeRoute(shopData);
  };

  const handleOptimizeRoute = async (targetShops: Location[]) => {
    setOptimizing(true);
    try {
      // 1. Obtener secuencia óptima (Nearest Neighbor + 2-Opt) y geometría vial calle por calle (OSRM / Corredor Arterial)
      const traced = await traceOptimalStreetRoute(distCenter, targetShops);
      setOptimizedRoute(traced.orderedStops);
      setFullStreetCoords(traced.fullCoordinates);
      setRouteLegs(traced.legs);
      setRouteSource(traced.source);

      if (traced.orderedStops.length > 1) {
        setCurrentStopIndex(1);
      }
      if (traced.fullCoordinates.length > 0) {
        setTruckPosition(traced.fullCoordinates[0]);
        gpsSimIndexRef.current = 0;
      }

      // Calcular estadísticas logísticas reales sobre el kilometraje vial
      const KM_PER_LITER = 3.8;
      const CO2_KG_PER_LITER = 2.68;
      const totalDistanceKm = traced.totalDistanceKm || 32.4;
      const traditionalDistanceKm = Number((totalDistanceKm * 1.38).toFixed(1));
      const estimatedFuelLiters = Number((totalDistanceKm / KM_PER_LITER).toFixed(1));
      const traditionalFuelLiters = Number((traditionalDistanceKm / KM_PER_LITER).toFixed(1));
      const fuelSavedLiters = Number((traditionalFuelLiters - estimatedFuelLiters).toFixed(1));
      const co2SavedKg = Number((fuelSavedLiters * CO2_KG_PER_LITER).toFixed(1));

      setRouteStats({
        totalDistanceKm,
        traditionalDistanceKm,
        estimatedFuelLiters,
        traditionalFuelLiters,
        fuelSavedLiters,
        co2SavedKg,
        fuelSavingsPercent: Math.round(((traditionalFuelLiters - estimatedFuelLiters) / traditionalFuelLiters) * 100),
        estimatedDurationMin: traced.totalDurationMin || 95,
        stopsCount: targetShops.length,
      });

      // También sincronizar con el endpoint del servidor si está activo
      fetch('/api/optimize-route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: distCenter, destinations: targetShops }),
      }).catch(() => {});
    } catch (error) {
      console.error('Error optimizing street route:', error);
      const fallback = [distCenter, ...targetShops];
      setOptimizedRoute(fallback);
      setFullStreetCoords(fallback.map((p) => [p.lat, p.lng]));
      if (fallback.length > 1) setCurrentStopIndex(1);
    }
    setOptimizing(false);
  };

  // Abrir navegación GPS externa con ruta trazada
  const handleOpenGoogleMaps = (destLat: number, destLng: number) => {
    const originParam = `${truckPosition[0]},${truckPosition[1]}`;
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destLat},${destLng}&travelmode=driving`,
      '_blank'
    );
  };

  // Notificación de llegada por WhatsApp
  const handleSendWhatsAppNotification = (stop: Location) => {
    const rawPhone = stop.phone || '8331002030';
    const message = encodeURIComponent(
      `👋 Estimado cliente de *${stop.name}*:\n\n` +
        `Le informamos que la unidad de reparto *Camión #402* de *Almacenes Ibarra (CEDIS Altamira)* va en camino hacia su tienda.\n\n` +
        `⏱️ *Tiempo estimado de arribo:* 10 - 15 minutos.\n` +
        `📦 Favor de tener disponible el área de descarga y recepción.\n\n` +
        `_Sistema Logístico VMI Preventa Inteligente_`
    );
    window.open(`https://wa.me/52${rawPhone}?text=${message}`, '_blank');
  };

  const handleOpenPod = (stop: Location) => {
    setSelectedStopForPod(stop);
    setIsPodOpen(true);
  };

  // Confirmar entrega con firma digital, cobranza, mermas y soporte Offline-First
  const handleConfirmDelivery = async (
    signatureUrl: string,
    receiverName: string,
    notes: string,
    podDetails?: PodData
  ) => {
    if (!selectedStopForPod) return;
    const stopId = selectedStopForPod.id;
    const finalPod: PodData = podDetails || {
      signatureUrl,
      receiverName,
      deliveryNotes: notes,
      paymentMethod: 'cash',
      amountCollected: 1800,
    };

    setDeliveredStops((prev) => ({ ...prev, [stopId]: true }));
    setPodRecords((prev) => ({ ...prev, [stopId]: finalPod }));

    if (!isOnline) {
      // Guardar en cola Offline-First para auto-sincronizar al recuperar red
      enqueueOfflineDelivery(stopId, selectedStopForPod.name, finalPod);
      sendLocalPushNotification({
        title: 'Entrega Guardada en Modo Offline 📦',
        body: `${selectedStopForPod.name}: Se sincronizará automáticamente con Supabase al recuperar señal.`,
        tag: `pod-offline-${stopId}`,
      });
    } else {
      const ok = await updateSupabaseOrderStatus(stopId, 'delivered', finalPod);
      if (!ok) {
        enqueueOfflineDelivery(stopId, selectedStopForPod.name, finalPod);
      }
      sendLocalPushNotification({
        title: `Entrega Confirmada • ${selectedStopForPod.name} ✅`,
        body: `Recibió: ${receiverName} • Cobrado: $${(finalPod.amountCollected ?? 1800).toFixed(2)} MXN.`,
        tag: `pod-done-${stopId}`,
      });
    }

    // Avanzar automáticamente a la siguiente parada pendiente
    const nextPendingIndex = optimizedRoute.findIndex(
      (loc, idx) => idx > 0 && idx !== currentStopIndex && !deliveredStops[loc.id] && loc.id !== stopId
    );
    if (nextPendingIndex > 0) {
      setCurrentStopIndex(nextPendingIndex);
      setFocusMode('stop');
      setTriggerCenter((prev) => prev + 1);
    }
  };

  // Abrir Ticket / Remisión
  const handleViewRemision = (stop: Location) => {
    setActiveOrderForTicket({
      id: `REM-${stop.id.toUpperCase()}`,
      items: [
        { id: '1', name: 'Coca-Cola 600ml (Caja 24)', quantity: 2, price: 480 },
        { id: '2', name: 'Sabritas Sal 45g (Caja 30)', quantity: 1, price: 360 },
        { id: '3', name: 'Leche Alpura 1L (Caja 12)', quantity: 2, price: 240 },
      ],
      total: 1800,
      status: deliveredStops[stop.id] ? 'delivered' : 'in_transit',
      createdAt: new Date().toISOString(),
    });
    setSelectedStopForPod(stop);
    setIsTicketOpen(true);
  };

  const handleSelectStopFromList = (index: number) => {
    setCurrentStopIndex(index);
    setActiveTab('map');
    setFocusMode('stop');
    setTriggerCenter((prev) => prev + 1);
  };

  const currentStop = optimizedRoute[currentStopIndex] || distCenter;
  const activeLeg: LegMetric | undefined = routeLegs[Math.max(0, currentStopIndex - 1)];
  const totalStopsCount = Math.max(0, optimizedRoute.length - 1);
  const deliveredCount = Object.values(deliveredStops).filter(Boolean).length;
  const progressPercent = totalStopsCount > 0 ? Math.round((deliveredCount / totalStopsCount) * 100) : 0;

  // Cálculos de Caja / Liquidación de Ruta
  const podEntries = Object.entries(podRecords) as [string, PodData][];
  const totalCash = podEntries
    .filter(([, p]) => (p.paymentMethod || 'cash') === 'cash')
    .reduce((acc, [, p]) => acc + (p.amountCollected ?? 1800), 0);
  const totalTransfer = podEntries
    .filter(([, p]) => p.paymentMethod === 'transfer')
    .reduce((acc, [, p]) => acc + (p.amountCollected ?? 1800), 0);
  const totalCredit = podEntries
    .filter(([, p]) => p.paymentMethod === 'credit')
    .reduce((acc, [, p]) => acc + (p.amountCollected ?? 1800), 0);
  const totalReturns = podEntries.reduce((acc, [, p]) => acc + (p.returnAmount || 0), 0);
  const netRouteTotal = totalCash + totalTransfer + totalCredit;

  const handleSaveRouteSettlement = async () => {
    await saveRouteSettlement({
      driverId: 'chofer-402',
      driverName: 'Carlos Mendoza (Chofer #402)',
      routeDate: new Date().toISOString().split('T')[0],
      totalCash,
      totalTransfer,
      totalCredit,
      totalReturns,
      netTotal: netRouteTotal,
      stopsCompleted: deliveredCount,
      notes: settlementNotes,
    });
    setSettlementSent(true);
    sendLocalPushNotification({
      title: 'Corte de Caja Enviado a CEDIS Altamira 💰',
      body: `Liquidación registrada: $${netRouteTotal.toFixed(2)} MXN (${deliveredCount} tiendas entregadas).`,
      tag: 'vmi-route-settlement',
    });
  };

  return (
    <div className="flex flex-col h-full bg-bg-main font-sans overflow-hidden">
      {/* Barra de Estado de Red / Sincronización Offline */}
      {(!isOnline || pendingCount > 0) && (
        <div
          className={cn(
            'mx-3 mt-2 px-3 py-1.5 rounded-xl border text-[10px] font-bold flex items-center justify-between gap-2',
            !isOnline
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-800 dark:text-amber-300'
              : 'bg-blue-500/15 border-blue-500/30 text-blue-800 dark:text-blue-300'
          )}
        >
          <div className="flex items-center gap-1.5">
            {!isOnline ? <WifiOff size={13} /> : <Wifi size={13} />}
            <span>
              {!isOnline
                ? `Modo Offline Activo • ${pendingCount} entrega(s) guardadas en teléfono`
                : `${pendingCount} entrega(s) listas para sincronizar`}
            </span>
          </div>
          {isOnline && pendingCount > 0 && (
            <button
              type="button"
              onClick={syncNow}
              disabled={isSyncing}
              className="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] uppercase tracking-wider cursor-pointer"
            >
              {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      )}

      {/* Selector Superior de 4 Pestañas */}
      <div className="p-3 pb-1 shrink-0">
        <div className="grid grid-cols-4 bg-surface-card border border-border-subtle p-1 rounded-2xl soft-shadow gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'map'
                ? 'bg-[var(--color-role-primary)] text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Navigation size={13} /> Mapa Vial
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('stops')}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'stops'
                ? 'bg-[var(--color-role-primary)] text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <ListOrdered size={13} /> Paradas ({deliveredCount}/{totalStopsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('loading')}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'loading'
                ? 'bg-[var(--color-role-primary)] text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Package size={13} /> Estiba
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settlement')}
            className={`py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'settlement'
                ? 'bg-[var(--color-role-primary)] text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            <Wallet size={13} /> Caja
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: MAPA GPS CON TRAZADO VIAL ÓPTIMO */}
      <div
        className={cn(
          'flex-1 relative flex flex-col mx-3 mb-2 rounded-2xl overflow-hidden border border-border-subtle soft-shadow min-h-[460px] isolate z-0',
          activeTab !== 'map' && 'hidden'
        )}
      >
        {/* Header Flotante: Indicadores de Ruta, GPS en Vivo y Controles */}
        <header className="absolute top-3 left-3 right-3 z-20 pointer-events-none flex justify-between items-center gap-1.5">
          <div className="bg-surface-card/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-border-subtle soft-shadow flex items-center gap-1.5 pointer-events-auto">
            <RouteIcon className="text-[var(--color-role-primary)] w-3.5 h-3.5 shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-main">
              {optimizing
                ? 'Trazando ruta...'
                : `${totalStopsCount} Paradas • ${routeStats?.totalDistanceKm || 32.4} km • Ruta Óptima`}
            </span>
          </div>

          <div className="flex items-center gap-1 pointer-events-auto">
            {/* Botón Transmitir GPS en Vivo */}
            <button
              type="button"
              onClick={toggleLiveGps}
              title="Transmitir GPS en Vivo a Tiendas y CEDIS"
              className={`px-2.5 py-1.5 rounded-full border soft-shadow text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                isLiveGpsActive
                  ? 'bg-emerald-600 text-white border-emerald-500 animate-pulse'
                  : 'bg-surface-card/95 text-text-main border-border-subtle hover:border-emerald-500'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{isLiveGpsActive ? `${truckSpeedKmh} km/h` : 'GPS Vivo'}</span>
            </button>

            {/* Botón Ver Ruta Completa */}
            <button
              type="button"
              onClick={() => {
                setFocusMode('route');
                setTriggerCenter((prev) => prev + 1);
              }}
              title="Ver Recorrido Completo"
              className={`p-2 rounded-full border soft-shadow transition-all cursor-pointer ${
                focusMode === 'route'
                  ? 'bg-[var(--color-role-primary)] text-white border-transparent'
                  : 'bg-surface-card/95 text-text-muted hover:text-text-main border-border-subtle'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Botón Enfocar Parada Actual */}
            <button
              type="button"
              onClick={() => {
                setFocusMode('stop');
                setTriggerCenter((prev) => prev + 1);
              }}
              title="Enfocar Parada Actual"
              className={`p-2 rounded-full border soft-shadow transition-all cursor-pointer ${
                focusMode === 'stop'
                  ? 'bg-[var(--color-role-primary)] text-white border-transparent'
                  : 'bg-surface-card/95 text-text-muted hover:text-text-main border-border-subtle'
              }`}
            >
              <MapPinned className="w-3.5 h-3.5" />
            </button>

            {/* Recargar Ruta */}
            <button
              type="button"
              onClick={() => loadShops()}
              title="Actualizar Ruta"
              className="p-2 bg-surface-card/95 rounded-full border border-border-subtle soft-shadow text-text-muted hover:text-text-main transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${optimizing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Canvas de Mapa Leaflet */}
        <div className="w-full h-full flex-1 relative z-0 isolate overflow-hidden">
          <MapContainer
            center={[distCenter.lat, distCenter.lng]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <MapController
              route={optimizedRoute}
              fullStreetCoords={fullStreetCoords}
              currentStop={currentStop}
              focusMode={focusMode}
              triggerCenter={triggerCenter}
              activeTab={activeTab}
            />
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap"
            />

            {/* 1. Capa Base de Carretera (Borde exterior oscuro para alto contraste sobre calles) */}
            {fullStreetCoords.length > 1 && (
              <Polyline
                positions={fullStreetCoords}
                color="#1e293b"
                weight={8}
                opacity={0.45}
                lineCap="round"
                lineJoin="round"
              />
            )}

            {/* 2. Trazado Vial por Tramos (Entregados en Verde Esmeralda, Tramo Activo en Naranja Intenso, Pendientes en Ámbar) */}
            {routeLegs.length > 0 ? (
              routeLegs.map((leg, idx) => {
                const targetStopNumber = idx + 1;
                const destStop = optimizedRoute[targetStopNumber];
                const isLegDelivered = destStop && Boolean(deliveredStops[destStop.id]);
                const isLegActive = targetStopNumber === currentStopIndex;

                return (
                  <React.Fragment key={`${leg.fromId}-${leg.toId}`}>
                    <Polyline
                      positions={leg.coordinates}
                      color={isLegDelivered ? '#10b981' : isLegActive ? '#ea580c' : '#f59e0b'}
                      weight={isLegActive ? 6 : 4.5}
                      opacity={isLegActive ? 0.98 : 0.82}
                      lineCap="round"
                      lineJoin="round"
                    />
                    {isLegActive && (
                      <Polyline
                        positions={leg.coordinates}
                        color="#fffbeb"
                        weight={2}
                        opacity={0.9}
                        dashArray="6, 10"
                      />
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              fullStreetCoords.length > 1 && (
                <Polyline
                  positions={fullStreetCoords}
                  color="#ea580c"
                  weight={5}
                  opacity={0.9}
                />
              )
            )}

            {/* Marcador CEDIS Altamira */}
            <Marker position={[distCenter.lat, distCenter.lng]} icon={createCedisIcon()}>
              <Popup autoPan={false}>
                <div className="p-1 max-w-[200px]">
                  <span className="text-[9px] font-bold text-orange-600 uppercase block tracking-wider">
                    Centro de Distribución
                  </span>
                  <strong className="text-xs text-gray-900 block mt-0.5">{distCenter.name}</strong>
                  <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{distCenter.address}</p>
                </div>
              </Popup>
            </Marker>

            {/* Marcador del Camión #402 en Vivo */}
            {isLiveGpsActive && (
              <Marker position={truckPosition} icon={createLiveTruckIcon()}>
                <Popup autoPan={false}>
                  <div className="p-1">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase block">
                      GPS en Vivo Activo • {truckSpeedKmh} km/h
                    </span>
                    <strong className="text-xs text-gray-900">Camión #402 (Carlos Mendoza)</strong>
                    <p className="text-[10px] text-gray-500">Rumbo a Parada #{currentStopIndex}: {currentStop.name}</p>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* Marcadores Numerados de Tiendas */}
            {optimizedRoute.slice(1).map((shop, idx) => {
              const stopNumber = idx + 1;
              const isDelivered = Boolean(deliveredStops[shop.id]);
              const isCurrent = currentStopIndex === stopNumber;
              const legInfo = routeLegs[idx];

              return (
                <Marker
                  key={shop.id}
                  position={[shop.lat, shop.lng]}
                  icon={createNumberedIcon(stopNumber, isDelivered, isCurrent)}
                  eventHandlers={{
                    click: () => {
                      setCurrentStopIndex(stopNumber);
                    },
                  }}
                >
                  <Popup autoPan={false}>
                    <div className="p-1 max-w-[215px] space-y-2">
                      <div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isDelivered
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          Parada #{stopNumber} • {isDelivered ? 'Entregada' : 'Pendiente'}
                        </span>
                        <h4 className="font-bold text-xs text-gray-900 mt-1">{shop.name}</h4>
                        <p className="text-[10px] text-gray-500 leading-tight">{shop.address}</p>
                        {legInfo && (
                          <p className="text-[9px] font-mono text-orange-700 mt-1">
                            Tramo: {legInfo.distanceKm} km • ~{legInfo.durationMin} min ({legInfo.streetSummary})
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 pt-1.5 border-t border-gray-200">
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenGoogleMaps(shop.lat, shop.lng);
                          }}
                          className="w-full py-1 px-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <ExternalLink size={11} /> Navegación GPS
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendWhatsAppNotification(shop);
                          }}
                          className="w-full py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Share2 size={11} /> Avisar por WhatsApp
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPod(shop);
                          }}
                          className="w-full py-1 px-2 rounded bg-gray-900 hover:bg-black text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <PenTool size={11} /> {isDelivered ? 'Ver Firma / Cobro' : 'Entrega y Firma POD'}
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Tarjeta Flotante Inferior de Navegación Vial y Acciones del Chofer */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 pointer-events-auto">
          <div className="bg-surface-card/95 backdrop-blur-md p-3.5 rounded-2xl soft-shadow border border-border-subtle shadow-2xl space-y-2">
            {/* Stepper y selector de paradas */}
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentStopIndex <= 1}
                  onClick={() => {
                    const newIdx = Math.max(1, currentStopIndex - 1);
                    setCurrentStopIndex(newIdx);
                    setFocusMode('stop');
                    setTriggerCenter((prev) => prev + 1);
                  }}
                  className="p-1 rounded-lg border border-border-subtle hover:bg-bg-main disabled:opacity-30 disabled:pointer-events-none text-text-main transition-colors cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-role-primary)] px-2 py-0.5 rounded-md bg-[var(--color-role-primary)]/10">
                  {currentStopIndex === 0 ? 'CEDIS (Salida)' : `Parada ${currentStopIndex} de ${totalStopsCount}`}
                </span>

                <button
                  type="button"
                  disabled={currentStopIndex >= totalStopsCount}
                  onClick={() => {
                    const newIdx = Math.min(totalStopsCount, currentStopIndex + 1);
                    setCurrentStopIndex(newIdx);
                    setFocusMode('stop');
                    setTriggerCenter((prev) => prev + 1);
                  }}
                  className="p-1 rounded-lg border border-border-subtle hover:bg-bg-main disabled:opacity-30 disabled:pointer-events-none text-text-main transition-colors cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {deliveredStops[currentStop.id] ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Entregado (${(podRecords[currentStop.id]?.amountCollected ?? 1800).toFixed(0)})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 flex items-center gap-1">
                  <Clock size={11} /> {activeLeg ? `${activeLeg.distanceKm} km • ~${activeLeg.durationMin} min` : 'En Ruta'}
                </span>
              )}
            </div>

            {/* Datos de la tienda seleccionada y vía óptima */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-role-primary)] text-white flex items-center justify-center font-black shadow-sm text-xs shrink-0">
                {currentStopIndex === 0 ? '🏢' : `#${currentStopIndex}`}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="text-xs font-bold text-text-main truncate leading-tight">
                  {currentStop.name}
                </h3>
                <p className="text-[10px] text-text-muted truncate mt-0.5">
                  {activeLeg
                    ? `Vía óptima: ${activeLeg.streetSummary} • ${currentStop.address}`
                    : currentStop.address || 'Zona Conurbada Tampico-Madero'}
                </p>
              </div>
            </div>

            {/* Botones de acción directa para el Chofer */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => handleOpenGoogleMaps(currentStop.lat, currentStop.lng)}
                className="py-2 px-1 rounded-xl bg-bg-main border border-border-subtle hover:border-blue-400 text-text-main text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <Navigation size={13} className="text-blue-500" />
                <span>GPS Calle</span>
              </button>

              <button
                type="button"
                onClick={() => handleSendWhatsAppNotification(currentStop)}
                className="py-2 px-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer hover:bg-emerald-500/20"
              >
                <Share2 size={13} className="text-emerald-600" />
                <span>Avisar WPP</span>
              </button>

              <button
                type="button"
                onClick={() => handleViewRemision(currentStop)}
                className="py-2 px-1 rounded-xl bg-bg-main border border-border-subtle hover:border-amber-400 text-text-main text-[9px] font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <FileText size={13} className="text-amber-500" />
                <span>Remisión</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenPod(currentStop)}
                className={`py-2 px-1 rounded-xl text-[9px] font-bold flex flex-col items-center justify-center gap-1 shadow transition-all cursor-pointer ${
                  deliveredStops[currentStop.id]
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110 active:scale-95'
                }`}
              >
                <PenTool size={13} />
                <span>{deliveredStops[currentStop.id] ? 'Liquidado' : 'Cobrar / POD'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PESTAÑA 2: LISTA SECUENCIAL DE PARADAS */}
      <div
        className={cn(
          'flex-1 px-4 space-y-3 overflow-y-auto pb-20',
          activeTab !== 'stops' && 'hidden'
        )}
      >
        <div className="bg-surface-card p-3.5 rounded-2xl border border-border-subtle soft-shadow space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-text-main">Progreso de Entregas del Día</span>
            <span className="font-mono font-bold text-[var(--color-role-primary)]">
              {deliveredCount} de {totalStopsCount} completadas ({progressPercent}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-bg-main overflow-hidden border border-border-subtle">
            <div
              className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Orden de Visita Programado
          </span>
          <span className="text-[10px] font-bold text-text-muted">
            Total: {routeStats?.totalDistanceKm || 32.4} km
          </span>
        </div>

        {optimizedRoute.slice(1).map((shop, idx) => {
          const stopNumber = idx + 1;
          const isDelivered = Boolean(deliveredStops[shop.id]);
          const isCurrent = currentStopIndex === stopNumber;
          const leg = routeLegs[idx];
          const pod = podRecords[shop.id];

          return (
            <div
              key={shop.id}
              className={cn(
                'p-3 rounded-2xl border transition-all space-y-2.5 text-left',
                isCurrent ? 'ring-2 ring-orange-500/40 bg-surface-card' : 'bg-surface-card',
                isDelivered ? 'border-emerald-500/30 opacity-95' : 'border-border-subtle soft-shadow'
              )}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      'w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm',
                      isDelivered
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-[var(--color-role-primary)] text-white'
                          : 'bg-gray-700 text-white'
                    )}
                  >
                    {isDelivered ? '✓' : stopNumber}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-main leading-tight">{shop.name}</h4>
                    <p className="text-[10px] text-text-muted mt-0.5">{shop.address}</p>
                    {leg && (
                      <p className="text-[9px] font-mono text-[var(--color-role-primary)] mt-0.5">
                        Tramo #{stopNumber}: {leg.distanceKm} km • ~{leg.durationMin} min por {leg.streetSummary}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase',
                    isDelivered ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  )}
                >
                  {isDelivered ? `$${(pod?.amountCollected ?? 1800).toFixed(0)} Cobrado` : 'Pendiente'}
                </span>
              </div>

              <div className="flex gap-1.5 pt-1 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => handleSelectStopFromList(stopNumber)}
                  className="flex-1 py-1.5 px-1.5 rounded-lg bg-bg-main border border-border-subtle hover:border-[var(--color-role-primary)] text-text-main text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Eye size={12} className="text-orange-500" />
                  <span>Ver Trazo</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleViewRemision(shop)}
                  className="flex-1 py-1.5 px-1.5 rounded-lg bg-bg-main border border-border-subtle hover:border-[var(--color-role-primary)] text-text-main text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <FileText size={12} className="text-amber-500" />
                  <span>Remisión</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSendWhatsAppNotification(shop)}
                  className="flex-1 py-1.5 px-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Share2 size={12} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenPod(shop)}
                  className="flex-1 py-1.5 px-1.5 rounded-lg bg-[var(--color-role-primary)] text-white text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <PenTool size={12} />
                  <span>{isDelivered ? 'Firma' : 'Cobrar'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* PESTAÑA 3: ACOMODO DE CARGA LIFO */}
      <div
        className={cn(
          'flex-1 px-4 space-y-3.5 overflow-y-auto pb-20 text-left',
          activeTab !== 'loading' && 'hidden'
        )}
      >
        <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-2">
          <h4 className="text-xs font-bold text-text-main uppercase flex items-center gap-2">
            <Package size={15} className="text-[var(--color-role-primary)]" />
            <span>Orden de Estiba en Camión • CEDIS Altamira</span>
          </h4>
          <p className="text-[11px] text-text-muted leading-relaxed">
            Ordenado según la secuencia de paradas: la <strong>última entrega</strong> se coloca al{' '}
            <strong>fondo de la caja</strong> del camión, y la <strong>primera entrega</strong> junto a la{' '}
            <strong>puerta trasera</strong> para descarga inmediata sin reacomodos.
          </p>

          <div className="pt-2 flex items-center justify-between text-[11px] font-mono border-t border-border-subtle">
            <span className="text-text-muted">
              Unidad: <strong>Camión #402 (Ford Cargo)</strong>
            </span>
            <span className="text-emerald-600 font-bold">Capacidad: 88% Ocupada</span>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block px-1">
            Secuencia Física de Estiba en Andén de Carga
          </span>

          {optimizedRoute
            .slice(1)
            .reverse()
            .map((shop, idx) => {
              const originalIndex = optimizedRoute.length - 1 - idx;
              const isDoor = idx === optimizedRoute.length - 2;
              const isBack = idx === 0;

              return (
                <div
                  key={shop.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isDoor
                      ? 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-300 dark:border-orange-800'
                      : 'bg-surface-card border-border-subtle'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-bg-main border border-border-subtle text-[11px] font-mono font-bold flex items-center justify-center text-text-main">
                      {idx + 1}
                    </span>
                    <div>
                      <strong className="text-text-main block text-xs">{shop.name}</strong>
                      <span className="text-[10px] text-text-muted">Destinado a Parada #{originalIndex}</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                      isDoor
                        ? 'bg-orange-500 text-white'
                        : isBack
                          ? 'bg-gray-800 text-white'
                          : 'bg-bg-main border border-border-subtle text-text-muted'
                    }`}
                  >
                    {isDoor ? '🚪 Puerta Trasera (Descarga #1)' : isBack ? '📦 Fondo de Caja' : 'Nivel Medio'}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* PESTAÑA 4: LIQUIDACIÓN DE COBRANZA Y LOGÍSTICA INVERSA (CORTE DE CAJA) */}
      <div
        className={cn(
          'flex-1 px-4 space-y-3.5 overflow-y-auto pb-20 text-left',
          activeTab !== 'settlement' && 'hidden'
        )}
      >
        <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-role-primary)] font-mono block">
                Arqueo Diario • Chofer #402
              </span>
              <h3 className="text-sm font-bold text-text-main">
                Liquidación de Cobranza y Mermas
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {deliveredCount}/{totalStopsCount} Tiendas
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
              <div className="flex items-center gap-1.5 text-emerald-600 text-[10px] font-bold uppercase">
                <Banknote size={13} />
                <span>Efectivo en Caja</span>
              </div>
              <p className="text-lg font-black text-text-main mt-1 font-mono">
                ${totalCash.toFixed(2)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
              <div className="flex items-center gap-1.5 text-blue-600 text-[10px] font-bold uppercase">
                <Landmark size={13} />
                <span>Transferencia SPEI</span>
              </div>
              <p className="text-lg font-black text-text-main mt-1 font-mono">
                ${totalTransfer.toFixed(2)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
              <div className="flex items-center gap-1.5 text-amber-600 text-[10px] font-bold uppercase">
                <CreditCard size={13} />
                <span>Crédito VMI</span>
              </div>
              <p className="text-lg font-black text-text-main mt-1 font-mono">
                ${totalCredit.toFixed(2)}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-bg-main border border-border-subtle">
              <div className="flex items-center gap-1.5 text-rose-600 text-[10px] font-bold uppercase">
                <PackageMinus size={13} />
                <span>Mermas / Devolución</span>
              </div>
              <p className="text-lg font-black text-rose-600 mt-1 font-mono">
                -${totalReturns.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[var(--color-role-primary)]/10 border border-[var(--color-role-primary)]/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Total Neto a Entregar en CEDIS
              </span>
              <span className="text-xs text-text-muted">Efectivo + SPEI + Pagarés VMI</span>
            </div>
            <span className="text-xl font-black text-[var(--color-role-primary)] font-mono">
              ${netRouteTotal.toFixed(2)} MXN
            </span>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-text-muted block mb-1">
              Notas de Cierre de Ruta para Gerencia CEDIS
            </label>
            <textarea
              value={settlementNotes}
              onChange={(e) => setSettlementNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSaveRouteSettlement}
            className="w-full py-3 rounded-xl bg-[var(--color-role-primary)] hover:brightness-110 active:scale-98 text-[var(--color-text-light)] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer"
          >
            <Send size={14} />
            <span>
              {settlementSent ? 'Corte de Caja Enviado a CEDIS ✓' : 'Enviar Corte de Caja a CEDIS Altamira'}
            </span>
          </button>
        </div>
      </div>

      {/* Modal de Firma Digital, Cobranza y Mermas (POD) */}
      <SignaturePadModal
        isOpen={isPodOpen}
        onClose={() => setIsPodOpen(false)}
        shopName={selectedStopForPod?.name || 'Tienda en Ruta'}
        orderId={selectedStopForPod?.id ? `FOLIO-${selectedStopForPod.id.toUpperCase()}` : 'ORD-MX-9821'}
        orderTotal={1800}
        onConfirmDelivery={handleConfirmDelivery}
      />

      {/* Modal de Remisión / Ticket PDF y Térmico Bluetooth */}
      <RemisionTicketModal
        isOpen={isTicketOpen}
        onClose={() => setIsTicketOpen(false)}
        order={activeOrderForTicket}
        shopName={selectedStopForPod?.name || 'Abarrotes Don Lupe'}
        driverName="Chofer #402 - Unidad Ford Cargo CEDIS Altamira"
        podData={selectedStopForPod ? podRecords[selectedStopForPod.id] : undefined}
      />
    </div>
  );
}
