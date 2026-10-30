import { useState, useEffect } from 'react';
import { ShoppingCart, Search, Plus, Minus, Check, ArrowLeft, Package, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getCatalog, placeOrder, Product, OrderItem, subscribeToSupabaseInventory } from '../lib/services';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface CartItem extends OrderItem {
  imageUrl?: string;
}

export default function CatalogScreen() {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderStatus, setOrderStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  useEffect(() => {
    loadCatalog();
    const unsubscribe = subscribeToSupabaseInventory(() => {
      loadCatalog();
    });
    return () => unsubscribe();
  }, []);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const data = await getCatalog();
      if (data.length === 0) {
        await seedCatalog();
        const retryData = await getCatalog();
        setCatalog(retryData.length > 0 ? retryData : getFallbackCatalog());
      } else {
        setCatalog(data);
      }
    } catch (error) {
      console.warn("Could not retrieve Firestore catalog, using fallback:", error);
      setCatalog(getFallbackCatalog());
    } finally {
      setLoading(false);
    }
  };

  const getFallbackCatalog = (): Product[] => [
    { id: 'cat-1', name: 'Coca-Cola 600ml (Caja 24)', sku: 'CC-600-X24', stock: 100, price: 480, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200' },
    { id: 'cat-2', name: 'Sabritas Sal 45g (Caja 30)', sku: 'SAB-SAL-X30', stock: 50, price: 360, imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=200' },
    { id: 'cat-3', name: 'Leche Alpura 1L (Caja 12)', sku: 'ALP-1L-X12', stock: 80, price: 240, imageUrl: 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200' },
    { id: 'cat-4', name: 'Pan Bimbo Blanco', sku: 'BIM-BLA-10', stock: 60, price: 45, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200' }
  ];

  const seedCatalog = async () => {
    const catalogItems = [
      { name: 'Coca-Cola 600ml (Caja 24)', sku: 'CC-600-X24', stock: 100, price: 480, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200' },
      { name: 'Sabritas Sal 45g (Caja 30)', sku: 'SAB-SAL-X30', stock: 50, price: 360, imageUrl: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&q=80&w=200' },
      { name: 'Leche Alpura 1L (Caja 12)', sku: 'ALP-1L-X12', stock: 80, price: 240, imageUrl: 'https://images.unsplash.com/photo-1550505393-5c47113e54a4?auto=format&fit=crop&q=80&w=200' },
      { name: 'Pan Bimbo Blanco', sku: 'BIM-BLA-10', stock: 60, price: 45, imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200' }
    ];
    for (const item of catalogItems) {
      await addDoc(collection(db, 'providerCatalog'), item);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: product.id!, name: product.name, quantity: 1, price: product.price || 0, imageUrl: product.imageUrl }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSendOrder = async () => {
    if (cart.length === 0) return;
    setOrderStatus('sending');
    const orderId = await placeOrder(cart.map(({id, name, quantity, price}) => ({id, name, quantity, price})), cartTotal);
    if (orderId) {
      setOrderStatus('success');
      setCart([]);
      setTimeout(() => setOrderStatus('idle'), 3000);
    } else {
      setOrderStatus('idle');
    }
  };

  const filteredCatalog = catalog.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans pb-40">
      <header className="sticky top-0 z-20 bg-bg-main/90 backdrop-blur-md border-b border-border-subtle pt-6 pb-3 px-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-text-main uppercase tracking-wider">Catálogo Proveedor</h1>
            <div className="relative">
              <ShoppingCart className="text-text-main w-6 h-6" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 role-primary-bg text-[var(--color-text-light)] text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 text-text-muted w-4 h-4" />
            <input 
              type="text" 
              placeholder="Buscar productos en catálogo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-surface-card border border-border-subtle rounded-xl py-3 pl-10 pr-4 text-sm text-text-main placeholder:text-text-muted focus:ring-1 focus:ring-[var(--color-role-primary)] outline-none transition-all"
            />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-role-primary)]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredCatalog.map((product) => (
              <div key={product.id} className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden flex flex-col soft-shadow">
                <div className="flex items-center p-4 gap-4">
                  <div className="w-20 h-20 bg-bg-main rounded-xl border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <Package className="text-text-muted w-8 h-8" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-text-main mb-1">{product.name}</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2 font-mono">{product.sku}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--color-role-primary)] font-bold text-base">${product.price?.toFixed(2)}</span>
                      <button 
                        onClick={() => addToCart(product)}
                        className="bg-[var(--color-role-primary)]/10 hover:bg-[var(--color-role-primary)] text-[var(--color-role-primary)] hover:text-[var(--color-text-light)] p-2.5 rounded-xl transition-all border border-[var(--color-role-primary)]/20 soft-shadow"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Summary Drawer-like Overlay */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-0 right-0 z-40 px-4 max-w-md mx-auto"
          >
            <div className="bg-surface-card rounded-2xl border border-[var(--color-role-primary)]/20 soft-shadow p-5 backdrop-blur-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-text-main uppercase tracking-wider">Tu Carrito</h3>
                <button onClick={() => setCart([])} className="text-text-muted hover:text-danger transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="max-h-40 overflow-y-auto no-scrollbar space-y-3 mb-4">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-text-main font-medium truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => updateQuantity(item.id!, -1)} className="p-1 hover:bg-bg-main rounded text-text-muted"><Minus className="w-3 h-3" /></button>
                      <span className="font-bold text-[var(--color-role-primary)] w-4 text-center">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id!, 1)} className="p-1 hover:bg-bg-main rounded text-text-muted"><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="text-text-muted font-mono w-16 text-right">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-text-muted font-bold uppercase">Total del Pedido</span>
                  <span className="text-xl font-bold text-text-main font-display">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  onClick={handleSendOrder}
                  disabled={orderStatus === 'sending'}
                  className="w-full role-primary-bg hover:brightness-110 text-[var(--color-text-light)] font-bold py-4 rounded-xl flex items-center justify-center gap-2 soft-shadow transition-all active:scale-95 disabled:opacity-50"
                >
                  {orderStatus === 'sending' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[var(--color-text-light)]"></div>
                  ) : orderStatus === 'success' ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>¡Pedido Enviado!</span>
                    </>
                  ) : (
                    <span>Confirmar Pedido</span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      {orderStatus === 'success' && (
        <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center bg-black/75 backdrop-blur-md p-6">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-surface-card p-8 rounded-3xl border border-border-subtle text-center flex flex-col items-center gap-4 soft-shadow"
          >
            <div className="w-16 h-16 bg-bg-main rounded-full flex items-center justify-center text-[var(--color-role-primary)] mb-2">
              <Check className="w-10 h-10 stroke-[3px]" />
            </div>
            <h2 className="text-xl font-bold text-text-main">Pedido Registrado</h2>
            <p className="text-sm text-text-muted">Tu compra se ha guardado como 'Pendiente'. El proveedor procesará tu reabastecimiento en breve.</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}
