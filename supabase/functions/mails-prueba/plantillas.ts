// Los 5 mails automáticos de la prueba gratis de Peineta.
// Variables: nombre (de la dueña/dueño), salon, diasRestantes, clientes, mensajes, link.

export type Datos = { nombre: string; salon: string; clientes: number; mensajes: number; link: string; precio: number };
export type Mail = { asunto: string; html: string };

const APP = "https://peineta.netlify.app/app/";
const pesos = (n: number) => "$" + Number(n || 15000).toLocaleString("es-AR");
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function marco(titulo: string, cuerpo: string, boton: string, link = APP) {
  return `<div style="background:#F6F1EA;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;color:#111111">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:28px 24px">
    <div style="font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:18px">peineta<span style="color:#FF5A3C">.</span></div>
    <h1 style="font-size:21px;line-height:1.3;margin:0 0 14px">${titulo}</h1>
    <div style="font-size:15px;line-height:1.55">${cuerpo}</div>
    <p style="margin:22px 0 6px"><a href="${link}" style="display:inline-block;background:#FF5A3C;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px">${boton}</a></p>
    <p style="font-size:13px;line-height:1.5;color:#7A7068;margin:18px 0 0">¿Te trabaste con algo? Respondé este mail o escribinos por WhatsApp y te ayudamos.</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#9A9088;margin:14px 0 0">Recibís este mail porque creaste una cuenta en Peineta.</p>
</div>`;
}

export const plantillas: Record<number, (d: Datos) => Mail> = {
  // Día 0: bienvenida
  0: (d) => ({
    asunto: `Ya estás en Peineta${d.nombre ? ", " + d.nombre : ""} 👋`,
    html: marco(
      `¡Listo, ${esc(d.nombre) || "ya estás adentro"}! ${esc(d.salon)} ya tiene su Peineta.`,
      `<p style="margin:0 0 12px">Tenés <b>7 días gratis</b> para probar todo, sin tarjeta. Para sacarle el jugo desde hoy, hacé estos 3 pasos (te lleva 10 minutos):</p>
       <ol style="margin:0 0 12px;padding-left:20px">
         <li style="margin-bottom:6px"><b>Revisá tus servicios y precios</b> en Ajustes.</li>
         <li style="margin-bottom:6px"><b>Cargá tus clientes</b>: de a uno o pegando tu lista de contactos.</li>
         <li><b>Agendá los turnos de esta semana.</b></li>
       </ol>
       <p style="margin:0">Un consejo: agregá Peineta a la pantalla de inicio del celular. Queda como una app más.</p>`,
      "Abrir Peineta",
    ),
  }),
  // Día 2: el primer recordatorio
  2: (d) => ({
    asunto: "Mandá tu primer recordatorio por WhatsApp (30 segundos)",
    html: marco(
      "Lo que más usan las peluquerías: el recordatorio con un toque",
      `<p style="margin:0 0 12px">${d.clientes ? `Ya cargaste <b>${d.clientes} clientes</b>. ` : ""}Ahora probá esto:</p>
       <ol style="margin:0 0 12px;padding-left:20px">
         <li style="margin-bottom:6px">Entrá a <b>Hoy</b>.</li>
         <li style="margin-bottom:6px">En <b>"Confirmar turnos de mañana"</b> o <b>"Para escribir hoy"</b>, tocá el botón verde.</li>
         <li>Se abre tu WhatsApp con el mensaje ya escrito. Solo apretás enviar.</li>
       </ol>
       <p style="margin:0">Así tus clientes no se olvidan del turno y los que hace rato no vienen, vuelven.</p>`,
      "Mandar mi primer recordatorio",
    ),
  }),
  // Día 5: quedan 2 días
  5: (d) => ({
    asunto: "Te quedan 2 días de prueba en Peineta",
    html: marco(
      "Te quedan 2 días de prueba",
      `<p style="margin:0 0 12px">En estos días con Peineta${d.clientes ? ` cargaste <b>${d.clientes} clientes</b>` : ""}${d.clientes && d.mensajes ? " y" : ""}${d.mensajes ? ` mandaste <b>${d.mensajes} mensajes</b> por WhatsApp` : ""}${d.clientes || d.mensajes ? "." : " ya tenés todo listo para ordenar tu peluquería."}</p>
       <p style="margin:0 0 12px">Para seguir, el Plan Básico es <b>${pesos(d.precio)} por mes</b>: lo que sale un corte. Se paga con Mercado Pago y cancelás cuando quieras.</p>
       <p style="margin:0">Lo activás desde <b>Ajustes → Mi plan y cuenta → Activar el plan</b>.</p>`,
      "Activar mi plan",
    ),
  }),
  // Día 7: hoy termina
  7: (d) => ({
    asunto: "Hoy termina tu prueba de Peineta",
    html: marco(
      "Hoy termina tu prueba gratis",
      `<p style="margin:0 0 12px">Mañana Peineta se pausa para ${esc(d.salon) || "tu peluquería"}. Tus datos quedan guardados: clientes, turnos, caja y puntos.</p>
       <p style="margin:0">Activá el plan hoy y seguís sin cortar: <b>${pesos(d.precio)} por mes</b> con Mercado Pago, sin permanencia.</p>`,
      "Seguir usando Peineta",
    ),
  }),
  // Día 9: último empujón
  9: (d) => ({
    asunto: "Tus clientes te esperan en Peineta",
    html: marco(
      `${esc(d.nombre) || "Hola"}, tus datos siguen ahí`,
      `<p style="margin:0 0 12px">Guardamos todo lo que cargaste${d.clientes ? `: <b>${d.clientes} clientes</b>, sus turnos y su historial` : ""}. Si activás el plan, retomás exactamente donde lo dejaste.</p>
       <p style="margin:0">Si Peineta no era para vos, nos ayudaría mucho saber por qué: respondé este mail con una línea. Lo leemos todo.</p>`,
      "Volver a Peineta",
    ),
  }),
};
