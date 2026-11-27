// "Activar plan": crea la suscripción mensual en Mercado Pago y devuelve el link de pago.
import { admin, cors, json, mp, mpToken, usuario } from "../_shared/comun.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!mpToken()) return json({ error: "cobro_no_configurado" }, 503);

  const user = await usuario(req);
  if (!user) return json({ error: "sin_sesion" }, 401);

  const db = admin();
  const { data: salon, error } = await db.from("salones").select("id, nombre, mp_preapproval_id, mp_estado").eq("owner_id", user.id).single();
  if (error || !salon) return json({ error: "sin_salon" }, 404);
  if (salon.mp_estado === "authorized") return json({ error: "ya_activo" }, 409);

  const precio = Number(Deno.env.get("PRECIO_MENSUAL") || 15000);
  const appUrl = Deno.env.get("APP_URL") || "https://peineta.netlify.app/app/";
  // En modo prueba, Mercado Pago exige que quien paga sea un usuario de prueba.
  const payer = Deno.env.get("MP_PAYER_PRUEBA") || user.email;

  const r = await mp("/preapproval", {
    method: "POST",
    headers: { "X-Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({
      reason: "Peineta · Plan Básico mensual",
      external_reference: salon.id,
      payer_email: payer,
      back_url: appUrl + "?suscripcion=ok",
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: precio, currency_id: "ARS" },
      status: "pending",
    }),
  });
  if (!r.ok || !r.data.init_point) {
    console.error("mp-suscribir", r.status, JSON.stringify(r.data));
    return json({ error: "mp", detalle: r.data.message || "No se pudo crear la suscripción" }, 502);
  }
  await db.from("salones").update({ mp_preapproval_id: r.data.id, mp_estado: r.data.status }).eq("id", salon.id);
  return json({ url: r.data.init_point });
});
