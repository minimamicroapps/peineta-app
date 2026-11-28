// Manda los mails de la prueba gratis (días 0, 2, 5, 7 y 9 desde el registro).
// Se ejecuta una vez por día (programado). Necesita el secreto RESEND_API_KEY y el dominio verificado en Resend.
// La dispara pg_cron todos los días a las 10:05 (Argentina) con una clave interna.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { plantillas } from "./plantillas.ts";

const REMITENTE = "Juan de Peineta <hola@peineta.com.ar>";
const RESPONDER_A = "minima.microapps@gmail.com";

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  // solo la tarea programada (con su clave interna) puede ejecutarla
  const { data: ok } = await db.rpc("clave_cron_valida", { p: req.headers.get("x-cron-clave") || "" });
  if (!ok) return new Response("no", { status: 401 });
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response("falta RESEND_API_KEY", { status: 503 });
  const body = await req.json().catch(() => ({}));
  // modo prueba: manda los 5 mails de ejemplo a una casilla, sin registrar nada
  if (body.prueba) {
    const resultados = [];
    for (const dia of [0, 2, 5, 7, 9]) {
      const { data: conf } = await db.from("config").select("valor").eq("clave", "precio").maybeSingle();
      const m = plantillas[dia]({ nombre: "Ana", salon: "Estilo Ana", clientes: 48, mensajes: 12, link: "", precio: Number(conf?.valor?.mensual || 15000) });
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
        body: JSON.stringify({ from: REMITENTE, to: body.prueba, reply_to: RESPONDER_A, subject: m.asunto, html: m.html, text: m.texto }),
      });
      resultados.push({ dia, status: r.status, detalle: await r.text() });
    }
    return new Response(JSON.stringify(resultados), { headers: { "Content-Type": "application/json" } });
  }

  const { data: lista, error } = await db.rpc("mails_pendientes");
  if (error) return new Response(error.message, { status: 500 });

  const { data: conf } = await db.from("config").select("valor").eq("clave", "precio").maybeSingle();
  const precio = Number(conf?.valor?.mensual || 15000);
  let enviados = 0;
  for (const m of lista || []) {
    const mail = plantillas[m.dia]({ nombre: m.nombre, salon: m.salon, clientes: m.clientes, mensajes: m.mensajes, link: "", precio });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: REMITENTE, to: m.mail, reply_to: RESPONDER_A, subject: mail.asunto, html: mail.html, text: mail.texto }),
    });
    if (r.ok) {
      await db.from("mails_enviados").insert({ salon_id: m.salon_id, dia: m.dia });
      enviados++;
    } else console.error("resend", m.mail, r.status, await r.text());
  }
  return new Response(JSON.stringify({ enviados }), { headers: { "Content-Type": "application/json" } });
});
