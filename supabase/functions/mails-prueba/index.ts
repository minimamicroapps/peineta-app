// Manda los mails de la prueba gratis (días 0, 2, 5, 7 y 9 desde el registro).
// Se ejecuta una vez por día (programado). Necesita el secreto RESEND_API_KEY y el dominio verificado en Resend.
// Todavía NO está publicada: se activa cuando esté peineta.com.ar.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { plantillas } from "./plantillas.ts";

const REMITENTE = "Peineta <hola@peineta.com.ar>";
const RESPONDER_A = "minima.microapps@gmail.com";

Deno.serve(async (req) => {
  // solo la tarea programada (con la clave de servicio) puede ejecutarla
  if ((req.headers.get("Authorization") || "") !== "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) return new Response("no", { status: 401 });
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response("falta RESEND_API_KEY", { status: 503 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: lista, error } = await db.rpc("mails_pendientes");
  if (error) return new Response(error.message, { status: 500 });

  let enviados = 0;
  for (const m of lista || []) {
    const mail = plantillas[m.dia]({ nombre: m.nombre, salon: m.salon, clientes: m.clientes, mensajes: m.mensajes, link: "" });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMITENTE, to: m.mail, reply_to: RESPONDER_A, subject: mail.asunto, html: mail.html }),
    });
    if (r.ok) {
      await db.from("mails_enviados").insert({ salon_id: m.salon_id, dia: m.dia });
      enviados++;
    } else console.error("resend", m.mail, r.status, await r.text());
  }
  return new Response(JSON.stringify({ enviados }), { headers: { "Content-Type": "application/json" } });
});
