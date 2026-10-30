import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import {
  Truck,
  MapPin,
  Clock,
  CheckCircle2,
  Phone,
  MessageCircle,
  FileText,
  Package,
  Navigation,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { motion } from 'motion/react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import RemisionTicketModal from '../components/RemisionTicketModal';
import {
  getOrders,
  getDriverLiveLocation,
  subscribeToDriverLocation,
  Order,
} from '../lib/services';
import { traceOptimalStreetRoute, haversineKm } from '../lib/routeGeometry';
import { sendLocalPushNotification } from '../lib/pushNotifications';

interface ShopDeliveryTrackingScreenProps {
  shopName?: string;
  shopAddress?: string;
  onNavigateToCatalog?: () => void;
}

const createShopIcon = () => {
  return L.divIcon({
    className: 'custom-shop-tracking-marker',
    html: `<div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); width: 38px; height: 38px; border-radius: 12px; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 18px; box-shadow: 0 4px 14px rgba(234,88,12,0.45);">
      🏪
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
};

const createTruckIcon = () => {
  return L.divIcon({
    className: 'custom-truck-tracking-marker',
    html: `<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 38px; height: 38px; border-radius: 9999px; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 17px; box-shadow: 0 0 0 5px rgba(16,185,129,0.28), 0 4px 14px rgba(16,185,129,0.45);">
      🚚
    </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  });
};

const createCedisIcon = () => {
  return L.divIcon({
    className: 'custom-cedis-tracking-marker',
    html: `<div style="background: #111827; width: 34px; height: 34px; border-radius: 10px; border: 2.5px solid #ea580c; display: flex; align-items: center; justify-content: center; color: #f97316; font-size: 16px; box-shadow: 0 3px 10px rgba(0,0,0,0.3);">
      🏢
    </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

function TrackingMapController({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!map || coords.length < 2 || initializedRef.current) return;
    initializedRef.current = true;
    map.invalidateSize();
    map.stop();
    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
  }, [map, coords]);

  return null;
}

export default function ShopDeliveryTrackingScreen({
  shopName = 'Abarrotes Don Lupe',
  shopAddress = 'Zona Centro, Tampico',
  onNavigateToCatalog,
}: ShopDeliveryTrackingScreenProps) {
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [latestOrder, setLatestOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const cedisLocation = {
    id: 'cedis-altamira',
    lat: 22.3385,
    lng: -97.9042,
    name: 'CEDIS Altamira (Almacenes Ibarra)',
  };

  const shopLocation = {
    id: 'shop-dest',
    lat: 22.2155,
    lng: -97.8578,
    name: shopName,
    address: shopAddress,
  };

  // Coordenadas calle por calle de toda la ruta CEDIS -> Tienda
  const [streetCoords, setStreetCoords] = useState<[number, number][]>([]);
  const [truckIndex, setTruckIndex] = useState<number>(0);
  const [truckPos, setTruckPos] = useState<[number, number]>([22.2665, -97.8665]);
  const [truckSpeed, setTruckSpeed] = useState<number>(36);
  const [isSimulatingLive, setIsSimulatingLive] = useState<boolean>(true);
  const notifiedArrivalRef = useRef(false);

  // Cargar geometría real por calles (OSRM / Corredor Arterial Av. de la Industria -> Av. Hidalgo)
  useEffect(() => {
    let mounted = true;
    traceOptimalStreetRoute(cedisLocation, [shopLocation]).then((res) => {
      if (!mounted) return;
      if (res.fullCoordinates.length > 1) {
        setStreetCoords(res.fullCoordinates);
        const startIdx = Math.floor(res.fullCoordinates.length * 0.45);
        setTruckIndex(startIdx);
        setTruckPos(res.fullCoordinates[startIdx]);
      }
    });
    return () => {
      mounted = false;
    };
  }, [shopName]);

  // Suscribirse al GPS en vivo transmitido por el Chofer desde Supabase / BroadcastChannel
  useEffect(() => {
    getDriverLiveLocation('chofer-402').then((loc) => {
      if (loc && loc.lat && loc.lng) {
        setTruckPos([loc.lat, loc.lng]);
        if (loc.speedKmh) setTruckSpeed(loc.speedKmh);
      }
    });

    const unsub = subscribeToDriverLocation((loc) => {
      if (loc && loc.lat && loc.lng) {
        setTruckPos([loc.lat, loc.lng]);
        if (loc.speedKmh) setTruckSpeed(loc.speedKmh);
      }
    });

    return () => unsub();
  }, []);

  // Avance fluido del camión sobre el trazo vial de las calles
  useEffect(() => {
    if (!isSimulatingLive || streetCoords.length < 3) return;
    const timer = setInterval(() => {
      setTruckIndex((prev) => {
        const next = prev + 1 >= streetCoords.length ? Math.floor(streetCoords.length * 0.25) : prev + 1;
        const coord = streetCoords[next];
        if (coord) {
          setTruckPos(coord);
          setTruckSpeed(32 + (next % 11));

          const distRemaining = haversineKm(coord[0], coord[1], shopLocation.lat, shopLocation.lng);
          if (distRemaining < 1.2 && !notifiedArrivalRef.current) {
            notifiedArrivalRef.current = true;
            sendLocalPushNotification({
              title: '¡Tu pedido Almacenes Ibarra está por llegar! 🚛',
              body: `El Camión #402 está a menos de ${distRemaining.toFixed(1)} km de ${shopName}.`,
              tag: 'vmi-truck-arriving',
            });
          }
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [isSimulatingLive, streetCoords, shopName]);

  useEffect(() => {
    async function fetchLatestOrder() {
      setLoading(true);
      try {
        const orders = await getOrders();
        if (orders && orders.length > 0) {
          setLatestOrder(orders[0]);
        } else {
          setLatestOrder({
            id: 'ORD-MX-2026',
            items: [
              { id: '1', name: 'Agua Ciel 1L (Caja 12)', quantity: 2, price: 150 },
              { id: '2', name: 'Sabritas Sal 45g (Caja 30)', quantity: 1, price: 360 },
            ],
            total: 660,
            status: 'confirmed',
            createdAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Aviso cargando orden de entrega:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLatestOrder();
  }, []);

  const remainingKm = Number(
    Math.max(0.4, haversineKm(truckPos[0], truckPos[1], shopLocation.lat, shopLocation.lng) * 1.18).toFixed(1)
  );
  const etaMinutes = Math.max(2, Math.round((remainingKm / 28) * 60));

  const completedPathCoords: [number, number][] =
    streetCoords.length > 1 && truckIndex > 0
      ? streetCoords.slice(0, truckIndex + 1)
      : [
          [cedisLocation.lat, cedisLocation.lng],
          [truckPos[0], truckPos[1]],
        ];

  const remainingPathCoords: [number, number][] =
    streetCoords.length > 1 && truckIndex < streetCoords.length
      ? streetCoords.slice(truckIndex)
      : [
          [truckPos[0], truckPos[1]],
          [shopLocation.lat, shopLocation.lng],
        ];

  const handleContactDriver = () => {
    const text = encodeURIComponent(
      `👋 Hola Chofer de la unidad #402 de Almacenes Ibarra. Le escribo de *${shopName}* (${shopAddress}). Ya tenemos libre el espacio para recibir la descarga del pedido.`
    );
    window.open(`https://wa.me/528331759734?text=${text}`, '_blank');
  };

  const handleCallCedis = () => {
    window.open('tel:8332601000', '_self');
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans pb-28">
      {/* Header Superior del Rastreo */}
      <header className="sticky top-0 z-30 bg-bg-main/95 backdrop-blur-md border-b border-border-subtle pt-6 pb-3 px-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-[var(--color-role-primary)] uppercase tracking-wider block">
              Rastreo Satelital VMI • Almacenes Ibarra
            </span>
            <h1 className="text-lg font-bold text-text-main leading-tight mt-0.5">
              Entrega en Camino 🚛
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setIsSimulatingLive(!isSimulatingLive)}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span className={`w-2 h-2 rounded-full bg-emerald-500 ${isSimulatingLive ? 'animate-ping' : ''}`} />
            <span>{isSimulatingLive ? `GPS Vivo (${truckSpeed} km/h)` : 'GPS Pausado'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Banner de Tiempo Estimado Dinámico y Chofer */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-600 p-0.5 rounded-3xl shadow-lg"
        >
          <div className="bg-surface-card p-4 rounded-[22px] space-y-3 text-left">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-orange-600 shrink-0">
                  <Truck className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-orange-600 block">
                    Llegada Estimada por Ruta Vial Óptima
                  </span>
                  <h3 className="text-xl font-black text-text-main leading-tight">
                    ~{etaMinutes} minutos ({remainingKm} km)
                  </h3>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Vía: <strong>Av. de la Industria ➔ Av. Hidalgo</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Stepper visual de progreso del pedido */}
            <div className="pt-2 border-t border-border-subtle grid grid-cols-4 gap-1 text-center">
              <div>
                <div className="w-5 h-5 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold mb-1 shadow-sm">
                  ✓
                </div>
                <span className="text-[9px] font-bold text-text-main block">Confirmado</span>
              </div>
              <div>
                <div className="w-5 h-5 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold mb-1 shadow-sm">
                  ✓
                </div>
                <span className="text-[9px] font-bold text-text-main block">Cargado LIFO</span>
              </div>
              <div>
                <div className="w-5 h-5 mx-auto rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold mb-1 shadow-sm ring-2 ring-orange-200 animate-pulse">
                  3
                </div>
                <span className="text-[9px] font-bold text-orange-600 block">En Ruta GPS</span>
              </div>
              <div>
                <div className="w-5 h-5 mx-auto rounded-full bg-gray-200 dark:bg-gray-800 text-text-muted flex items-center justify-center text-[10px] font-bold mb-1">
                  4
                </div>
                <span className="text-[9px] font-medium text-text-muted block">Firma POD</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mapa de Rastreo Satelital en Vivo con Ruta Trazada por Calles */}
        <div className="bg-surface-card rounded-3xl border border-border-subtle overflow-hidden soft-shadow relative z-0 isolate">
          <div className="p-3 border-b border-border-subtle flex items-center justify-between bg-surface-card/90">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-orange-600" />
              <span className="text-xs font-bold text-text-main">
                Recorrido Vial Óptimo en Tiempo Real
              </span>
            </div>
            <span className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">
              <Radio size={12} /> Unidad #402 • {truckSpeed} km/h
            </span>
          </div>

          <div className="w-full h-[265px] relative z-0 isolate overflow-hidden">
            <MapContainer
              center={truckPos}
              zoom={12}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TrackingMapController
                coords={
                  streetCoords.length > 1
                    ? streetCoords
                    : [
                        [cedisLocation.lat, cedisLocation.lng],
                        truckPos,
                        [shopLocation.lat, shopLocation.lng],
                      ]
                }
              />
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap"
              />

              {/* Borde exterior de la carretera para alto contraste */}
              {streetCoords.length > 1 && (
                <Polyline
                  positions={streetCoords}
                  color="#1e293b"
                  weight={8}
                  opacity={0.42}
                  lineCap="round"
                  lineJoin="round"
                />
              )}

              {/* Tramo Ya Recorrido desde CEDIS (Verde Esmeralda Sólido) */}
              <Polyline
                positions={completedPathCoords}
                color="#10b981"
                weight={5}
                opacity={0.9}
                lineCap="round"
                lineJoin="round"
              />

              {/* Tramo Restante hacia la Tienda (Naranja Intenso sobre las calles) */}
              <Polyline
                positions={remainingPathCoords}
                color="#ea580c"
                weight={5.5}
                opacity={0.95}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                positions={remainingPathCoords}
                color="#fffbeb"
                weight={2}
                opacity={0.85}
                dashArray="6, 10"
              />

              {/* Origen: CEDIS Altamira */}
              <Marker position={[cedisLocation.lat, cedisLocation.lng]} icon={createCedisIcon()}>
                <Popup autoPan={false}>
                  <div className="p-1">
                    <strong className="text-xs">CEDIS Altamira</strong>
                    <p className="text-[10px] text-gray-500">Punto de salida y carga de mercancía</p>
                  </div>
                </Popup>
              </Marker>

              {/* Camión en tránsito en vivo */}
              <Marker position={truckPos} icon={createTruckIcon()}>
                <Popup autoPan={false}>
                  <div className="p-1">
                    <strong className="text-xs text-emerald-700">Camión #402 en Camino</strong>
                    <p className="text-[10px] text-gray-500">
                      A {remainingKm} km de {shopName} (~{etaMinutes} min)
                    </p>
                  </div>
                </Popup>
              </Marker>

              {/* Destino: Tienda del tendero */}
              <Marker position={[shopLocation.lat, shopLocation.lng]} icon={createShopIcon()}>
                <Popup autoPan={false}>
                  <div className="p-1">
                    <strong className="text-xs text-orange-600">{shopName}</strong>
                    <p className="text-[10px] text-gray-500">{shopAddress}</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          </div>

          <div className="p-3 bg-bg-main/60 flex items-center justify-between text-[11px] text-text-muted border-t border-border-subtle">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-600" />
              <span>
                Destino: <strong>{shopName}</strong> ({shopAddress})
              </span>
            </span>
            <span className="font-mono text-[10px] font-bold text-emerald-600">
              {remainingKm} km restantes
            </span>
          </div>
        </div>

        {/* Tarjeta del Operador Asignado */}
        <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-3 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-sm">
                CM
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-text-main">Carlos Mendoza</h4>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> Verificado
                  </span>
                </div>
                <p className="text-[10px] text-text-muted">
                  Operador Logístico • Unidad #402 (Placas TM-4821-B)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleContactDriver}
              className="py-2.5 px-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp Chofer</span>
            </button>
            <button
              type="button"
              onClick={handleCallCedis}
              className="py-2.5 px-3 rounded-xl bg-bg-main border border-border-subtle hover:border-[var(--color-role-primary)] text-text-main text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4 text-[var(--color-role-primary)]" />
              <span>Llamar a CEDIS</span>
            </button>
          </div>
        </div>

        {/* Resumen de Mercancía en Camino y Nota de Remisión */}
        <div className="bg-surface-card p-4 rounded-2xl border border-border-subtle soft-shadow space-y-3 text-left">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--color-role-primary)]" />
              <h4 className="text-xs font-bold text-text-main uppercase tracking-wider">
                Mercancía a Recibir en tu Tienda
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold text-text-muted">
              {latestOrder?.id || 'ORD-MX-2026'}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-bg-main border border-border-subtle space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted">Modalidad de Pedido:</span>
              <span className="font-bold text-emerald-600">Preventa VMI Confirmada</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-text-muted">Importe Total a Liquidar:</span>
              <span className="font-black text-sm text-text-main">
                ${(latestOrder?.total || 660).toFixed(2)} MXN
              </span>
            </div>
            <div className="text-[10px] text-text-muted pt-1 border-t border-border-subtle flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Al llegar el camión firmarás de recibido en la pantalla del chofer.</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsTicketOpen(true)}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[var(--color-role-primary)] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm hover:brightness-110 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Ver Nota de Remisión</span>
            </button>
            {onNavigateToCatalog && (
              <button
                type="button"
                onClick={onNavigateToCatalog}
                className="py-2.5 px-3 rounded-xl bg-bg-main border border-border-subtle text-text-main text-xs font-bold hover:border-[var(--color-role-primary)] transition-all cursor-pointer"
              >
                + Nuevo Pedido
              </button>
            )}
          </div>
        </div>
      </main>

      <RemisionTicketModal
        isOpen={isTicketOpen}
        onClose={() => setIsTicketOpen(false)}
        order={latestOrder}
        shopName={shopName}
        driverName="Carlos Mendoza (Chofer #402 - CEDIS Altamira)"
      />
    </div>
  );
}
