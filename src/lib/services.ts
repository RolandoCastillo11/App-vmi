import { collection, query, getDocs, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import { isSupabaseConfigured } from './supabase';
import { 
  getSupabaseInventory, 
  getSupabaseCatalog, 
  getSupabaseOrders, 
  placeSupabaseOrder,
  subscribeToSupabaseInventory,
  subscribeToSupabaseOrders,
  getSupabaseShops,
  updateSupabaseOrderStatus,
  updateDriverLiveLocation,
  getDriverLiveLocation,
  subscribeToDriverLocation,
  saveRouteSettlement
} from './supabaseServices';
import type { PodData, DriverLocationState, RouteSettlement } from './supabaseServices';

export interface Product {
  id?: string;
  name: string;
  sku: string;
  stock: number;
  price?: number;
  imageUrl?: string;
  category?: string;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id?: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'in_transit' | 'delivered';
  createdAt: any;
  shopId?: string;
}

const INVENTORY_COLLECTION = 'shopInventory';
const CATALOG_COLLECTION = 'providerCatalog';
const ORDERS_COLLECTION = 'orders';

// Fallback products if both cloud databases are empty or unreachable
export const fallbackInventory: Product[] = [
  { id: 'inv-1', name: 'Coca-Cola 600ml', sku: 'CC-600-MX', stock: 4, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200' },
  { id: 'inv-2', name: 'Barcel Chips Jalapeño', sku: 'BC-JAL-120', stock: 15, imageUrl: 'https://images.unsplash.com/photo-1599599811450-2bcdd86fd596?auto=format&fit=crop&q=80&w=200' },
  { id: 'inv-3', name: 'Agua Ciel 1L', sku: 'CIEL-1L', stock: 42, imageUrl: 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200' }
];

export const fallbackCatalog: Product[] = [
  { id: 'cat-1', name: 'Coca-Cola 600ml (Caja 24)', sku: 'CC-600-X24', stock: 100, price: 480, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat-2', name: 'Sabritas Sal 45g (Caja 30)', sku: 'SAB-SAL-X30', stock: 50, price: 360, imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat-3', name: 'Leche Alpura 1L (Caja 12)', sku: 'ALP-1L-X12', stock: 80, price: 240, imageUrl: 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200' },
  { id: 'cat-4', name: 'Pan Bimbo Blanco', sku: 'BIM-BLA-10', stock: 60, price: 45, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200' }
];

export async function getInventory(): Promise<Product[]> {
  if (isSupabaseConfigured) {
    const data = await getSupabaseInventory();
    if (data && data.length > 0) return data;
  }

  try {
    const q = query(collection(db, INVENTORY_COLLECTION));
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    return results.length > 0 ? results : fallbackInventory;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, INVENTORY_COLLECTION);
    return fallbackInventory;
  }
}

export async function getCatalog(): Promise<Product[]> {
  if (isSupabaseConfigured) {
    const data = await getSupabaseCatalog();
    if (data && data.length > 0) return data;
  }

  try {
    const q = query(collection(db, CATALOG_COLLECTION));
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
    return results.length > 0 ? results : fallbackCatalog;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, CATALOG_COLLECTION);
    return fallbackCatalog;
  }
}

export async function getOrders(): Promise<Order[]> {
  if (isSupabaseConfigured) {
    const data = await getSupabaseOrders();
    if (data && data.length > 0) return data;
  }

  try {
    const q = query(collection(db, ORDERS_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ORDERS_COLLECTION);
    return [];
  }
}

export async function placeOrder(items: OrderItem[], total: number, shopId: string = 'shp-1'): Promise<string> {
  if (isSupabaseConfigured) {
    const orderId = await placeSupabaseOrder(items, total, shopId);
    if (orderId) return orderId;
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const orderRef = doc(collection(db, ORDERS_COLLECTION));
      
      for (const item of items) {
        const productRef = doc(db, CATALOG_COLLECTION, item.id);
        const productDoc = await transaction.get(productRef);
        
        if (productDoc.exists()) {
          const currentStock = productDoc.data().stock || 0;
          transaction.update(productRef, {
            stock: Math.max(0, currentStock - item.quantity)
          });
        }
      }
      
      const orderData = {
        items,
        total,
        status: 'pending',
        createdAt: serverTimestamp(),
      };
      
      transaction.set(orderRef, orderData);
      return orderRef.id;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ORDERS_COLLECTION);
    return `ORD-LOCAL-${Date.now().toString().slice(-4)}`;
  }
}

// Re-export Realtime and Utility Helpers
export { 
  subscribeToSupabaseInventory, 
  subscribeToSupabaseOrders,
  getSupabaseShops,
  updateSupabaseOrderStatus,
  updateDriverLiveLocation,
  getDriverLiveLocation,
  subscribeToDriverLocation,
  saveRouteSettlement
};
export type { PodData, DriverLocationState, RouteSettlement };
