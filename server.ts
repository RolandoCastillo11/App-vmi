import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Initialize Gemini AI
  const genAI = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY || "",
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  // Location type for the optimization algorithm
  interface Location {
    id: string;
    lat: number;
    lng: number;
    name: string;
    address?: string;
  }

  // Algorithm: Nearest Neighbor (Simple TSP solver)
  function optimizeRoute(start: Location, destinations: Location[]): Location[] {
    const route: Location[] = [start];
    const unvisited = [...destinations];
    let current = start;

    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = Math.sqrt(
          Math.pow(current.lat - unvisited[i].lat, 2) +
          Math.pow(current.lng - unvisited[i].lng, 2)
        );
        if (d < minDistance) {
          minDistance = d;
          nearestIndex = i;
        }
      }

      current = unvisited.splice(nearestIndex, 1)[0];
      route.push(current);
    }

    return route;
  }

  app.post("/api/optimize-route", (req, res) => {
    const { start, destinations } = req.body;
    if (!start || !destinations || !Array.isArray(destinations)) {
      return res.status(400).json({ error: "Invalid data. Need 'start' location and 'destinations' array." });
    }

    const optimized = optimizeRoute(start, destinations);
    res.json({ route: optimized });
  });

  app.post("/api/ai-insight", async (req, res) => {
    try {
      const { orders } = req.body;
      if (!orders || !Array.isArray(orders)) {
        return res.json({ suggestion: null });
      }

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY") {
        return res.json({ suggestion: null });
      }

      // Prepare a concise context of past orders for Gemini
      const orderContext = orders.map(o => ({
        date: o.createdAt,
        items: o.items.map((i: any) => `${i.name} (Qty: ${i.quantity})`).join(", ")
      })).slice(0, 10); // Last 10 orders for context

      const prompt = `Analiza el historial de pedidos de esta tienda de abarrotes:
${JSON.stringify(orderContext, null, 2)}

Tu tarea es detectar si algún producto importante (especialmente refrescos de 2L, leche, pan, etc.) no ha sido pedido recientemente pero suele comprarse con frecuencia. 
Si detectas una posible falta de stock basada en el tiempo transcurrido desde el último pedido de ese item, genera una sugerencia amigable y corta en español.

Ejemplo: "Detectamos que te quedan pocos refrescos de 2L, ¿deseas agregarlos a tu carrito?"

Responde ÚNICAMENTE con la frase de sugerencia, o "null" si no encuentras una tendencia clara. No des explicaciones.`;

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const suggestion = result.text.trim();
      res.json({ suggestion: suggestion === "null" ? null : suggestion });
    } catch (error) {
      console.error("AI Insight Error:", error);
      res.json({ suggestion: null });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
