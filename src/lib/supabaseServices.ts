import { supabase, isSupabaseConfigured } from './supabase';
import type { Product, OrderItem, Order } from './services';

export interface ShopLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  contact?: string;
}

// 1. OBTENER INVENTARIO DE TIENDA
export async function getSupabaseInventory(): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_catalog', false)
    .order('name');

  if (error) {
    console.error("Supabase getInventory error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    stock: row.stock,
    price: Number(row.price),
    imageUrl: row.image_url,
    category: row.category,
  }));
}

// 2. OBTENER CATÁLOGO DE CEDIS IBARRA
export async function getSupabaseCatalog(): Promise<Product[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_catalog', true)
    .order('name');

  if (error) {
    console.error("Supabase getCatalog error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    stock: row.stock,
    price: Number(row.price),
    imageUrl: row.image_url,
    category: row.category,
  }));
}

// 3. OBTENER LISTA DE PEDIDOS Y SUS ITEMS
export async function getSupabaseOrders(): Promise<Order[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      shop_id,
      total,
      status,
      created_at,
      order_items (
        id,
        product_id,
        name,
        quantity,
        price
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Supabase getOrders error:", error);
    return [];
  }

  return (data || []).map((order: any) => ({
    id: order.id,
    shopId: order.shop_id,
    total: Number(order.total),
    status: order.status,
    createdAt: order.created_at,
    items: (order.order_items || []).map((item: any) => ({
      id: item.product_id || item.id,
      name: item.name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }));
}

// 4. CREAR NUEVO PEDIDO Y DESCONTAR STOCK (TRANSACCIÓN)
export async function placeSupabaseOrder(items: OrderItem[], total: number, shopId: string = 'shp-1'): Promise<string> {
  if (!isSupabaseConfigured) return '';
  try {
    const orderId = `ORD-MX-${Math.floor(Math.random() * 9000 + 1000)}`;

    // 1. Insert order header
    const { error: orderError } = await supabase
      .from('orders')
      .insert({
        id: orderId,
        shop_id: shopId,
        total,
        status: 'pending',
      });

    if (orderError) throw orderError;

    // 2. Insert order items
    const itemsToInsert = items.map(item => ({
      id: `item-${Math.random().toString(36).substring(2, 9)}`,
      order_id: orderId,
      product_id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    // 3. Decrement stock in catalog for each item
    for (const item of items) {
      const { data: currentProduct } = await supabase
        .from('products')
        .select('stock')
        .eq('id', item.id)
        .single();

      if (currentProduct) {
        const newStock = Math.max(0, currentProduct.stock - item.quantity);
        await supabase
          .from('products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', item.id);
      }
    }

    return orderId;
  } catch (error) {
    console.error("Supabase placeOrder error:", error);
    return '';
  }
}

// 5. OBTENER TIENDAS (PARA RUTAS Y LOGÍSTICA)
export async function getSupabaseShops(): Promise<ShopLocation[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .order('name');

  if (error) {
    console.error("Supabase getShops error:", error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    address: row.address,
    contact: row.contact,
  }));
}

export interface PodData {
  signatureUrl?: string;
  receiverName?: string;
  deliveryNotes?: string;
  paymentMethod?: 'cash' | 'transfer' | 'credit';
  amountCollected?: number;
  paymentReference?: string;
  returnItemsCount?: number;
  returnAmount?: number;
  returnReason?: string;
}

export interface DriverLocationState {
  driverId: string;
  driverName: string;
  unitNumber: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  currentStopId?: string;
  currentStopName?: string;
  isActive?: boolean;
  updatedAt: string;
}

export interface RouteSettlement {
  id?: string;
  driverId: string;
  driverName: string;
  routeDate: string;
  totalCash: number;
  totalTransfer: number;
  totalCredit: number;
  totalReturns: number;
  netTotal: number;
  stopsCompleted: number;
  notes?: string;
  createdAt?: string;
}

const LIVE_DRIVER_STORAGE_KEY = 'vmi_live_driver_location_v1';
const SETTLEMENTS_STORAGE_KEY = 'vmi_route_settlements_v1';

// 6. ACTUALIZAR ESTADO DE UN PEDIDO CON PRUEBA DE ENTREGA (POD), COBRANZA Y MERMAS
export async function updateSupabaseOrderStatus(
  orderId: string, 
  status: 'pending' | 'confirmed' | 'in_transit' | 'delivered',
  podData?: PodData
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const basePayload: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (podData) {
    if (podData.signatureUrl) basePayload.signature_url = podData.signatureUrl;
    if (podData.receiverName) basePayload.receiver_name = podData.receiverName;
    if (podData.deliveryNotes) basePayload.delivery_notes = podData.deliveryNotes;
    if (status === 'delivered') basePayload.delivered_at = new Date().toISOString();
  }

  const extendedPayload: any = {
    ...basePayload,
  };

  if (podData) {
    if (podData.paymentMethod) extendedPayload.payment_method = podData.paymentMethod;
    if (typeof podData.amountCollected === 'number') extendedPayload.amount_collected = podData.amountCollected;
    if (podData.paymentReference !== undefined) extendedPayload.payment_reference = podData.paymentReference;
    if (typeof podData.returnItemsCount === 'number') extendedPayload.return_items_count = podData.returnItemsCount;
    if (typeof podData.returnAmount === 'number') extendedPayload.return_amount = podData.returnAmount;
    if (podData.returnReason !== undefined) extendedPayload.return_reason = podData.returnReason;
  }

  const runUpdate = async (payloadToUse: any) => {
    let query = supabase.from('orders').update(payloadToUse);
    if (orderId.startsWith('shp-') || orderId.startsWith('shp_')) {
      query = query.eq('shop_id', orderId);
    } else {
      query = query.eq('id', orderId);
    }
    return await query;
  };

  const { error } = await runUpdate(extendedPayload);
  if (error) {
    // Fallback respetando la tabla original si aún no se ha corrido el ALTER TABLE de cobranza/mermas
    const fallbackRes = await runUpdate(basePayload);
    return !fallbackRes.error;
  }
  return true;
}

// 6.1 ACTUALIZAR Y TRANSMITIR UBICACIÓN GPS EN VIVO DEL CHOFER
export async function updateDriverLiveLocation(location: DriverLocationState): Promise<void> {
  try {
    localStorage.setItem(LIVE_DRIVER_STORAGE_KEY, JSON.stringify(location));
    window.dispatchEvent(new CustomEvent('vmi-driver-gps-update', { detail: location }));
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('vmi_live_gps_channel');
      bc.postMessage(location);
      bc.close();
    }
  } catch {}

  if (!isSupabaseConfigured) return;

  try {
    await supabase.from('driver_locations').upsert({
      driver_id: location.driverId,
      driver_name: location.driverName,
      unit_number: location.unitNumber,
      lat: location.lat,
      lng: location.lng,
      heading: location.heading || 0,
      speed_kmh: location.speedKmh || 0,
      current_stop_id: location.currentStopId || null,
      current_stop_name: location.currentStopName || null,
      is_active: location.isActive ?? true,
      updated_at: location.updatedAt,
    });
  } catch {
    // Silencioso si la tabla aún no existe
  }
}

export async function getDriverLiveLocation(driverId: string = 'chofer-402'): Promise<DriverLocationState | null> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .select('*')
        .eq('driver_id', driverId)
        .single();
      if (!error && data) {
        return {
          driverId: data.driver_id,
          driverName: data.driver_name,
          unitNumber: data.unit_number,
          lat: Number(data.lat),
          lng: Number(data.lng),
          heading: Number(data.heading || 0),
          speedKmh: Number(data.speed_kmh || 0),
          currentStopId: data.current_stop_id,
          currentStopName: data.current_stop_name,
          isActive: data.is_active,
          updatedAt: data.updated_at,
        };
      }
    } catch {}
  }

  try {
    const raw = localStorage.getItem(LIVE_DRIVER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function subscribeToDriverLocation(onUpdate: (loc: DriverLocationState) => void) {
  const handleLocalEvent = (e: Event) => {
    const custom = e as CustomEvent<DriverLocationState>;
    if (custom.detail) onUpdate(custom.detail);
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === LIVE_DRIVER_STORAGE_KEY && e.newValue) {
      try {
        onUpdate(JSON.parse(e.newValue));
      } catch {}
    }
  };

  window.addEventListener('vmi-driver-gps-update', handleLocalEvent);
  window.addEventListener('storage', handleStorage);

  let bc: BroadcastChannel | null = null;
  if ('BroadcastChannel' in window) {
    bc = new BroadcastChannel('vmi_live_gps_channel');
    bc.onmessage = (ev) => {
      if (ev.data) onUpdate(ev.data);
    };
  }

  let channel: any = null;
  if (isSupabaseConfigured) {
    channel = supabase
      .channel('realtime:driver_locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'driver_locations' },
        (payload: any) => {
          const row = payload.new;
          if (row && row.lat && row.lng) {
            onUpdate({
              driverId: row.driver_id,
              driverName: row.driver_name,
              unitNumber: row.unit_number,
              lat: Number(row.lat),
              lng: Number(row.lng),
              heading: Number(row.heading || 0),
              speedKmh: Number(row.speed_kmh || 0),
              currentStopId: row.current_stop_id,
              currentStopName: row.current_stop_name,
              isActive: row.is_active,
              updatedAt: row.updated_at,
            });
          }
        }
      )
      .subscribe();
  }

  return () => {
    window.removeEventListener('vmi-driver-gps-update', handleLocalEvent);
    window.removeEventListener('storage', handleStorage);
    if (bc) bc.close();
    if (channel) supabase.removeChannel(channel);
  };
}

// 6.2 GUARDAR LIQUIDACIÓN / ARQUEO DE CAJA DEL CHOFER EN SUPABASE
export async function saveRouteSettlement(settlement: RouteSettlement): Promise<boolean> {
  const record: RouteSettlement = {
    ...settlement,
    id: settlement.id || `LIQ-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };

  try {
    const existingRaw = localStorage.getItem(SETTLEMENTS_STORAGE_KEY);
    const list: RouteSettlement[] = existingRaw ? JSON.parse(existingRaw) : [];
    list.unshift(record);
    localStorage.setItem(SETTLEMENTS_STORAGE_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {}

  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await supabase.from('route_settlements').insert({
      driver_id: settlement.driverId,
      driver_name: settlement.driverName,
      route_date: settlement.routeDate,
      total_cash: settlement.totalCash,
      total_transfer: settlement.totalTransfer,
      total_credit: settlement.totalCredit,
      total_returns: settlement.totalReturns,
      net_total: settlement.netTotal,
      stops_completed: settlement.stopsCompleted,
      notes: settlement.notes || null,
    });
    return !error;
  } catch {
    return true;
  }
}

// 7. REALTIME: SUSCRIBIRSE A CAMBIOS EN PRODUCTOS / INVENTARIO
export function subscribeToSupabaseInventory(onUpdate: () => void) {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel('realtime:products')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// 8. REALTIME: SUSCRIBIRSE A CAMBIOS EN PEDIDOS
export function subscribeToSupabaseOrders(onUpdate: () => void) {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel('realtime:orders')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'orders' },
      () => {
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
