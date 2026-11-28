// Cuando alguien usa el Botón de arrepentimiento o de baja:
// 1) le confirma por mail el pedido con su código (la norma pide confirmarlo dentro de las 24 h)
// 2) le avisa a Peineta para atenderlo.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const REMITENTE = "Peineta <hola@peineta.com.ar>";
const AVISO_A = "minima.microapps@gmail.com";
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

async function enviar(key: string, to: string, subject: string, texto: string) {
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">${texto.split("\n\n").map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, to, reply_to: AVISO_A, subject, html, text: texto }),
  });
  return r.status;
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: ok } = await db.rpc("clave_cron_valida", { p: req.headers.get("x-cron-clave") || "" });
  if (!ok) return new Response("no", { status: 401 });
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return new Response("falta RESEND_API_KEY", { status: 503 });
  const { id } = await req.json().catch(() => ({}));
  const { data: s } = await db.from("solicitudes_consumidor").select("*").eq("id", id).maybeSingle();
  if (!s) return new Response("no existe", { status: 404 });

  const que = s.tipo === "baja" ? "baja del servicio" : "arrepentimiento (revocación de la contratación)";
  const fecha = new Date(s.creado).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
  const res: Record<string, number> = {};
  if (s.email) {
    res.cliente = await enviar(key, s.email, `Recibimos tu pedido de ${s.tipo === "baja" ? "baja" : "arrepentimiento"} · ${s.codigo}`,
      `Hola ${s.nombre || ""},\n\nRecibimos tu pedido de ${que} en Peineta el ${fecha}.\n\nTu código de trámite es: ${s.codigo}\n\nNo se te van a hacer más cobros por este servicio. Si corresponde una devolución, la hacemos por el mismo medio de pago. Te escribimos si necesitamos algún dato más.\n\nCualquier consulta, respondé este mail.\n\nPeineta\nAtención: lunes a viernes de 9 a 17 h`);
  }
  res.peineta = await enviar(key, AVISO_A, `⚠️ Nuevo pedido de ${s.tipo.toUpperCase()} · ${s.codigo}`,
    `Entró un pedido de ${que}.\n\nCódigo: ${s.codigo}\nFecha: ${fecha}\nNombre: ${s.nombre || "-"}\nMail: ${s.email || "-"}\nWhatsApp: ${s.whatsapp || "-"}\nCuenta: ${s.cuenta || "-"}\nDetalle: ${s.detalle || "-"}\n\nHay que atenderlo: cancelar la suscripción en Mercado Pago (y devolver lo cobrado si es arrepentimiento dentro de los 10 días) y marcarlo como atendido en el panel.`);
  return new Response(JSON.stringify(res), { headers: { "Content-Type": "application/json" } });
});
