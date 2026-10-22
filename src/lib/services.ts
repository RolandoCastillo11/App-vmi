import { collection, query, getDocs, addDoc, serverTimestamp, updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreUtils';

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

export async function getInventory(): Promise<Product[]> {
  try {
    const q = query(collection(db, INVENTORY_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, INVENTORY_COLLECTION);
    return [];
  }
}

export async function getCatalog(): Promise<Product[]> {
  try {
    const q = query(collection(db, CATALOG_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, CATALOG_COLLECTION);
    return [];
  }
}

export async function getOrders(): Promise<Order[]> {
  try {
    const q = query(collection(db, ORDERS_COLLECTION));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, ORDERS_COLLECTION);
    return [];
  }
}

export async function placeOrder(items: OrderItem[], total: number): Promise<string> {
  try {
    return await runTransaction(db, async (transaction) => {
      // 1. Prepare order document reference
      const orderRef = doc(collection(db, ORDERS_COLLECTION));
      
      // 2. Validate and update stocks in catalog
      for (const item of items) {
        const productRef = doc(db, CATALOG_COLLECTION, item.id);
        const productDoc = await transaction.get(productRef);
        
        if (!productDoc.exists()) {
          throw new Error(`Producto ${item.name} no encontrado en catálogo`);
        }
        
        const currentStock = productDoc.data().stock || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Stock insuficiente para ${item.name}`);
        }
        
        transaction.update(productRef, {
          stock: currentStock - item.quantity
        });
      }
      
      // 3. Create the order
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
    return '';
  }
}
