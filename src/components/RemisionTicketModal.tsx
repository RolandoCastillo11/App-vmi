import React, { useState } from 'react';
import {
  X,
  Printer,
  Share2,
  CheckCircle2,
  QrCode,
  FileText,
  Bluetooth,
  Receipt,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, PodData } from '../lib/services';

interface RemisionTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  shopName?: string;
  driverName?: string;
  podData?: PodData;
}

export default function RemisionTicketModal({
  isOpen,
  onClose,
  order,
  shopName = 'Abarrotes Don Lupe',
  driverName = 'Chofer #402 - Logística Altamira',
  podData,
}: RemisionTicketModalProps) {
  const [ticketFormat, setTicketFormat] = useState<'standard' | 'thermal80'>('standard');
  const [btStatus, setBtStatus] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const returnDiscount = podData?.returnAmount || 0;
  const netTotal = Math.max(0, order.total - returnDiscount);
  const paymentLabel =
    podData?.paymentMethod === 'transfer'
      ? 'Transferencia SPEI / CoDi'
      : podData?.paymentMethod === 'credit'
        ? 'Crédito Preventa VMI'
        : 'Efectivo Contra Entrega';

  const handlePrint = () => {
    window.print();
  };

  const handleBluetoothThermalPrint = async () => {
    setBtStatus(null);
    const nav = navigator as any;
    if (nav.bluetooth) {
      try {
        setBtStatus('Buscando impresora térmica Bluetooth (58mm/80mm)...');
        const device = await nav.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
        });
        setBtStatus(`Conectado a ${device.name || 'Impresora Térmica'}. Enviando ticket ESC/POS...`);
        setTimeout(() => {
          window.print();
        }, 600);
      } catch {
        setTicketFormat('thermal80');
        setBtStatus('Modo rollo térmico 80mm activado. Abriendo cola de impresión...');
        setTimeout(() => window.print(), 400);
      }
    } else {
      setTicketFormat('thermal80');
      setBtStatus('Formato rollo térmico 80mm listo para imprimir.');
      setTimeout(() => window.print(), 300);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `*ALMACENES IBARRA - REMISIÓN DE DESPACHO*\n` +
        `Folio: ${order.id}\n` +
        `Tienda: ${shopName}\n` +
        `Subtotal: $${order.total.toFixed(2)} MXN\n` +
        (returnDiscount > 0 ? `Merma/Devolución: -$${returnDiscount.toFixed(2)} MXN\n` : '') +
        `*Total Liquidado: $${netTotal.toFixed(2)} MXN*\n` +
        `Método de Pago: ${paymentLabel}\n` +
        `Estado: ${order.status.toUpperCase()}\n` +
        `Chofer: ${driverName}\n` +
        `Gracias por su preferencia en la Red VMI Preventa Inteligente.`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/75 backdrop-blur-md print:p-0 print:bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`w-full ${
            ticketFormat === 'thermal80' ? 'max-w-xs' : 'max-w-lg'
          } bg-surface-card rounded-3xl border border-border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-w-none print:shadow-none print:border-none print:rounded-none transition-all`}
        >
          {/* Header Controls (Oculto al imprimir) */}
          <div className="p-3.5 border-b border-border-subtle flex justify-between items-center bg-bg-main/50 print:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] flex items-center justify-center font-bold">
                <FileText size={18} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-bold text-text-main">Remisión de Entrega</h3>
                <p className="text-[10px] text-text-muted">{order.id} • CEDIS Altamira</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTicketFormat(ticketFormat === 'standard' ? 'thermal80' : 'standard')}
                className="px-2.5 py-1 rounded-lg bg-surface-card border border-border-subtle text-[10px] font-bold text-text-main flex items-center gap-1 cursor-pointer hover:bg-surface-hover"
                title="Cambiar entre formato Carta y Rollo Térmico 80mm"
              >
                <Receipt size={12} className="text-[var(--color-role-primary)]" />
                <span>{ticketFormat === 'thermal80' ? 'Térmico 80mm' : 'Nota Estándar'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {btStatus && (
            <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-medium flex items-center gap-2 print:hidden">
              <Bluetooth size={13} className="animate-pulse shrink-0" />
              <span>{btStatus}</span>
            </div>
          )}

          {/* Ticket Body (Visible y optimizado para imprimir) */}
          <div className="p-5 overflow-y-auto space-y-4 bg-white text-gray-900 font-sans print:p-4 print:text-black text-left">
            {/* Header del Ticket */}
            <div className="text-center border-b border-gray-200 pb-3">
              <h2 className="text-sm font-black tracking-tight text-gray-900 uppercase">
                ALMACENES IBARRA S.A. DE C.V.
              </h2>
              <p className="text-[10px] text-gray-500 font-medium">CEDIS ALTAMIRA • CARRETERA TAMPICO-MANTE KM 11</p>
              <p className="text-[10px] text-gray-500">R.F.C.: AIB-840212-9A1 • TELS: (833) 260-1000</p>

              <div className="inline-block mt-2.5 px-3 py-1 bg-gray-100 rounded-full border border-gray-300">
                <span className="text-[10px] font-mono font-bold text-gray-800">
                  REMISIÓN VMI: {order.id}
                </span>
              </div>
            </div>

            {/* Metadatos de la Entrega */}
            <div className="grid grid-cols-2 gap-3 text-[11px] bg-gray-50 p-3 rounded-xl border border-gray-200">
              <div>
                <span className="text-gray-500 font-bold block text-[9px] uppercase">Cliente / Destino:</span>
                <strong className="text-gray-900">{shopName}</strong>
                <p className="text-gray-600 text-[10px]">Tampico / Cd. Madero, Tamps.</p>
              </div>
              <div className="text-right">
                <span className="text-gray-500 font-bold block text-[9px] uppercase">Unidad y Chofer:</span>
                <strong className="text-gray-900">{driverName}</strong>
                <p className="text-gray-600 text-[10px]">
                  {new Date().toLocaleDateString('es-MX')}{' '}
                  {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            {/* Tabla de Artículos */}
            <div>
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-300 text-[10px] text-gray-500 uppercase tracking-wider">
                    <th className="py-1.5">Cant</th>
                    <th className="py-1.5">Descripción</th>
                    <th className="py-1.5 text-right">P. Unit</th>
                    <th className="py-1.5 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-[11px]">
                  {(order.items || []).map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-bold">{item.quantity}</td>
                      <td className="py-2 text-gray-800">{item.name}</td>
                      <td className="py-2 text-right text-gray-600">${item.price.toFixed(2)}</td>
                      <td className="py-2 text-right font-bold text-gray-900">
                        ${(item.quantity * item.price).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Desglose de Merma si aplica */}
            {returnDiscount > 0 && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex justify-between items-center text-[11px] text-rose-800">
                <div>
                  <strong className="block">Ajuste por Logística Inversa ({podData?.returnItemsCount || 1} pza)</strong>
                  <span className="text-[10px]">{podData?.returnReason || 'Devolución en entrega'}</span>
                </div>
                <span className="font-bold font-mono">-${returnDiscount.toFixed(2)}</span>
              </div>
            )}

            {/* Totales */}
            <div className="border-t-2 border-gray-300 pt-3 flex justify-between items-end">
              <div className="text-[10px] text-gray-500 space-y-0.5">
                <p>
                  Método de Pago: <strong className="text-gray-800">{paymentLabel}</strong>
                </p>
                {podData?.paymentReference && (
                  <p>
                    Referencia: <strong className="font-mono">{podData.paymentReference}</strong>
                  </p>
                )}
                <p>Moneda: MXN (Pesos Mexicanos)</p>
                <p className="text-emerald-700 font-bold flex items-center gap-1 pt-0.5">
                  <CheckCircle2 size={11} /> Entrega verificada en ruta DVRP
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-500 font-bold block">TOTAL LIQUIDADO</span>
                <span className="text-xl font-black text-gray-900">${netTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Código QR y Firma */}
            <div className="pt-3 border-t border-dashed border-gray-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-14 h-14 bg-gray-900 p-1 rounded-lg flex items-center justify-center shrink-0">
                  <QrCode size={48} className="text-white" />
                </div>
                <div className="text-[9px] text-gray-500 max-w-[125px] leading-tight">
                  <strong className="text-gray-800 block">Sello Digital VMI</strong>
                  Trazabilidad certificada CEDIS Altamira.
                </div>
              </div>

              {/* Sello de Firma Real si existe */}
              <div className="text-center w-36">
                <div className="h-12 border-b border-gray-400 flex items-center justify-center overflow-hidden">
                  {podData?.signatureUrl ? (
                    <img src={podData.signatureUrl} alt="Firma POD" className="max-h-11 object-contain" />
                  ) : (
                    <span className="text-[10px] font-script text-gray-600 italic">
                      {podData?.receiverName || 'D. Lupe Reyes'}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-gray-500 uppercase font-bold block mt-1">
                  {podData?.receiverName || 'Firma del Receptor'}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions (Oculto al imprimir) */}
          <div className="p-3.5 border-t border-border-subtle bg-bg-main/50 flex gap-2 print:hidden">
            <button
              onClick={handleShareWhatsApp}
              type="button"
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <Share2 size={14} />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleBluetoothThermalPrint}
              type="button"
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <Bluetooth size={14} />
              <span>Térmica BT</span>
            </button>
            <button
              onClick={handlePrint}
              type="button"
              className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer size={14} />
              <span>PDF</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
