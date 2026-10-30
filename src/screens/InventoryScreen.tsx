import { useState, useEffect } from 'react';
import { Search, QrCode, TrendingUp, AlertTriangle, Truck, Package, PlusCircle, Bell } from 'lucide-react';
import { motion } from 'motion/react';
import { getInventory, Product, subscribeToSupabaseInventory } from '../lib/services';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import VmiForecastingChart from '../components/VmiForecastingChart';
import { cn } from '../lib/utils';

export default function InventoryScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [filterCriticalOnly, setFilterCriticalOnly] = useState(false);

  useEffect(() => {
    loadInventory();
    const unsubscribe = subscribeToSupabaseInventory(() => {
      loadInventory();
    });
    return () => unsubscribe();
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

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    if (filterCriticalOnly) {
      return matchesSearch && p.stock <= 5;
    }
    return matchesSearch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans pb-28">
      <header className="sticky top-0 z-20 bg-bg-main/90 backdrop-blur-md border-b border-border-subtle pt-6 pb-3 px-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-bold text-text-main uppercase tracking-wider">Inventario en Tienda</h1>
              <p className="text-[10px] text-text-muted">Abarrotes Don Lupe • Gestión VMI</p>
            </div>
            <button 
              onClick={() => setIsScannerOpen(true)}
              type="button"
              className="px-3 py-1.5 rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] text-[11px] font-bold flex items-center gap-1.5 shadow hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <QrCode size={14} />
              <span>Escanear Código</span>
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 text-text-muted w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar por SKU, producto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl py-2.5 pl-9 pr-10 text-xs text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-[var(--color-role-primary)] outline-none transition-all"
            />
            <button 
              onClick={() => setIsScannerOpen(true)}
              type="button"
              className="absolute right-2 top-2 p-1 text-text-muted hover:text-[var(--color-role-primary)] transition-colors cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-2 pb-0.5">
            <button 
              onClick={() => setFilterCriticalOnly(false)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer",
                !filterCriticalOnly
                  ? "bg-[var(--color-role-primary)] text-[var(--color-text-light)] soft-shadow"
                  : "bg-surface-card border border-border-subtle text-text-muted"
              )}
            >
              Todos ({products.length})
            </button>
            <button 
              onClick={() => setFilterCriticalOnly(true)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer",
                filterCriticalOnly
                  ? "bg-danger text-white soft-shadow"
                  : "bg-surface-card border border-border-subtle text-text-muted"
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-danger"></span> 
              <span>Crítico ({products.filter(p => p.stock <= 5).length})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-4">
        {/* Curva interactiva de proyección de demanda VMI */}
        <VmiForecastingChart 
          productName="Coca-Cola 600ml"
          currentStock={products.find(p => p.sku.includes('CC'))?.stock || 4}
          dailyConsumption={2.5}
          reorderPoint={6}
        />
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
        <button 
          onClick={() => setIsScannerOpen(true)}
          className="w-14 h-14 bg-[var(--color-role-primary)] text-[var(--color-text-light)] rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer"
        >
          <QrCode className="w-6 h-6 stroke-[2.5px]" />
        </button>
      </div>

      {/* Modal de Escáner de Código de Barras / QR con Cámara */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onProductUpdated={() => loadInventory()}
      />
    </div>
  );
}

