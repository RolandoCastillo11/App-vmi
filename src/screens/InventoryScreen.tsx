import { useState, useEffect } from 'react';
import { Search, QrCode, TrendingUp, AlertTriangle, Truck, Package, PlusCircle, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { getInventory, Product } from '../lib/services';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const data = await getInventory();
      if (data.length === 0) {
        // Seed initial data if empty
        await seedInitialData();
        const retryData = await getInventory();
        setProducts(retryData.length > 0 ? retryData : getFallbackInventory());
      } else {
        setProducts(data);
      }
    } catch (error) {
      console.warn("Could not retrieve Firestore inventory, using fallback:", error);
      setProducts(getFallbackInventory());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackInventory = (): Product[] => [
    { id: 'item-1', name: 'Coca-Cola 600ml', sku: 'CC-600-MX', stock: 4, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200' },
    { id: 'item-2', name: 'Barcel Chips Jalapeño', sku: 'BC-JAL-120', stock: 15, imageUrl: 'https://images.unsplash.com/photo-1599599811450-2bcdd86fd596?auto=format&fit=crop&q=80&w=200' },
    { id: 'item-3', name: 'Agua Ciel 1L', sku: 'CIEL-1L', stock: 42, imageUrl: 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200' }
  ];

  const seedInitialData = async () => {
    const initialItems = [
      { name: 'Coca-Cola 600ml', sku: 'CC-600-MX', stock: 4, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200' },
      { name: 'Barcel Chips Jalapeño', sku: 'BC-JAL-120', stock: 15, imageUrl: 'https://images.unsplash.com/photo-1599599811450-2bcdd86fd596?auto=format&fit=crop&q=80&w=200' },
      { name: 'Agua Ciel 1L', sku: 'CIEL-1L', stock: 42, imageUrl: 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200' }
    ];
    for (const item of initialItems) {
      await addDoc(collection(db, 'shopInventory'), item);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans">
      <header className="sticky top-0 z-20 bg-bg-main/90 backdrop-blur-md border-b border-border-subtle pt-6 pb-3 px-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-text-main uppercase tracking-wider">Mi Inventario</h1>
            <button className="relative p-2 rounded-full hover:bg-surface-hover transition-colors">
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--color-role-primary)] ring-2 ring-bg-main"></span>
              <Bell className="text-text-main w-5 h-5" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 text-text-muted w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar SKU, producto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl py-3 pl-10 pr-10 text-sm text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-[var(--color-role-primary)] outline-none transition-all"
            />
            <button className="absolute right-2 top-2 p-1 text-text-muted hover:text-[var(--color-role-primary)] transition-colors">
              <QrCode className="w-5 h-5" />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] text-xs font-bold whitespace-nowrap soft-shadow">
              Todos
            </button>
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-card border border-border-subtle text-text-muted text-xs font-bold whitespace-nowrap transition-colors">
              <span className="w-1.5 h-1.5 rounded-full bg-danger"></span> Crítico
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-role-primary)]"></div>
          </div>
        ) : (
          <>
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-bold text-text-main uppercase tracking-wider border-l-4 border-[var(--color-role-primary)] pl-2">Productos</h2>
                <span className="text-[10px] text-text-muted uppercase font-bold">{filteredProducts.length} items</span>
              </div>
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <motion.div 
                    layout
                    key={product.id}
                    className="bg-surface-card rounded-2xl border border-border-subtle p-4 flex gap-4 items-center soft-shadow"
                  >
                    <div className="w-14 h-14 bg-bg-main rounded-xl border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Package className="text-text-muted w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="text-sm font-bold text-text-main truncate pr-2">{product.name}</h3>
                        {product.stock <= 5 && (
                          <span className="bg-red-50 text-danger text-[9px] font-bold px-2 py-0.5 rounded-lg border border-red-100 uppercase tracking-widest shrink-0">Bajo Stock</span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted mt-0.5 font-mono">SKU: {product.sku}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[10px] font-bold flex items-center gap-1 ${product.stock <= 5 ? 'text-danger' : 'text-[var(--color-role-primary)]'}`}>
                          {product.stock} Unidades
                        </span>
                        <div className="flex-1 h-1.5 bg-bg-main rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${product.stock <= 5 ? 'bg-danger' : 'bg-[var(--color-role-primary)]'}`}
                            style={{ width: `${Math.min((product.stock / 50) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      <div className="fixed bottom-24 right-5 z-30 flex flex-col gap-3">
        <button className="w-14 h-14 bg-surface-card text-[var(--color-role-primary)] rounded-full border border-border-subtle soft-shadow flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
          <PlusCircle className="w-6 h-6" />
        </button>
        <button className="w-14 h-14 bg-[var(--color-role-primary)] text-[var(--color-text-light)] rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all">
          <QrCode className="w-6 h-6 stroke-[2.5px]" />
        </button>
      </div>
    </div>
  );
}

