import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, CheckCircle2, ChevronRight, Package, AlertCircle, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { Order, getOrders, subscribeToSupabaseOrders } from '../lib/services';
import RemisionTicketModal from '../components/RemisionTicketModal';

export default function OrderScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderForTicket, setSelectedOrderForTicket] = useState<Order | null>(null);

  useEffect(() => {
    loadOrders();
    const unsubscribe = subscribeToSupabaseOrders(() => {
      loadOrders();
    });
    return () => unsubscribe();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getOrders();
      setOrders(data);
    } catch (error) {
      console.warn("Could not load orders, showing sample orders:", error);
      setOrders([
        {
          id: 'ORD-MX-9821',
          items: [
            { id: '1', name: 'Coca-Cola 600ml (Caja 24)', quantity: 2, price: 480 },
            { id: '2', name: 'Sabritas Sal 45g (Caja 30)', quantity: 1, price: 360 }
          ],
          total: 1320,
          status: 'confirmed',
          createdAt: new Date().toISOString()
        },
        {
          id: 'ORD-MX-7734',
          items: [
            { id: '3', name: 'Leche Alpura 1L (Caja 12)', quantity: 3, price: 240 }
          ],
          total: 720,
          status: 'delivered',
          createdAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-amber-600 bg-amber-500/10 border-amber-500/30';
      case 'confirmed': return 'text-[var(--color-role-primary)] bg-[var(--color-role-primary)]/10 border-[var(--color-role-primary)]/30';
      case 'delivered': return 'text-[var(--color-role-primary-dark)] bg-[var(--color-role-primary)]/20 border-[var(--color-role-primary)]/40';
      default: return 'text-text-muted bg-surface-hover border-border-subtle';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'confirmed': return 'Confirmado';
      case 'delivered': return 'Entregado';
      default: return status;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg-main font-sans pb-24">
      <header className="sticky top-0 z-50 bg-bg-main/90 backdrop-blur-md border-b border-border-subtle pt-6 pb-4 px-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-text-main uppercase tracking-wider">Historial de Pedidos</h1>
          <button onClick={loadOrders} className="p-2 rounded-full hover:bg-surface-hover transition-colors text-[var(--color-role-primary)]">
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-role-primary)]"></div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <Package size={48} className="mb-4 text-text-muted" />
            <p className="text-sm font-medium">No hay pedidos registrados aún.</p>
            <p className="text-xs mt-1">Tus compras al proveedor aparecerán aquí.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={order.id}
                className="bg-surface-card rounded-2xl border border-border-subtle overflow-hidden relative soft-shadow"
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono">ID: {order.id?.slice(-8).toUpperCase()}</span>
                      <h3 className="text-sm font-bold text-text-main mt-0.5">
                        {order.items.length} {order.items.length === 1 ? 'Producto' : 'Productos'}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="space-y-1 mb-4">
                    {order.items.slice(0, 2).map((item, idx) => (
                      <p key={idx} className="text-xs text-text-muted truncate">
                        • {item.quantity}x {item.name}
                      </p>
                    ))}
                    {order.items.length > 2 && (
                      <p className="text-[10px] text-text-muted italic">Y {order.items.length - 2} más...</p>
                    )}
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-border-subtle">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-text-muted uppercase font-bold tracking-tighter">Total</span>
                      <span className="text-lg font-bold text-text-main font-mono">${order.total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setSelectedOrderForTicket(order)}
                        type="button"
                        className="px-2.5 py-1 rounded-lg bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] hover:bg-[var(--color-role-primary)] hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <FileText size={11} />
                        <span>Remisión</span>
                      </button>
                      <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted uppercase tracking-wider hover:text-text-main cursor-pointer">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {order.status === 'pending' && (
                  <div className="absolute top-0 right-0 h-1.5 w-24 bg-amber-500/40 shadow-sm"></div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Modal de Remisión Digital / Ticket con QR */}
        <RemisionTicketModal
          isOpen={Boolean(selectedOrderForTicket)}
          onClose={() => setSelectedOrderForTicket(null)}
          order={selectedOrderForTicket}
          shopName="Abarrotes Don Lupe (Zona Centro Tampico)"
          driverName="Chofer #402 - Logística CEDIS Altamira"
        />

        <section className="bg-surface-card rounded-2xl p-5 border border-dashed border-border-subtle flex items-start gap-4">
          <AlertCircle className="text-[var(--color-role-primary)] shrink-0 w-5 h-5 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-text-main uppercase tracking-wider mb-1">Información</h4>
            <p className="text-[10px] text-text-muted leading-relaxed">
              Los pedidos realizados antes de las 16:00 hrs se procesan el mismo día. Sujetos a disponibilidad en almacén central.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

