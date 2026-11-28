// Los 5 mails automáticos de la prueba gratis de Peineta.
// Escritos como un mail de persona a persona (texto simple, sin diseño de newsletter)
// para que Gmail los deje en Principal y no en Promociones. Cada uno tiene versión HTML y texto plano.

export type Datos = { nombre: string; salon: string; clientes: number; mensajes: number; link: string; precio: number };
export type Mail = { asunto: string; html: string; texto: string };

const APP = "https://peineta.com.ar/app/";
const pesos = (n: number) => "$" + Number(n || 15000).toLocaleString("es-AR");
const esc = (s: string) => String(s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const hola = (d: Datos) => (d.nombre ? `Hola ${d.nombre},` : "Hola,");
const FIRMA = "Juan\nPeineta";

// párrafos en texto plano → mail simple (sin colores, sin botones, tipografía del cliente de correo)
function armar(asunto: string, parrafos: string[], linkTexto: string): Mail {
  const texto = parrafos.join("\n\n").replace("{LINK}", APP) + "\n\n" + FIRMA;
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#222">` +
    parrafos
      .map((p) => `<p style="margin:0 0 14px">${esc(p).replace("{LINK}", `<a href="${APP}">${linkTexto}</a>`).replace(/\n/g, "<br>")}</p>`)
      .join("") +
    `<p style="margin:0">Juan<br>Peineta</p></div>`;
  return { asunto, html, texto };
}

export const plantillas: Record<number, (d: Datos) => Mail> = {
  // Día 0: bienvenida
  0: (d) =>
    armar(`${d.nombre ? d.nombre + ", " : ""}ya podés usar Peineta`, [
      hola(d),
      `Gracias por crear tu cuenta${d.salon ? " para " + d.salon : ""}. Soy Juan, uno de los que hace Peineta.`,
      "Para arrancar, lo mejor es revisar tus servicios en Ajustes, cargar algunos clientes y agendar los turnos de esta semana. Te lleva unos 10 minutos.",
      "Entrás desde acá: {LINK}",
      "Si te trabás con algo o tenés una duda, respondé este mail y te ayudo.",
    ], "peineta.com.ar/app"),

  // Día 2: el primer recordatorio
  2: (d) =>
    armar("¿Probaste mandar un recordatorio?", [
      hola(d),
      `${d.clientes ? `Vi que ya cargaste ${d.clientes} clientes. ` : ""}Lo que más usan las peluquerías es el recordatorio por WhatsApp:`,
      "1. Entrá a Hoy.\n2. En \"Confirmar turnos de mañana\" o \"Para escribir hoy\", tocá el botón verde.\n3. Se abre tu WhatsApp con el mensaje ya escrito. Solo apretás enviar.",
      "Así nadie se olvida del turno y los que hace rato no vienen, vuelven. Probalo hoy: {LINK}",
      "Cualquier cosa, respondé este mail.",
    ], "abrir Peineta"),

  // Día 5: quedan 2 días
  5: (d) =>
    armar("¿Cómo te está yendo con Peineta?", [
      hola(d),
      `Te escribo porque en 2 días termina tu prueba de Peineta${d.clientes || d.mensajes ? ". Hasta ahora " : "."}${d.clientes ? `cargaste ${d.clientes} clientes` : ""}${d.clientes && d.mensajes ? " y " : ""}${d.mensajes ? `mandaste ${d.mensajes} mensajes por WhatsApp` : ""}${d.clientes || d.mensajes ? "." : ""}`,
      `Si te está sirviendo y querés seguir usándola, lo dejás listo en Ajustes, en "Mi plan y cuenta": {LINK}`,
      "¿Te faltó algo o hay algo que no te cerró? Contame respondiendo este mail, me sirve mucho saberlo.",
    ], "peineta.com.ar/app"),

  // Día 7: hoy termina
  7: (d) =>
    armar("Hoy termina tu prueba", [
      hola(d),
      `Hoy es el último día de tu prueba${d.salon ? " para " + d.salon : ""}. Tus clientes, turnos, caja y puntos quedan guardados.`,
      `Para seguir usándola sin cortar, activá el plan desde Ajustes (${pesos(d.precio)} por mes, sin permanencia): {LINK}`,
      "Si tenés alguna duda antes de decidir, respondé este mail.",
    ], "peineta.com.ar/app"),

  // Día 9: último mensaje
  9: (d) =>
    armar("¿Qué te pareció Peineta?", [
      hola(d),
      `Tu prueba terminó, pero todo lo que cargaste sigue guardado${d.clientes ? `: tus ${d.clientes} clientes, sus turnos y su historial` : ""}. Si activás el plan, seguís exactamente donde lo dejaste: {LINK}`,
      "Si Peineta no era para vos, ¿me contás por qué? Respondé este mail con una línea. Lo leo todo y me ayuda a mejorarla.",
    ], "peineta.com.ar/app"),
};
