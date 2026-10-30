export interface RoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  phone?: string;
  delivered?: boolean;
}

export interface LegMetric {
  fromId: string;
  toId: string;
  distanceKm: number;
  durationMin: number;
  streetSummary: string;
  coordinates: [number, number][];
}

export interface TracedRouteResult {
  orderedStops: RoutePoint[];
  fullCoordinates: [number, number][];
  legs: LegMetric[];
  totalDistanceKm: number;
  totalDurationMin: number;
  source: 'osrm-streets' | 'arterial-corridor';
}

// Distancia Haversine terrestre en km
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Algoritmo Híbrido DVRP: Nearest Neighbor + Refinamiento 2-Opt (elimina cruces y minimiza km totales)
export function computeOptimalStopOrder(start: RoutePoint, destinations: RoutePoint[]): RoutePoint[] {
  if (!destinations || destinations.length === 0) return [start];
  if (destinations.length === 1) return [start, destinations[0]];

  // Paso 1: Construcción inicial voraz (Vecino Más Cercano desde CEDIS)
  const unvisited = [...destinations];
  const route: RoutePoint[] = [start];
  let current = start;

  while (unvisited.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineKm(current.lat, current.lng, unvisited[i].lat, unvisited[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    current = unvisited.splice(bestIdx, 1)[0];
    route.push(current);
  }

  // Paso 2: Optimización local 2-Opt (fijando start en índice 0)
  let improved = true;
  let iterations = 0;
  const n = route.length;

  const routeCost = (r: RoutePoint[]) => {
    let total = 0;
    for (let i = 0; i < r.length - 1; i++) {
      total += haversineKm(r[i].lat, r[i].lng, r[i + 1].lat, r[i + 1].lng);
    }
    return total;
  };

  while (improved && iterations < 50) {
    improved = false;
    iterations++;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const candidate = [
          ...route.slice(0, i),
          ...route.slice(i, k + 1).reverse(),
          ...route.slice(k + 1),
        ];
        if (routeCost(candidate) + 0.001 < routeCost(route)) {
          route.splice(0, route.length, ...candidate);
          improved = true;
        }
      }
    }
  }

  return route;
}

// Nodos viales reales de la Zona Conurbada Altamira - Tampico - Cd. Madero para fallback offline sin líneas rectas
const ARTERIAL_NODES: { name: string; lat: number; lng: number }[] = [
  { name: 'Carr. Tampico-Mante Km 11 (Laguna de la Puerta)', lat: 22.3320, lng: -97.9010 },
  { name: 'Av. de la Industria (Monte Alto)', lat: 22.3160, lng: -97.8915 },
  { name: 'Entronque Libramiento / Av. de la Industria', lat: 22.3010, lng: -97.8835 },
  { name: 'La Divisoria Tampico-Altamira (Av. Hidalgo Norte)', lat: 22.2885, lng: -97.8755 },
  { name: 'Aeropuerto / Blvd. Adolfo López Mateos', lat: 22.2810, lng: -97.8685 },
  { name: 'Av. Las Torres / Col. Las Américas', lat: 22.2665, lng: -97.8665 },
  { name: 'Av. Hidalgo (Zona Dorada / Lomas de Rosales)', lat: 22.2515, lng: -97.8680 },
  { name: 'Av. Ejército Mexicano / Av. Universidad', lat: 22.2485, lng: -97.8545 },
  { name: 'Av. Álvaro Obregón (Árbol Grande Cd. Madero)', lat: 22.2495, lng: -97.8385 },
  { name: 'Av. Primero de Mayo (Centro Cd. Madero)', lat: 22.2680, lng: -97.8195 },
  { name: 'Av. Hidalgo Sur (Centro Tampico)', lat: 22.2265, lng: -97.8615 },
  { name: 'Calle Héroes de Chapultepec / Zona Centro', lat: 22.2165, lng: -97.8585 },
];

// Genera una geometría de calle realista interpolando por corredores viales cuando no hay internet
function buildArterialStreetLeg(from: RoutePoint, to: RoutePoint): LegMetric {
  const directDist = haversineKm(from.lat, from.lng, to.lat, to.lng);

  // Buscar nodos viales intermedios que estén dentro del corredor entre `from` y `to`
  const minLat = Math.min(from.lat, to.lat) - 0.008;
  const maxLat = Math.max(from.lat, to.lat) + 0.008;
  const minLng = Math.min(from.lng, to.lng) - 0.015;
  const maxLng = Math.max(from.lng, to.lng) + 0.015;

  const candidates = ARTERIAL_NODES.filter(
    (node) =>
      node.lat >= minLat &&
      node.lat <= maxLat &&
      node.lng >= minLng &&
      node.lng <= maxLng &&
      haversineKm(from.lat, from.lng, node.lat, node.lng) > 0.35 &&
      haversineKm(to.lat, to.lng, node.lat, node.lng) > 0.35 &&
      haversineKm(from.lat, from.lng, node.lat, node.lng) +
        haversineKm(node.lat, node.lng, to.lat, to.lng) <
        directDist * 1.42
  );

  // Ordenar nodos intermedios por cercanía progresiva desde el origen
  candidates.sort(
    (a, b) =>
      haversineKm(from.lat, from.lng, a.lat, a.lng) -
      haversineKm(from.lat, from.lng, b.lat, b.lng)
  );

  const waypoints: { lat: number; lng: number; name?: string }[] = [
    { lat: from.lat, lng: from.lng },
    ...candidates.slice(0, 4),
    { lat: to.lat, lng: to.lng },
  ];

  // Subdividir cada tramo simulando retícula urbana (L-turns suaves sobre calles)
  const coords: [number, number][] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      // Ligera curvatura arterial realista
      const bend = Math.sin(t * Math.PI) * 0.0012 * (i % 2 === 0 ? 1 : -1);
      coords.push([
        Number((p1.lat + (p2.lat - p1.lat) * t + bend * 0.4).toFixed(6)),
        Number((p1.lng + (p2.lng - p1.lng) * t - bend).toFixed(6)),
      ]);
    }
  }
  coords.push([to.lat, to.lng]);

  // Calcular distancia total sobre el trazo vial
  let roadKm = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    roadKm += haversineKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  roadKm = Number(Math.max(roadKm, directDist * 1.18).toFixed(2));
  const durationMin = Math.max(3, Math.round((roadKm / 28) * 60));

  const mainAvenue = candidates[0]?.name || 'Av. Hidalgo / Corredor Urbano';

  return {
    fromId: from.id,
    toId: to.id,
    distanceKm: roadKm,
    durationMin,
    streetSummary: mainAvenue,
    coordinates: coords,
  };
}

// Obtiene el trazado exacto por calles usando OSRM (OpenStreetMap Routing Machine) con fallback arterial
export async function traceOptimalStreetRoute(
  start: RoutePoint,
  destinations: RoutePoint[]
): Promise<TracedRouteResult> {
  const orderedStops = computeOptimalStopOrder(start, destinations);
  if (orderedStops.length <= 1) {
    return {
      orderedStops,
      fullCoordinates: [[start.lat, start.lng]],
      legs: [],
      totalDistanceKm: 0,
      totalDurationMin: 0,
      source: 'arterial-corridor',
    };
  }

  // Intentar consulta a OSRM para obtener geometría real calle por calle
  try {
    const coordString = orderedStops
      .map((pt) => `${pt.lng.toFixed(6)},${pt.lat.toFixed(6)}`)
      .join(';');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const fullCoordinates: [number, number][] = route.geometry.coordinates.map(
          (c: [number, number]) => [c[1], c[0]]
        );

        const legs: LegMetric[] = (route.legs || []).map((leg: any, idx: number) => {
          const legCoords: [number, number][] = [];
          if (leg.steps && Array.isArray(leg.steps)) {
            for (const step of leg.steps) {
              if (step.geometry?.coordinates) {
                for (const c of step.geometry.coordinates) {
                  legCoords.push([c[1], c[0]]);
                }
              }
            }
          }
          return {
            fromId: orderedStops[idx]?.id || `stop-${idx}`,
            toId: orderedStops[idx + 1]?.id || `stop-${idx + 1}`,
            distanceKm: Number((leg.distance / 1000).toFixed(2)),
            durationMin: Math.max(2, Math.round(leg.duration / 60)),
            streetSummary: leg.summary || 'Vía Principal Conurbada',
            coordinates:
              legCoords.length > 1
                ? legCoords
                : [
                    [orderedStops[idx].lat, orderedStops[idx].lng],
                    [orderedStops[idx + 1].lat, orderedStops[idx + 1].lng],
                  ],
          };
        });

        const totalDistanceKm = Number((route.distance / 1000).toFixed(1));
        const totalDurationMin = Math.round(route.duration / 60) + destinations.length * 10;

        return {
          orderedStops,
          fullCoordinates,
          legs,
          totalDistanceKm,
          totalDurationMin,
          source: 'osrm-streets',
        };
      }
    }
  } catch {
    // Si OSRM no responde o estamos en modo Offline, usar el motor vial arterial Tampico-Madero-Altamira
  }

  // Fallback arterial calle por calle
  const legs: LegMetric[] = [];
  const fullCoordinates: [number, number][] = [];
  let totalDistanceKm = 0;
  let totalDurationMin = 0;

  for (let i = 0; i < orderedStops.length - 1; i++) {
    const leg = buildArterialStreetLeg(orderedStops[i], orderedStops[i + 1]);
    legs.push(leg);
    totalDistanceKm += leg.distanceKm;
    totalDurationMin += leg.durationMin + 10; // +10 min de maniobra y descarga por tienda
    if (i === 0) {
      fullCoordinates.push(...leg.coordinates);
    } else {
      fullCoordinates.push(...leg.coordinates.slice(1));
    }
  }

  return {
    orderedStops,
    fullCoordinates,
    legs,
    totalDistanceKm: Number(totalDistanceKm.toFixed(1)),
    totalDurationMin,
    source: 'arterial-corridor',
  };
}

