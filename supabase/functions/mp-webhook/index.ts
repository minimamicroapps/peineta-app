// Avisos de Mercado Pago. Nunca confía en lo que llega: con el id consulta el estado real en la API.
import { admin, GRACIA_DIAS, json, mp, mpToken } from "../_shared/comun.ts";

async function firmaValida(req: Request, dataId: string) {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return true; // sin clave cargada todavía (modo prueba)
  const sig = req.headers.get("x-signature") || "";
  const reqId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${reqId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === parts.v1;
}

// Pone el salón según el estado real de su suscripción
async function sincronizarSuscripcion(db: ReturnType<typeof admin>, preId: string) {
  const r = await mp("/preapproval/" + preId);
  if (!r.ok) return "preapproval_no_encontrada";
  const p = r.data;
  const salonId = p.external_reference;
  if (!salonId) return "sin_external_reference";
  const { data: salon } = await db.from("salones").select("id, estado, plan_hasta").eq("id", salonId).single();
  if (!salon) return "salon_no_encontrado";

  const cambios: Record<string, unknown> = { mp_preapproval_id: p.id, mp_estado: p.status };
  if (p.status === "authorized") {
    cambios.estado = "activo";
    if (p.next_payment_date) {
      const hasta = new Date(p.next_payment_date);
      hasta.setDate(hasta.getDate() + GRACIA_DIAS);
      // nunca acorta lo que ya pagó
      if (!salon.plan_hasta || new Date(salon.plan_hasta) < hasta) cambios.plan_hasta = hasta.toISOString();
    }
  } else if (p.status === "cancelled" || p.status === "paused") {
    // sigue usando hasta el fin de lo pagado; después la app lo bloquea sola
    if (salon.estado === "activo" && (!salon.plan_hasta || new Date(salon.plan_hasta) < new Date())) cambios.estado = "vencido";
  }
  await db.from("salones").update(cambios).eq("id", salon.id);
  return "salon " + salon.id + " → " + p.status;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const tipo: string = body.type || body.topic || url.searchParams.get("type") || url.searchParams.get("topic") || "";
  const id: string = String(body?.data?.id || url.searchParams.get("data.id") || url.searchParams.get("id") || "");
  const db = admin();

  if (!id) return json({ ok: true });
  if (!(await firmaValida(req, id))) {
    await db.from("mp_eventos").insert({ tipo, recurso_id: id, resultado: "firma_invalida" });
    return json({ error: "firma" }, 401);
  }
  if (!mpToken()) return json({ error: "cobro_no_configurado" }, 503);

  let resultado = "ignorado";
  try {
    if (tipo === "subscription_preapproval" || tipo === "preapproval") {
      resultado = await sincronizarSuscripcion(db, id);
    } else if (tipo === "subscription_authorized_payment" || tipo === "authorized_payment") {
      const r = await mp("/authorized_payments/" + id);
      if (r.ok) {
        const a = r.data;
        const estado = a.payment?.status || a.status;
        const { data: s } = await db.from("salones").select("id").eq("mp_preapproval_id", a.preapproval_id).maybeSingle();
        const salonId = s?.id || a.external_reference;
        if (salonId) {
          await db.from("pagos").upsert({
            salon_id: salonId, mp_pago_id: String(a.id), mp_preapproval_id: a.preapproval_id,
            monto: a.transaction_amount, estado, fecha: a.date_created || new Date().toISOString(),
            detalle: { pago: a.payment?.id, motivo: a.payment?.status_detail, intento: a.retry_attempt },
          }, { onConflict: "mp_pago_id" });
        }
        resultado = "pago " + a.id + " " + estado + " · " + (a.preapproval_id ? await sincronizarSuscripcion(db, a.preapproval_id) : "");
      } else resultado = "pago_no_encontrado";
    }
  } catch (e) {
    resultado = "error: " + (e as Error).message;
    console.error(e);
  }
  await db.from("mp_eventos").insert({ tipo, recurso_id: id, resultado, detalle: body });
  return json({ ok: true });
});
