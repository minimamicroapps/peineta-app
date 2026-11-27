// "Cancelar suscripción": la cancela en Mercado Pago. La cuenta sigue activa hasta el fin del mes pagado.
import { admin, cors, json, mp, mpToken, usuario } from "../_shared/comun.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!mpToken()) return json({ error: "cobro_no_configurado" }, 503);
  const user = await usuario(req);
  if (!user) return json({ error: "sin_sesion" }, 401);

  const db = admin();
  const { data: salon } = await db.from("salones").select("id, mp_preapproval_id, plan_hasta").eq("owner_id", user.id).single();
  if (!salon?.mp_preapproval_id) return json({ error: "sin_suscripcion" }, 404);

  const r = await mp("/preapproval/" + salon.mp_preapproval_id, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });
  if (!r.ok) {
    console.error("mp-cancelar", r.status, JSON.stringify(r.data));
    return json({ error: "mp", detalle: r.data.message || "No se pudo cancelar" }, 502);
  }
  await db.from("salones").update({ mp_estado: "cancelled" }).eq("id", salon.id);
  return json({ ok: true, hasta: salon.plan_hasta });
});
