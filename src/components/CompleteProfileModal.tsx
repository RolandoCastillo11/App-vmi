import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, User, Phone, MapPin, Sparkles, CheckCircle2, ShieldCheck, X } from 'lucide-react';

export interface ShopProfileData {
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  email: string;
}

interface CompleteProfileModalProps {
  isOpen: boolean;
  googleUser: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  } | null;
  onSaveProfile: (profile: ShopProfileData) => void;
  onClose?: () => void;
}

export default function CompleteProfileModal({
  isOpen,
  googleUser,
  onSaveProfile,
  onClose,
}: CompleteProfileModalProps) {
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState(googleUser?.name || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Actualizar ownerName si cambia googleUser
  React.useEffect(() => {
    if (googleUser?.name && !ownerName) {
      setOwnerName(googleUser.name);
    }
  }, [googleUser]);

  if (!isOpen || !googleUser) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim()) {
      setErrorMessage('Por favor ingresa el nombre de tu tienda.');
      return;
    }
    if (!ownerName.trim()) {
      setErrorMessage('Ingresa el nombre del encargado o propietario.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Ingresa tu teléfono celular o WhatsApp.');
      return;
    }
    if (!address.trim()) {
      setErrorMessage('Ingresa la dirección de entrega de tu tienda.');
      return;
    }

    const completed: ShopProfileData = {
      shopName: shopName.trim(),
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      email: googleUser.email,
    };

    onSaveProfile(completed);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-orange-200 overflow-hidden text-gray-800"
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-orange-100 bg-orange-50/60 relative">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-orange-100/60 transition-colors cursor-pointer"
                title="Cancelar y salir"
              >
                <X size={18} />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
                <Store size={22} />
              </div>
              <div className="pr-6">
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 font-mono">
                  Primer Inicio con Google
                </span>
                <h3 className="text-base font-bold text-gray-900 leading-tight">
                  Completa el perfil de tu Tienda
                </h3>
              </div>
            </div>

            {/* Tarjeta de cuenta Google vinculada */}
            <div className="mt-3.5 p-2.5 rounded-xl bg-white border border-orange-100 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2 truncate">
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {googleUser.email.charAt(0).toUpperCase()}
                </div>
                <div className="truncate text-left">
                  <span className="text-xs font-bold text-gray-800 block truncate">{googleUser.email}</span>
                  <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-0.5">
                    <CheckCircle2 size={10} /> Cuenta verificada con Google
                  </span>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
            <p className="text-xs text-gray-500 leading-relaxed">
              Solo necesitas completar estos datos una vez para asociar tus pedidos y ruta de entrega con Almacenes Ibarra:
            </p>

            {/* Nombre de la Tienda */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Store size={12} className="text-orange-500" />
                <span>Nombre de la Tienda / Abarrotes *</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="Ej. Abarrotes La Esperanza"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500 bg-gray-50/50"
              />
            </div>

            {/* Nombre del Propietario */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                <User size={12} className="text-orange-500" />
                <span>Nombre del Propietario o Encargado *</span>
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Ej. Rolando Castillo"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500 bg-gray-50/50"
              />
            </div>

            {/* Teléfono WhatsApp */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                <Phone size={12} className="text-orange-500" />
                <span>Teléfono Celular / WhatsApp *</span>
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 833 123 4567"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500 bg-gray-50/50"
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                <MapPin size={12} className="text-orange-500" />
                <span>Dirección de Entrega (Tampico / Madero / Altamira) *</span>
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ej. Calle Hidalgo #405, Zona Centro"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-gray-300 focus:outline-none focus:border-orange-500 bg-gray-50/50"
              />
            </div>

            {errorMessage && (
              <p className="text-xs text-red-600 font-bold bg-red-50 p-2 rounded-lg text-center">
                {errorMessage}
              </p>
            )}

            <button
              type="submit"
              className="w-full mt-2 py-3.5 bg-orange-500 hover:bg-orange-600 active:scale-[0.99] text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Sparkles size={15} />
              <span>Guardar Perfil y Entrar a la App</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-semibold transition-colors cursor-pointer text-center"
              >
                Cancelar y no registrarme ahora
              </button>
            )}

            <p className="text-[10px] text-gray-400 text-center">
              En tus próximas visitas con Google ingresarás automáticamente sin tener que volver a llenar esto.
            </p>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
