// Cosas compartidas por las funciones de cobro de Peineta.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

export const URL_SB = Deno.env.get("SUPABASE_URL")!;
export const admin = () => createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Token de Mercado Pago: se carga como secreto en Supabase (MP_ACCESS_TOKEN). Nunca en el código.
export const mpToken = () => Deno.env.get("MP_ACCESS_TOKEN") || "";

export async function mp(path: string, init: RequestInit = {}) {
  const r = await fetch("https://api.mercadopago.com" + path, {
    ...init,
    headers: { Authorization: "Bearer " + mpToken(), "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

// Usuario que llama (con su sesión de la app)
export async function usuario(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const sb = createClient(URL_SB, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await sb.auth.getUser();
  return data.user;
}

// Días de gracia después de la fecha de cobro, por si Mercado Pago reintenta.
export const GRACIA_DIAS = 3;
