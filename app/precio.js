/* Precio de Peineta: un solo lugar.
   El valor real está en Supabase (tabla config, clave "precio") y Juan lo cambia desde su panel.
   Este archivo lo trae y lo pinta en todos los elementos marcados:
   data-precio → "$15.000" · data-lanzamiento → se muestra solo si el precio de lanzamiento está activo
   data-cupos / data-meses → cupos y meses del precio de lanzamiento */
(function () {
  window.PRECIO = { mensual: 15000, lanzamiento: { activo: true, cupos: 50, meses: 6 } }; // por si no hay conexión
  const fmt = (n) => '$' + Number(n).toLocaleString('es-AR');
  window.precioTxt = () => fmt(window.PRECIO.mensual);
  function pintar() {
    const P = window.PRECIO, L = P.lanzamiento || {};
    document.querySelectorAll('[data-precio]').forEach((e) => (e.textContent = fmt(P.mensual)));
    document.querySelectorAll('[data-lanzamiento]').forEach((e) => (e.hidden = !L.activo));
    document.querySelectorAll('[data-cupos]').forEach((e) => (e.textContent = L.cupos));
    document.querySelectorAll('[data-meses]').forEach((e) => (e.textContent = L.meses));
  }
  fetch('https://hiejcxcvwgailprvxmtt.supabase.co/rest/v1/config?clave=eq.precio&select=valor', {
    headers: { apikey: 'sb_publishable_7sCjiK7hc-RceSskMVUPkA_ydagCYbp' },
  })
    .then((r) => r.json())
    .then((d) => {
      if (d && d[0] && d[0].valor && d[0].valor.mensual) window.PRECIO = d[0].valor;
      pintar();
      document.dispatchEvent(new Event('precio'));
    })
    .catch(pintar);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pintar);
  else pintar();
})();
