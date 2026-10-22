# VMI Retail México 📦🚚

Gestión inteligente de inventario VMI (Vendor Managed Inventory) y optimización de rutas de reparto para tiendas y choferes de abarrotes.

---

## 🚀 Inicio Rápido

### 1. Variables de Entorno
El archivo [.env](file:///.env) ya fue inicializado. Si deseas habilitar la IA de sugerencias automáticas de pedidos con Gemini:
1. Agrega tu clave en `GEMINI_API_KEY="tu_clave_aqui"`.

### 2. Ejecución en Desarrollo
Inicia el servidor backend Express junto con Vite:
```bash
npm run dev
```
La aplicación estará disponible en: **http://localhost:3000**

### 3. Compilación para Producción
```bash
npm run build
npm start
```

---

## 🛠️ Tecnologías y Estructura

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Leaflet / React-Leaflet
- **Backend:** Node.js, Express, tsx, Google GenAI SDK (`@google/genai`)
- **Base de Datos / Autenticación:** Firebase Firestore & Firebase Auth

### 📂 Estructura del Proyecto
- [server.ts](file:///server.ts): Servidor Express con middleware de Vite, endpoints de optimización de rutas y motor de IA Gemini.
- [src/App.tsx](file:///src/App.tsx): Orquestador principal de vistas y navegación según rol de usuario.
- [src/screens/](file:///src/screens/):
  - `LoginScreen.tsx`: Selección de perfiles (Tienda / Chofer) y autenticación.
  - `DashboardScreen.tsx`: Resumen de stock, alertas y métricas VMI.
  - `CatalogScreen.tsx`: Catálogo de pedidos de proveedor.
  - `InventoryScreen.tsx`: Gestión de existencias y almacén local.
  - `OrderScreen.tsx`: Historial de pedidos y tracking.
  - `RouteScreen.tsx`: Vista satelital / mapa de ruta optimizada para repartidores con Leaflet.
- [src/lib/](file:///src/lib/): Configuración y servicios de Firebase y Firestore.
