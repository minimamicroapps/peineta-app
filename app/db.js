/* Peineta · capa de datos (Supabase)
   La interfaz trabaja sobre el estado S (igual que el prototipo).
   Este archivo carga S desde la base, y cada vez que la app llama a save()
   compara S con lo último guardado y manda solo los cambios. */
(function () {
  const SUPABASE_URL = 'https://hiejcxcvwgailprvxmtt.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_7sCjiK7hc-RceSskMVUPkA_ydagCYbp'; // clave pública (la seguridad está en las reglas RLS)
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  window.uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16) }));
  const isUuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const num = v => (v === null || v === undefined || v === '') ? 0 : +v;
  const hhmm = t => (t || '').slice(0, 5);

  /* ---------- traducción entre la app y la base ---------- */
  const M = {
    services: {
      table: 'servicios',
      toRow: x => ({ id: x.id, nombre: (x.name || 'Servicio').slice(0, 80), precio: num(x.price), duracion_min: Math.min(600, Math.max(5, num(x.dur) || 30)), ciclo_dias: Math.min(365, Math.max(0, num(x.cycle))), genero: ['m', 'h', 'u'].includes(x.g) ? x.g : 'u', puntos_suma: Math.max(0, Math.round(num(x.pts))), puntos_canje: Math.max(0, Math.round(num(x.cost))), orden: num(x.ord), oculto: !!x.off }),
      fromRow: r => ({ id: r.id, name: r.nombre, price: +r.precio, dur: r.duracion_min, cycle: r.ciclo_dias, g: r.genero, pts: r.puntos_suma, cost: r.puntos_canje, ord: r.orden, off: r.oculto || undefined })
    },
    products: {
      table: 'productos',
      toRow: x => ({ id: x.id, nombre: (x.name || 'Producto').slice(0, 80), precio: num(x.price), costo_compra: num(x.buy), stock: Math.round(num(x.stock)), foto_url: x.photo || null, puntos_suma: Math.max(0, Math.round(num(x.pts))), puntos_canje: Math.max(0, Math.round(num(x.cost))), oculto: !!x.off }),
      fromRow: r => ({ id: r.id, name: r.nombre, price: +r.precio, buy: +r.costo_compra, stock: r.stock, photo: r.foto_url, pts: r.puntos_suma, cost: r.puntos_canje, off: r.oculto || undefined })
    },
    clients: {
      table: 'clientes',
      toRow: x => ({ id: x.id, nombre: (x.name || 'Cliente').slice(0, 100), genero: ['m', 'h'].includes(x.g) ? x.g : null, telefono: (x.phone || '').slice(0, 30) || null, cumple: /^\d{2}-\d{2}$/.test(x.bday || '') ? x.bday : null, origen: (x.origin || '').slice(0, 60) || null, formula: (x.formula || '').slice(0, 1000) || null, notas: (x.notes || '').slice(0, 2000) || null, token: x.token, oculto: !!x.off }),
      fromRow: r => ({ id: r.id, name: r.nombre, g: r.genero, phone: r.telefono || '', bday: r.cumple || '', origin: r.origen || '', formula: r.formula || '', notes: r.notas || '', token: r.token, photos: [], off: r.oculto || undefined })
    },
    appts: {
      table: 'turnos',
      toRow: x => ({ id: x.id, cliente_id: x.clientId, fecha: x.date, hora: x.time, servicio_ids: (x.services || []).filter(isUuid), estado: x.status || 'a confirmar', serie: isUuid(x.rec) ? x.rec : null }),
      fromRow: r => ({ id: r.id, clientId: r.cliente_id, date: r.fecha, time: hhmm(r.hora), services: r.servicio_ids || [], status: r.estado, rec: r.serie })
    },
    visits: {
      table: 'visitas',
      toRow: x => ({ id: x.id, cliente_id: isUuid(x.clientId) ? x.clientId : null, fecha: x.date, total: Math.max(0, num(x.total)), medio_pago: (x.pay || 'Efectivo').slice(0, 30), propina: Math.max(0, num(x.tip)), nota: (x.note || '').slice(0, 500) || null, canje: !!x.redeemed, puntos_ganados: Math.round(num(x.pts)), puntos_usados: Math.round(num(x.ptsUsed)) }),
      fromRow: r => ({ id: r.id, clientId: r.cliente_id || '_m', date: r.fecha, total: +r.total, pay: r.medio_pago, tip: +r.propina, note: r.nota || '', redeemed: r.canje || undefined, pts: r.puntos_ganados, ptsUsed: r.puntos_usados || undefined, services: [], products: [] })
    },
    points: {
      table: 'movimientos_puntos',
      toRow: x => ({ id: x.id, cliente_id: x.clientId, fecha: x.date, puntos: Math.round(num(x.pts)), descripcion: (x.desc || '').slice(0, 200) }),
      fromRow: r => ({ id: r.id, clientId: r.cliente_id, date: r.fecha, pts: r.puntos, desc: r.descripcion || '' })
    },
    expenses: {
      table: 'gastos',
      toRow: x => ({ id: x.id, fecha: x.date, monto: Math.max(0.01, num(x.amount)), categoria: (x.cat || '').slice(0, 40) || null, nota: (x.note || '').slice(0, 300) || null }),
      fromRow: r => ({ id: r.id, date: r.fecha, amount: +r.monto, cat: r.categoria || '', note: r.nota || '' })
    }
  };
  // Orden para guardar (primero lo que otros referencian) y para borrar (al revés)
  const ORDER = ['services', 'products', 'clients', 'appts', 'visits', 'points', 'expenses'];

  const itemsOf = v => {
    const out = [];
    (v.services || []).forEach(id => { const x = S.services.find(s => s.id === id); out.push({ visita_id: v.id, tipo: 'servicio', servicio_id: isUuid(id) ? id : null, nombre: (x ? x.name : 'Servicio').slice(0, 80), cantidad: 1, precio: v.redeemed ? 0 : num(x && x.price), costo: 0 }) });
    (v.products || []).forEach(p => { const x = S.products.find(s => s.id === p.id); out.push({ visita_id: v.id, tipo: 'producto', producto_id: isUuid(p.id) ? p.id : null, nombre: (x ? x.name : 'Producto').slice(0, 80), cantidad: Math.max(1, num(p.qty)), precio: num(p.price), costo: num(p.buy) }) });
    return out;
  };

  const settingsRow = () => {
    const st = S.settings;
    return {
      nombre: (st.salon || 'Mi peluquería').slice(0, 80), dueno: (st.owner || '').slice(0, 80) || null, tipo: ['m', 'h', 'u'].includes(st.type) ? st.type : 'u',
      telefono: (st.phone || '').slice(0, 30) || null, color: /^#[0-9a-f]{6}$/i.test(st.brand || '') ? st.brand : '#FF5A3C', logo_url: st.logo || null,
      resena_url: (st.review || '').slice(0, 500) || null, puntos_cada: num(st.earnPer) || 100, valor_punto: num(st.ptValue), horario: st.hours,
      plantillas: st.tpl, onboarding_ok: !!S.onboarded, extra: { sent: S.sent || {}, blocked: st.blocked || [] }
    };
  };

  /* ---------- estado de sincronización ---------- */
  let SNAP = {}, SNAP_SETTINGS = '', SNAP_CLOSE = {}, SALON = null, timer = null, busy = false, again = false, failing = false;
  const snapOf = () => {
    const o = {};
    ORDER.forEach(k => { o[k] = {}; (S[k] || []).forEach(x => { o[k][x.id] = JSON.stringify(M[k].toRow(x)) + (k === 'visits' ? JSON.stringify(itemsOf(x)) : '') }) });
    return o;
  };
  const cacheKey = () => SALON ? 'peineta-cache-' + SALON.id : null;
  const writeCache = () => { try { const k = cacheKey(); if (!k) return; const { form, ...rest } = S; localStorage.setItem(k, JSON.stringify(rest)) } catch (e) { } };

  function setBadge(state) {
    let b = document.getElementById('syncb');
    if (!b) { b = document.createElement('div'); b.id = 'syncb'; b.style.cssText = 'position:fixed;top:8px;right:10px;z-index:80;font:600 11px DM Sans,sans-serif;padding:4px 9px;border-radius:99px;pointer-events:none;transition:opacity .3s'; document.body.appendChild(b) }
    if (state === 'ok') { b.style.opacity = '0'; return }
    b.style.opacity = '.95';
    if (state === 'saving') { b.textContent = 'Guardando…'; b.style.background = '#2B2326'; b.style.color = '#fff' }
    if (state === 'error') { b.textContent = 'Sin conexión · se guarda al volver'; b.style.background = '#B3261E'; b.style.color = '#fff' }
  }

  async function flush() {
    if (!SALON || !S.authed) return;
    if (busy) { again = true; return }
    busy = true; again = false; setBadge('saving');
    try {
      // Ajustes del salón
      const sr = settingsRow(), srJ = JSON.stringify(sr);
      if (srJ !== SNAP_SETTINGS) { const { error } = await sb.from('salones').update(sr).eq('id', SALON.id); if (error) throw error; SNAP_SETTINGS = srJ }
      const now = snapOf();
      // altas y cambios
      for (const k of ORDER) {
        const ch = (S[k] || []).filter(x => now[k][x.id] !== SNAP[k][x.id]);
        if (!ch.length) continue;
        const rows = ch.map(x => ({ ...M[k].toRow(x), salon_id: SALON.id }));
        const { error } = await sb.from(M[k].table).upsert(rows, { onConflict: 'id' });
        if (error) throw error;
        if (k === 'visits') {
          const ids = ch.map(x => x.id);
          const del = await sb.from('visita_items').delete().in('visita_id', ids); if (del.error) throw del.error;
          const items = ch.flatMap(itemsOf).map(r => ({ ...r, salon_id: SALON.id }));
          if (items.length) { const ins = await sb.from('visita_items').insert(items); if (ins.error) throw ins.error }
        }
        ch.forEach(x => SNAP[k][x.id] = now[k][x.id]);
      }
      // bajas
      for (const k of [...ORDER].reverse()) {
        const gone = Object.keys(SNAP[k]).filter(id => !now[k][id]);
        if (!gone.length) continue;
        const { error } = await sb.from(M[k].table).delete().in('id', gone);
        if (error) throw error;
        gone.forEach(id => delete SNAP[k][id]);
      }
      // cierres de caja
      for (const [fecha, c] of Object.entries(S.closings || {})) {
        const j = JSON.stringify(c); if (SNAP_CLOSE[fecha] === j) continue;
        const { error } = await sb.from('cierres_caja').upsert({ salon_id: SALON.id, fecha, hora: c.time || '00:00', contado: num(c.counted), esperado: num(c.expected), total: num(c.total) }, { onConflict: 'salon_id,fecha' });
        if (error) throw error; SNAP_CLOSE[fecha] = j;
      }
      failing = false; setBadge('ok'); writeCache();
    } catch (e) {
      console.error('Peineta: no se pudo guardar', e); failing = true; setBadge('error'); writeCache();
      clearTimeout(timer); timer = setTimeout(flush, 8000);
    } finally { busy = false; if (again) schedule() }
  }
  function schedule() { writeCache(); clearTimeout(timer); timer = setTimeout(flush, 600) }
  window.addEventListener('online', () => flush());
  window.addEventListener('beforeunload', e => { if (failing || busy || timer) { flush() } });

  /* ---------- carga ---------- */
  async function all(table) {
    let out = [], from = 0;
    for (;;) { const { data, error } = await sb.from(table).select('*').range(from, from + 999); if (error) throw error; out = out.concat(data); if (data.length < 1000) break; from += 1000 }
    return out;
  }
  async function loadAll(user) {
    const { data: salon, error } = await sb.from('salones').select('*').single();
    if (error) throw error;
    SALON = salon;
    const [sv, pr, cl, tu, vi, it, mp, ga, ci] = await Promise.all(['servicios', 'productos', 'clientes', 'turnos', 'visitas', 'visita_items', 'movimientos_puntos', 'gastos', 'cierres_caja'].map(all));
    const st = fresh();
    S = { ...st, ...{ authed: true, onboarded: !!salon.onboarding_ok, tab: 'hoy', booting: false } };
    const ex = salon.extra || {};
    S.sent = ex.sent || {};
    S.settings = {
      ...st.settings, type: salon.tipo, salon: salon.nombre || '', owner: salon.dueno || '', email: user.email, brand: salon.color, logo: salon.logo_url,
      earnPer: +salon.puntos_cada, ptValue: +salon.valor_punto, phone: salon.telefono || '', review: salon.resena_url || '',
      hours: { ...st.settings.hours, ...(salon.horario && salon.horario.days ? salon.horario : {}) }, blocked: ex.blocked || [],
      tpl: { ...tplFor(salon.tipo === 'h' ? 'h' : 'm'), ...(salon.plantillas || {}) }
    };
    S.services = sv.sort((a, b) => a.orden - b.orden).map(M.services.fromRow);
    S.products = pr.map(M.products.fromRow);
    S.clients = cl.map(M.clients.fromRow);
    S.appts = tu.map(M.appts.fromRow);
    const byVisit = {}; it.forEach(r => (byVisit[r.visita_id] = byVisit[r.visita_id] || []).push(r));
    S.visits = vi.map(r => { const v = M.visits.fromRow(r); (byVisit[r.id] || []).forEach(x => { if (x.tipo === 'servicio') v.services.push(x.servicio_id || x.nombre); else v.products.push({ id: x.producto_id || x.nombre, qty: x.cantidad, price: +x.precio, buy: +x.costo }) }); return v });
    S.points = mp.map(M.points.fromRow);
    S.expenses = ga.map(M.expenses.fromRow);
    S.closings = {}; ci.forEach(r => S.closings[r.fecha] = { time: hhmm(r.hora), counted: +r.contado, expected: +r.esperado, total: +r.total });
    SNAP = snapOf(); SNAP_SETTINGS = JSON.stringify(settingsRow()); SNAP_CLOSE = {}; Object.entries(S.closings).forEach(([f, c]) => SNAP_CLOSE[f] = JSON.stringify(c));
    writeCache();
  }

  /* ---------- plan y prueba ---------- */
  const daysLeft = () => SALON ? Math.ceil((new Date(SALON.prueba_hasta) - new Date()) / 864e5) : 0;
  window.planBlocked = () => !!SALON && ((SALON.estado === 'prueba' && daysLeft() <= 0) || SALON.estado === 'vencido' || SALON.estado === 'cancelado');
  window.planShort = () => !SALON ? '' : SALON.estado === 'activo' ? 'Plan Básico · activo' : SALON.estado === 'prueba' ? `Prueba gratis · ${Math.max(0, daysLeft())} ${daysLeft() === 1 ? 'día' : 'días'}` : 'Plan vencido';
  const WA_PEINETA = '5492473000000'; // TODO: WhatsApp de Peineta para activar el plan
  window.planCard = () => {
    if (!SALON) return '';
    const fin = new Date(SALON.prueba_hasta).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });
    const st = SALON.estado === 'activo' ? '<span class="chip ok">Activo</span>' : `<span class="chip">${SALON.estado === 'prueba' ? 'Prueba' : 'Vencido'}</span>`;
    return `<div class="card"><div class="row"><div class="grow"><div class="t">${SALON.estado === 'activo' ? 'Plan Básico · $15.000 por mes' : 'Prueba gratis de 7 días'}</div><div class="s">Cuenta ${esc(S.settings.email || '')}</div></div>${st}</div>
    ${SALON.estado === 'prueba' ? `<div class="row"><div class="grow"><div class="t">Tu prueba termina el ${fin}</div><div class="s">Después, $15.000 por mes: lo que sale un corte</div></div></div>` : ''}
    <a class="row click" href="https://wa.me/${WA_PEINETA}?text=${encodeURIComponent('Hola! Quiero activar Peineta para ' + (S.settings.salon || 'mi peluquería') + ' (' + (S.settings.email || '') + ')')}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><div class="grow"><div class="t">${SALON.estado === 'activo' ? 'Consultas sobre tu plan' : 'Activar el plan'}</div><div class="s">Escribinos por WhatsApp</div></div><span style="color:var(--muted);font-size:20px">›</span></a>
    <div class="row click" data-act="cancelPlan"><div class="grow"><div class="t">Dar de baja el servicio</div><div class="s">Tus datos quedan guardados 90 días</div></div></div></div>`;
  };
  window.vBlocked = () => `<div class="login"><div class="mark">⏳</div><h1>Tu prueba gratis terminó</h1><p>Tus datos están guardados. Para seguir usando Peineta activá el Plan Básico: $15.000 por mes.</p>
    <a class="btn pri block" href="https://wa.me/${WA_PEINETA}?text=${encodeURIComponent('Hola! Quiero activar Peineta para ' + (S.settings.salon || 'mi peluquería') + ' (' + (S.settings.email || '') + ')')}" target="_blank" rel="noopener">Activar por WhatsApp</a>
    <button class="btn block" style="margin-top:8px;color:var(--muted)" data-act="logout">Cerrar sesión</button></div>`;
  window.vBoot = () => `<div class="login"><div class="mark">✂️</div><p style="color:var(--muted)">Cargando…</p></div>`;

  /* ---------- perfil público del cliente (?c=token) ---------- */
  window.vPublicPortal = () => {
    const d = S.publicPortal;
    if (d === 'err') return `<div class="login"><div class="mark">🤷</div><h1>Link no válido</h1><p>Pedile a tu peluquería que te mande el link de nuevo.</p></div>`;
    const near = d.premios.find(p => p.puntos > d.puntos);
    return `<div class="login" style="justify-content:flex-start;padding-top:40px;overflow-y:auto">
      ${d.logo ? `<img src="${d.logo}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin:0 auto 10px">` : ''}
      <div class="note">${esc(d.salon)}</div><h1>Hola, ${esc(d.cliente)}</h1>
      <div class="card" style="text-align:center;padding:18px"><div style="font-size:13px;color:var(--muted)">Tus puntos</div><div class="serif" style="font-size:44px;color:${d.color}">⭐ ${nf(d.puntos)}</div>
      ${near ? `<div class="s">Te faltan ${nf(near.puntos - d.puntos)} para: <b>${esc(near.nombre)}</b></div>` : ''}</div>
      <h2>Premios</h2><div class="card">${d.premios.length ? d.premios.map(p => `<div class="row"><div class="grow"><div class="t">${esc(p.nombre)}</div></div><b style="color:${p.puntos <= d.puntos ? 'var(--ok,#1a7f45)' : 'inherit'}">${nf(p.puntos)} pts${p.puntos <= d.puntos ? ' ✓' : ''}</b></div>`).join('') : '<div class="empty">Todavía no hay premios cargados.</div>'}</div>
      ${d.ultimos.length ? `<h2>Movimientos</h2><div class="card">${d.ultimos.map(m => `<div class="row"><div class="grow"><div class="t">${esc(m.descripcion || '')}</div><div class="s">${new Date(m.fecha + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div></div><b>${m.puntos > 0 ? '+' : ''}${nf(m.puntos)}</b></div>`).join('')}</div>` : ''}
      ${d.telefono ? `<a class="btn pri block" style="margin-top:16px" href="https://wa.me/${d.telefono}" target="_blank" rel="noopener">Pedir un turno por WhatsApp</a>` : ''}
      <div class="foot">Hecho con <a href="/" style="color:inherit">Peineta</a></div></div>`;
  };

  /* ---------- acceso ---------- */
  const errText = e => {
    const m = (e && (e.message || e.msg) || '').toLowerCase();
    if (m.includes('invalid login')) return 'Mail o contraseña incorrectos';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Ese mail ya tiene una cuenta. Ingresá o recuperá la contraseña';
    if (m.includes('weak') || m.includes('at least')) return 'Usá una contraseña de al menos 8 caracteres';
    if (m.includes('rate') || m.includes('too many')) return 'Demasiados intentos. Esperá unos minutos';
    if (m.includes('fetch') || m.includes('network')) return 'Sin conexión. Probá de nuevo';
    return 'No se pudo. Probá de nuevo en un rato';
  };
  async function startSession(user) {
    S.booting = true; render();
    try { await loadAll(user) }
    catch (e) {
      console.error(e);
      try { const c = JSON.parse(localStorage.getItem('peineta-cache-' + (SALON && SALON.id))); if (c) { S = { ...c, form: {}, booting: false, authed: true }; toast('Sin conexión: estás viendo lo último guardado') } else throw e }
      catch (e2) { S = fresh(); S.booting = false; render(); toast(errText(e)); return }
    }
    S.booting = false; render();
  }
  window.DB = {
    schedule,
    async login(email, pass) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) { toast(errText(error)); return }
      startSession(data.user);
    },
    async signup(email, pass) {
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { tipo: 'u' } } });
      if (error) { toast(errText(error)); return }
      if (!data.session) { toast('Revisá tu mail para confirmar la cuenta'); return }
      try { if (window.fbq) fbq('track', 'Lead', { content_name: 'registro_prueba' }) } catch (e) { }
      startSession(data.user);
    },
    async forgot(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/app/' });
      if (error) { toast(errText(error)); return }
      S.loginStep = 3; render();
    },
    async newPass(pass) {
      const { data, error } = await sb.auth.updateUser({ password: pass });
      if (error) { toast(errText(error)); return }
      history.replaceState(null, '', '/app/'); toast('Contraseña actualizada ✓');
      startSession(data.user);
    },
    async logout() {
      await flush();
      await sb.auth.signOut();
      try { localStorage.removeItem(cacheKey()) } catch (e) { }
      SALON = null; SNAP = {}; S = fresh(); render();
    }
  };

  /* ---------- arranque ---------- */
  (async function boot() {
    const tok = new URLSearchParams(location.search).get('c');
    if (tok) {
      const { data, error } = await sb.rpc('perfil_cliente', { p_token: tok });
      S.booting = false; S.publicPortal = (!error && data) ? data : 'err';
      if (data && data.color) document.documentElement.style.setProperty('--brand', data.color);
      render(); return;
    }
    let recovering = /type=recovery/.test(location.hash);
    sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') { recovering = true; S = fresh(); S.booting = false; S.loginStep = 5; render() } });
    const { data: { session } } = await sb.auth.getSession();
    if (recovering) { S = fresh(); S.booting = false; S.loginStep = 5; render(); return }
    if (session) startSession(session.user);
    else { S.booting = false; render() }
  })();
})();
