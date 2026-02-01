import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Esto te ayuda a detectar el clásico “en Cloudflare no cargó env vars”
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en variables de entorno.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
