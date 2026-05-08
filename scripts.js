const BASE_URL = '/api';

async function apiFetch(endpoint, method = 'GET', body = null) {
  const opts = { 
    method, 
    headers: { 
      'Content-Type': 'application/json',
      'user-role': currentUser ? currentUser.rol : '' // Enviamos el rol guardado
    } 
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE_URL + endpoint, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const DB = {
  async get(col) {
    try { return await apiFetch('/' + col); }
    catch (e) { console.error('Error al obtener ' + col, e); return []; }
  },
  async insert(col, doc) {
    try { return await apiFetch('/' + col, 'POST', doc); }
    catch (e) { console.error('Error al insertar en ' + col, e); throw e; }
  },
  async delete(col, id) {
    try { return await apiFetch('/' + col + '/' + id, 'DELETE'); }
    catch (e) { console.error('Error al eliminar de ' + col, e); throw e; }
  }
};

let currentUser = null;

function saveSession(user) { localStorage.setItem('session', JSON.stringify(user)); currentUser = user; }
function loadSession() { try { return JSON.parse(localStorage.getItem('session')); } catch { return null; } }
function clearSession() { localStorage.removeItem('session'); currentUser = null; }

const MODULES = [
  { id: 'productos',   label: 'PRODUCTOS',   icon: '📦', color: 'card-c2', desc: 'Catálogo de productos, precios y existencias.' },
  { id: 'proveedores', label: 'PROVEEDORES', icon: '🚚', color: 'card-c3', desc: 'Directorio de proveedores y contactos.' },
  { id: 'inventario',  label: 'INVENTARIO',  icon: '📋', color: 'card-c4', desc: 'Stock actual, mínimos y alertas.' },
  { id: 'movimientos', label: 'MOVIMIENTOS', icon: '🔄', color: 'card-c5', desc: 'Entradas, salidas y ajustes de inventario.' },
  { id: 'compras',     label: 'COMPRAS',     icon: '📥', color: 'card-c1', desc: 'Registro de compras a proveedores.' },
  { id: 'ventas',      label: 'VENTAS',      icon: '💰', color: 'card-c6', desc: 'Registro de transacciones y totales.' },
  { id: 'reportes',    label: 'REPORTES',    icon: '📊', color: 'card-c2', desc: 'Análisis de ventas e inventario.' },
  { id: 'usuarios',    label: 'USUARIOS',    icon: '👥', color: 'card-c4', desc: 'Gestión de usuarios, roles y accesos.' },
];

// Todos los roles posibles en la BD (con variantes de mayúsculas)
const todosLosModulos = ['productos','proveedores','inventario','movimientos','compras','ventas','reportes','usuarios'];
const modulosEditor    = ['productos','inventario','movimientos','ventas','reportes','compras'];
const modulosConsultor = ["proveedores",'inventario','movimientos','reportes'];

const PERMISOS = {
  admin:         todosLosModulos,
  Admin:         todosLosModulos,
  administrador: todosLosModulos,
  Administrador: todosLosModulos,
  editor:        modulosEditor,
  Editor:        modulosEditor,
  consultor:     modulosConsultor,
  Consultor:     modulosConsultor,
};

// Roles que solo pueden VER (sin botones de acción)
const ROLES_SOLO_LECTURA = ['consultor','Consultor'];

function switchTab(tab) {
  document.getElementById('login-panel').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('register-panel').style.display = tab === 'register' ? '' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) => {
    el.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
  });
}

async function doLogin() {
  const nombre   = document.getElementById('l-nombre').value.trim();
  const password = document.getElementById('l-password').value;
  const msg      = document.getElementById('login-msg');
  msg.className  = 'auth-msg'; msg.textContent = '';
  if (!nombre || !password) { showMsg(msg, 'Completa todos los campos.', 'error'); return; }
  try {
    const user = await apiFetch('/usuarios/login', 'POST', { nombre, password });
    saveSession(user);
    document.getElementById('l-nombre').value = '';
    document.getElementById('l-password').value = '';
    enterApp();
  } catch (e) {
    showMsg(msg, 'Usuario o contraseña incorrectos.', 'error');
  }
}

async function doRegister() {
  const nombre   = document.getElementById('r-nombre').value.trim();
  const rol      = document.getElementById('r-rol').value;
  const password = document.getElementById('r-password').value;
  const msg      = document.getElementById('register-msg');
  msg.className  = 'auth-msg'; msg.textContent = '';
  if (!nombre || !rol || !password) { showMsg(msg, 'Completa todos los campos.', 'error'); return; }
  if (password.length < 4) { showMsg(msg, 'La contraseña debe tener al menos 4 caracteres.', 'error'); return; }
  try {
    await apiFetch('/usuarios/registro', 'POST', { nombre, rol, password });
    showMsg(msg, 'Cuenta creada. Ahora inicia sesión.', 'success');
    setTimeout(() => {
      document.getElementById('l-nombre').value = nombre;
      document.getElementById('r-nombre').value = '';
      document.getElementById('r-rol').value = '';
      document.getElementById('r-password').value = '';
      document.getElementById('register-msg').className = 'auth-msg';
      switchTab('login');
    }, 1100);
  } catch (e) {
    showMsg(msg, 'Error al registrar: ' + e.message, 'error');
  }
}

function doLogout() {
  clearSession();
  document.getElementById('app-section').style.display  = 'none';
  document.getElementById('auth-section').style.display = 'flex';
  document.getElementById('l-nombre').value = '';
  document.getElementById('l-password').value = '';
  document.getElementById('login-msg').className = 'auth-msg';
  switchTab('login');
}

async function doRecoverPassword() {
  const nombre = prompt("Introduce tu nombre de usuario para recuperar:");
  if (!nombre) return;

  const nuevaPassword = prompt("Introduce tu NUEVA contraseña:");
  if (!nuevaPassword) return;

  const confirmar = prompt("Confirma tu nueva contraseña:");
  
  if (nuevaPassword !== confirmar) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  try {
    const res = await fetch(BASE_URL + '/usuarios/recuperar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, nuevaPassword })
    });

    const data = await res.json();

    if (res.ok) {
      alert(data.mensaje);
    } else {
      alert("Error: " + data.error);
    }
  } catch (error) {
    console.error("Error en recuperación:", error);
    alert("No se pudo conectar con el servidor.");
  }
}

function enterApp() {
  const user = currentUser || loadSession();
  if (!user) return;
  currentUser = user;
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('app-section').style.display  = 'block';
  document.getElementById('user-avatar').textContent       = user.nombre.charAt(0).toUpperCase();
  document.getElementById('user-name-display').textContent = user.nombre;
  document.getElementById('user-role-display').textContent = user.rol;
  renderDashboard(user.rol).catch(()=>renderDashboard(user.rol));
}

async function renderDashboard(rol) {
  const permisos = PERMISOS[rol] || PERMISOS[rol?.toLowerCase()] || todosLosModulos;
  const grid = document.getElementById('cards-grid');
  grid.innerHTML = '';

  // Cargar contadores en paralelo
  const [productos, ventas, inventario, movimientos, compras, proveedores, usuarios] = await Promise.all([
    DB.get('productos').catch(()=>[]),
    DB.get('ventas').catch(()=>[]),
    DB.get('inventario').catch(()=>[]),
    DB.get('movimientos_inventario').catch(()=>[]),
    apiFetch('/compras').catch(()=>[]),
    DB.get('proveedores').catch(()=>[]),
    DB.get('usuarios').catch(()=>[]),
  ]);

  const hoy = new Date().toISOString().slice(0,10);
  const ventasHoy   = ventas.filter(v => v.fecha && String(v.fecha).slice(0,10) === hoy);
  const totalHoy    = ventasHoy.reduce((s,v) => s + parseFloat(v.total||0), 0);
  const stockBajos  = inventario.filter(i => i.stock_actual <= i.stock_minimo);
  const entradas    = movimientos.filter(m => m.tipo_movimiento === 'entrada').length;
  const salidas     = movimientos.filter(m => m.tipo_movimiento === 'salida').length;

  const contadores = {
    productos:   { val: productos.length,  label: 'productos registrados' },
    proveedores: { val: proveedores.length, label: 'proveedores activos' },
    inventario:  { val: stockBajos.length,  label: stockBajos.length > 0 ? '⚠ con stock bajo' : '✓ todo en orden', alert: stockBajos.length > 0 },
    movimientos: { val: movimientos.length, label: `${entradas} entradas · ${salidas} salidas` },
    compras:     { val: compras.length,     label: 'compras registradas' },
    ventas:      { val: ventasHoy.length,   label: `hoy · $${totalHoy.toFixed(2)}` },
    reportes:    { val: '—',               label: 'genera tu reporte' },
    usuarios:    { val: usuarios.length,    label: 'usuarios en el sistema' },
  };

  MODULES.forEach(mod => {
    const allowed = permisos.includes(mod.id);
    const cnt     = contadores[mod.id];
    const div = document.createElement('div');
    div.className = `module-card ${mod.color}${allowed ? '' : ' locked'}`;
    div.innerHTML = `
      <div class="card-header">
        <span>${mod.icon}</span>
        ${cnt && allowed ? `<div class="card-counter${cnt.alert ? ' card-counter-alert' : ''}">${cnt.val}</div>` : ''}
      </div>
      <div class="card-body">
        <h3>${mod.label}</h3>
        <p>${cnt && allowed ? cnt.label : mod.desc}</p>
      </div>`;
    if (allowed) div.onclick = () => openModal('modal-' + mod.id);
    grid.appendChild(div);
  });
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  refreshTable(id);
  // Aplicar restricciones de solo lectura si aplica
  setTimeout(aplicarRestriccionesRol, 50);
  const now = new Date().toISOString().slice(0, 16);
  ['mv-fecha','vt-fecha','cp-fecha'].forEach(fid => {
    const el = document.getElementById(fid);
    if (el && !el.value) el.value = now;
  });
  if (id === 'modal-compras') {
    _productosCache = [];
    ['cp-prod-search','cp-idprod','cp-cantidad','cp-precio'].forEach(fid => {
      const el = document.getElementById(fid);
      if (el) el.value = '';
    });
    const lista = document.getElementById('cp-prod-lista');
    if (lista) lista.style.display = 'none';
  }
  if (id === 'modal-ventas') {
    _productosCache = [];
    ['vt-prod-search','vt-idprod','vt-prod-nombre','vt-precio-unit','vt-cantidad'].forEach(fid => {
      const el = document.getElementById(fid);
      if (el) el.value = '';
    });
    const lista = document.getElementById('vt-prod-lista');
    if (lista) lista.style.display = 'none';
    const tc = document.getElementById('vt-total-calc');
    if (tc) tc.textContent = '$0.00';
  }
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function toggleForm(id)  { document.getElementById(id).classList.toggle('open'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});

async function refreshTable(modalId) {
  const map = {
    'modal-productos'  : renderProductos,
    'modal-proveedores': renderProveedores,
    'modal-inventario' : renderInventario,
    'modal-movimientos': renderMovimientos,
    'modal-compras'    : renderCompras,
    'modal-ventas'     : renderVentas,
    'modal-usuarios'   : renderUsuarios,
  };
  if (map[modalId]) await map[modalId]();
}

// ══════════════════════════════════════════════════
// ── RENDERS ──
// ══════════════════════════════════════════════════

async function renderProductos() {
  try {
    const rows = await DB.get('productos');
    document.getElementById('tbody-productos').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><code>PRD-${r.id_producto}</code></td>
        <td>${r.nombre}</td>
        <td>${r.categoria || '—'}</td>
        <td>$${parseFloat(r.precio).toFixed(2)}</td>
        <td>${r.stock_global ?? 0}</td>
        <td>${esSoloLectura() ? '—' : `
          <button class="btn-sm btn-edit" onclick="editProducto('${r.id_producto}','${escHtml(r.nombre)}','${escHtml(r.categoria||'')}',${r.precio},${r.stock_global??0})">Editar</button>
          <button class="btn-sm btn-delete" onclick="deleteRow('productos','${r.id_producto}','modal-productos')">Eliminar</button>
        `}</td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">Sin productos registrados</div></td></tr>';
  } catch (e) { console.error(e); }
}

async function renderProveedores() {
  try {
    const rows = await DB.get('proveedores');
    document.getElementById('tbody-proveedores').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><code>PV-${r.id_proveedor}</code></td>
        <td>${r.nombre}</td>
        <td>${r.telefono || '—'}</td>
        <td>${r.correo || '—'}</td>
        <td>
          ${esSoloLectura() ? '' : `<button class="btn-sm btn-edit" onclick="editProveedor('${r.id_proveedor}','${escHtml(r.nombre)}','${escHtml(r.telefono||'')}','${escHtml(r.correo||'')}')">Editar</button>`}
          ${esSoloLectura() ? '' : `<button class="btn-sm btn-delete" onclick="deleteRow('proveedores','${r.id_proveedor}','modal-proveedores')">Eliminar</button>`}
        </td>
      </tr>`).join('') : '<tr><td colspan="5"><div class="empty-state">Sin proveedores registrados</div></td></tr>';
  } catch (e) { console.error(e); }
}

function escHtml(str) { return String(str).replace(/'/g,"&#39;").replace(/"/g,'&quot;'); }

function editProveedor(id, nombre, telefono, correo) {
  document.getElementById('pv-nombre').value = nombre;
  document.getElementById('pv-tel').value    = telefono;
  document.getElementById('pv-email').value  = correo;
  document.getElementById('pv-editid').value = id;
  document.getElementById('form-proveedor').classList.add('open');
  document.getElementById('form-proveedor').querySelector('h4').textContent = 'Editar Proveedor';
}

async function saveProveedor() {
  const nombre = val('pv-nombre'), telefono = val('pv-tel'), correo = val('pv-email');
  const editId = val('pv-editid');
  if (!nombre) { alert('El nombre es obligatorio'); return; }
  try {
    if (editId) {
      await apiFetch('/proveedores/' + editId, 'PUT', { nombre, telefono, correo });
      document.getElementById('pv-editid').value = '';
    } else {
      await DB.insert('proveedores', { nombre, telefono, correo });
    }
    toggleForm('form-proveedor');
    document.getElementById('form-proveedor').querySelector('h4').textContent = 'Nuevo Proveedor';
    clearInputs(['pv-nombre','pv-tel','pv-email']);
    await renderProveedores();
  } catch (e) { alert('Error al guardar proveedor: ' + e.message); }
}

async function renderInventario() {
  try {
    const rows = await DB.get('inventario');
    document.getElementById('tbody-inventario').innerHTML = rows.length ? rows.map(r => {
      const critico  = r.stock_actual < r.stock_minimo;
      const enMinimo = r.stock_actual === r.stock_minimo;
      const bien     = r.stock_actual > r.stock_minimo;
      const estadoStyle = critico
        ? 'background:#ffebee;color:#c62828;font-weight:700;'
        : enMinimo ? 'background:#fff3e0;color:#e65100;font-weight:700;'
        : 'background:#e8f5e9;color:#2e7d32;font-weight:700;';
      const estadoTxt  = critico ? '⚠ BAJO' : enMinimo ? '⚡ MÍNIMO' : '✓ OK';
      const pct     = r.stock_minimo > 0 ? Math.min(100, Math.round((r.stock_actual / (r.stock_minimo * 2)) * 100)) : 100;
      const barColor = critico ? '#c62828' : enMinimo ? '#ff9800' : '#2e7d32';
      return `<tr>
        <td><code>INV-${r.id_inventario}</code></td>
        <td><code>PRD-${r.id_producto}</code>${r.nombre_producto ? `<br><small style="color:var(--muted);font-size:11px;">${r.nombre_producto}</small>` : ''}</td>
        <td style="font-weight:700;">
          <span class="${bien?'stock-ok':'stock-low'}">${r.stock_actual}</span>
          <div style="margin-top:4px;height:5px;background:#eee;border-radius:3px;width:80px;">
            <div style="height:5px;border-radius:3px;width:${pct}%;background:${barColor};transition:width .3s;"></div>
          </div>
        </td>
        <td>${r.stock_minimo}</td>
        <td><span class="badge" style="${estadoStyle}">${estadoTxt}</span></td>
        <td>
          ${esSoloLectura() ? '' : `<button class="btn-sm btn-edit" onclick="editInventario('${r.id_inventario}',${r.stock_actual},${r.stock_minimo})">Editar</button>`}
          ${esSoloLectura() ? '' : `<button class="btn-sm btn-delete" onclick="deleteRow('inventario','${r.id_inventario}','modal-inventario')">Eliminar</button>`}
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty-state">Sin registros de inventario</div></td></tr>';

    const ya = document.getElementById('inv-alerta');
    if (ya) ya.remove();
    const criticos = rows.filter(r => r.stock_actual < r.stock_minimo);
    const minimos  = rows.filter(r => r.stock_actual === r.stock_minimo);
    if (criticos.length || minimos.length) {
      const alerta = document.createElement('div');
      alerta.id = 'inv-alerta';
      let css  = 'border-radius:4px;margin-bottom:14px;padding:12px 16px;font-family:IBM Plex Mono,monospace;font-size:11px;letter-spacing:.5px;';
      let html = '';
      if (criticos.length) {
        css += 'background:#ffebee;border-left:4px solid #c62828;color:#c62828;';
        html += `<strong>⚠ ${criticos.length} producto(s) con STOCK BAJO:</strong> ${criticos.map(r=>r.nombre_producto||'PRD-'+r.id_producto).join(', ')}.<br>`;
      } else {
        css += 'background:#fff3e0;border-left:4px solid #ff9800;color:#e65100;';
      }
      if (minimos.length) html += `<strong>⚡ ${minimos.length} en MÍNIMO:</strong> ${minimos.map(r=>r.nombre_producto||'PRD-'+r.id_producto).join(', ')}.`;
      alerta.style.cssText = css;
      alerta.innerHTML = html;
      document.querySelector('#modal-inventario .modal-body').prepend(alerta);
    }
  } catch (e) { console.error(e); }
}

function editInventario(id, actual, minimo) {
  document.getElementById('inv-actual-edit').value = actual;
  document.getElementById('inv-minimo-edit').value = minimo;
  document.getElementById('inv-editid').value = id;
  document.getElementById('form-inventario-edit').classList.add('open');
}

async function saveInventarioEdit() {
  const id = val('inv-editid');
  const stock_actual = parseInt(document.getElementById('inv-actual-edit').value) || 0;
  const stock_minimo = parseInt(document.getElementById('inv-minimo-edit').value) || 0;
  try {
    await apiFetch('/inventario/' + id, 'PUT', { stock_actual, stock_minimo });
    document.getElementById('form-inventario-edit').classList.remove('open');
    await renderInventario();
  } catch (e) { alert('Error al actualizar inventario: ' + e.message); }
}

async function renderMovimientos() {
  try {
    const rows = await DB.get('movimientos_inventario');
    document.getElementById('tbody-movimientos').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><code>MV-${r.id_movimiento}</code></td>
        <td>${r.fecha ? new Date(r.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
        <td><span class="badge badge-${r.tipo_movimiento}">${r.tipo_movimiento === 'entrada' ? '⬆ entrada' : r.tipo_movimiento === 'salida' ? '⬇ salida' : r.tipo_movimiento}</span></td>
        <td style="font-weight:700;">${r.cantidad}</td>
        <td>${r.nombre_producto ? r.nombre_producto : `<code>PRD-${r.id_producto}</code>`}</td>
        <td>${esSoloLectura() ? '—' : `<button class="btn-sm btn-delete" onclick="deleteRow('movimientos_inventario','${r.id_movimiento}','modal-movimientos')">Eliminar</button>`}</td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">Sin movimientos registrados</div></td></tr>';
  } catch (e) { console.error(e); }
}

async function renderVentas() {
  try {
    const rows = await DB.get('ventas');
    document.getElementById('tbody-ventas').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><code>VT-${r.id_venta}</code></td>
        <td>${r.fecha ? new Date(r.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
        <td style="font-weight:700;color:var(--success);">$${parseFloat(r.total).toFixed(2)}</td>
        <td><code>USR-${r.id_usuario}</code></td>
        <td><span class="badge" style="background:#e8f5e9;color:#2e7d32;">✓ completada</span></td>
        <td>${esSoloLectura() ? '—' : `<button class="btn-sm btn-delete" onclick="deleteRow('ventas','${r.id_venta}','modal-ventas')">Eliminar</button>`}</td>
      </tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">Sin ventas registradas</div></td></tr>';
  } catch (e) { console.error(e); }
}

async function renderUsuarios() {
  try {
    const rows = await DB.get('usuarios');
    document.getElementById('tbody-usuarios').innerHTML = rows.length ? rows.map(r => `
      <tr>
        <td><code>USR-${r.id_usuario}</code></td>
        <td>${r.nombre}</td>
        <td><span class="badge" style="background:#1a237e;color:#fff;">${r.rol}</span></td>
        <td>${esSoloLectura() ? '—' : `<button class="btn-sm btn-delete" onclick="deleteRow('usuarios','${r.id_usuario}','modal-usuarios')">Eliminar</button>`}</td>
      </tr>`).join('') : '<tr><td colspan="4"><div class="empty-state">Sin usuarios registrados</div></td></tr>';
  } catch (e) { console.error(e); }
}

async function renderCompras() {
  try {
    const [compras, detalles, productos] = await Promise.all([
      apiFetch('/compras').catch(()=>[]),
      apiFetch('/detalle_compra').catch(()=>[]),
      DB.get('productos').catch(()=>[]),
    ]);
    // Mapear detalle por id_compra
    const detalleMap = {};
    detalles.forEach(d => {
      if (!detalleMap[d.id_compra]) detalleMap[d.id_compra] = [];
      const prod = productos.find(p => p.id_producto == d.id_producto);
      detalleMap[d.id_compra].push({ ...d, nombre: prod?.nombre || 'PRD-'+d.id_producto });
    });
    document.getElementById('tbody-compras').innerHTML = compras.length ? compras.map(r => {
      const items = detalleMap[r.id_compra] || [];
      const detalleTxt = items.length
        ? items.map(i => `${i.nombre} × ${i.cantidad} ($${parseFloat(i.precio_compra||0).toFixed(2)} c/u)`).join('<br>')
        : '—';
      return `<tr>
        <td><code>CP-${r.id_compra}</code></td>
        <td>${r.fecha ? new Date(r.fecha).toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
        <td><code>${r.id_proveedor ? 'PRV-'+r.id_proveedor : 'N/A'}</code></td>
        <td style="font-size:12px;line-height:1.6;">${detalleTxt}</td>
        <td style="font-weight:700;color:var(--accent);">$${parseFloat(r.total_compra||0).toFixed(2)}</td>
        <td>${esSoloLectura() ? '—' : `<button class="btn-sm btn-delete" onclick="deleteRow('compras','${r.id_compra}','modal-compras')">Eliminar</button>`}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="6"><div class="empty-state">Sin compras registradas</div></td></tr>';
  } catch (e) { console.error(e); }
}

// ══════════════════════════════════════════════════
// ── GUARDAR PRODUCTO ──
// ══════════════════════════════════════════════════
async function saveProducto() {
  const nombre    = val('p-nombre');
  const categoria = val('p-categoria');
  const precio    = val('p-precio');
  const stock     = val('p-stock');
  if (!nombre || !precio) { alert('Nombre y precio son obligatorios'); return; }
  try {
    await DB.insert('productos', { nombre, categoria, precio: parseFloat(precio), stock: parseInt(stock)||0 });
    toggleForm('form-producto');
    clearInputs(['p-nombre','p-precio','p-stock']);
    await renderProductos();
    await renderInventario();
  } catch (e) { alert('Error al guardar producto: ' + e.message); }
}

function editProducto(id, nombre, categoria, precio, stock) {
  document.getElementById('pe-id').value        = id;
  document.getElementById('pe-nombre').value    = nombre;
  document.getElementById('pe-categoria').value = categoria;
  document.getElementById('pe-precio').value    = precio;
  document.getElementById('pe-stock').value     = stock;
  document.getElementById('form-producto-edit').classList.add('open');
}

async function saveProductoEdit() {
  const id        = val('pe-id');
  const nombre    = val('pe-nombre');
  const categoria = val('pe-categoria');
  const precio    = val('pe-precio');
  if (!nombre || !precio) { alert('Nombre y precio son obligatorios'); return; }
  try {
    await apiFetch('/productos/' + id, 'PUT', { nombre, categoria, precio: parseFloat(precio) });
    document.getElementById('form-producto-edit').classList.remove('open');
    clearInputs(['pe-id','pe-nombre','pe-precio']);
    await renderProductos();
  } catch (e) { alert('Error al editar producto: ' + e.message); }
}

// ══════════════════════════════════════════════════
// ── HELPER MOVIMIENTOS ──
// ══════════════════════════════════════════════════
async function registrarMovimiento(tipo, cantidad, id_producto) {
  try {
    await apiFetch('/movimientos_inventario', 'POST', {
      tipo_movimiento: tipo,
      cantidad:    parseInt(cantidad),
      id_producto: parseInt(id_producto)
    });
  } catch (e) {
    console.warn('Movimiento no registrado:', e.message);
  }
}

// ══════════════════════════════════════════════════
// ── AUTOCOMPLETE COMPARTIDO ──
// ══════════════════════════════════════════════════
let _productosCache = [];

async function _cargarProductos() {
  if (!_productosCache.length) {
    _productosCache = await DB.get('productos');
  }
  return _productosCache;
}

function _renderLista(listaEl, filtrados, onSelect) {
  if (!filtrados.length) {
    listaEl.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--muted);font-family:IBM Plex Mono,monospace;">Sin resultados</div>';
  } else {
    listaEl.innerHTML = filtrados.map(p => `
      <div onclick="${onSelect}(${p.id_producto},'${escHtml(p.nombre)}',${parseFloat(p.precio)})"
        style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;"
        onmouseover="this.style.background='rgba(200,66,26,0.06)'"
        onmouseout="this.style.background=''">
        <span>${p.nombre}</span>
        <small style="color:var(--muted);font-family:IBM Plex Mono,monospace;font-size:10px;">PRD-${p.id_producto} · $${parseFloat(p.precio).toFixed(2)} · Stock:${p.stock_global}</small>
      </div>`).join('');
  }
  listaEl.style.display = 'block';
}

// ── COMPRAS autocomplete ──
async function filtrarProductosCompra(query) {
  const lista = document.getElementById('cp-prod-lista');
  const todos = await _cargarProductos();
  const q = query.trim().toLowerCase();
  const filtrados = q ? todos.filter(p => p.nombre.toLowerCase().includes(q)) : todos;
  _renderLista(lista, filtrados, 'seleccionarProductoCompra');
}

function seleccionarProductoCompra(id, nombre, precio) {
  document.getElementById('cp-idprod').value       = id;
  document.getElementById('cp-prod-search').value  = nombre;
  document.getElementById('cp-prod-lista').style.display = 'none';
}

async function saveCompra() {
  const id_producto    = val('cp-idprod');
  const cantidadRaw    = val('cp-cantidad');
  const precioRaw      = val('cp-precio');
  if (!id_producto)  { alert('Selecciona un producto del buscador'); return; }
  if (!cantidadRaw)  { alert('La cantidad es obligatoria'); return; }
  if (!precioRaw)    { alert('El precio de compra es obligatorio'); return; }
  const cantidad        = parseInt(cantidadRaw);
  const precio_unitario = parseFloat(precioRaw);
  try {
    await apiFetch('/compras', 'POST', {
      id_proveedor:  null,
      id_producto:   parseInt(id_producto),
      cantidad,
      precio_unitario
    });
    await registrarMovimiento('entrada', cantidad, id_producto);
    toggleForm('form-compra');
    clearInputs(['cp-idprod','cp-cantidad','cp-precio']);
    document.getElementById('cp-prod-search').value = '';
    document.getElementById('cp-prod-lista').style.display = 'none';
    _productosCache = [];
    await renderCompras();
    await renderInventario();
  } catch (e) { alert('Error al guardar compra: ' + e.message); }
}

// ── VENTAS autocomplete ──
async function filtrarProductosVenta(query) {
  const lista = document.getElementById('vt-prod-lista');
  const todos = await _cargarProductos();
  const q = query.trim().toLowerCase();
  const filtrados = q ? todos.filter(p => p.nombre.toLowerCase().includes(q)) : todos;
  _renderLista(lista, filtrados, 'seleccionarProductoVenta');
}

function seleccionarProductoVenta(id, nombre, precio) {
  document.getElementById('vt-idprod').value       = id;
  document.getElementById('vt-prod-nombre').value  = nombre;
  document.getElementById('vt-precio-unit').value  = precio;
  document.getElementById('vt-prod-search').value  = nombre;
  document.getElementById('vt-prod-lista').style.display = 'none';
  calcularTotalVenta();
}

function calcularTotalVenta() {
  const cantidad = parseFloat(document.getElementById('vt-cantidad')?.value) || 0;
  const precio   = parseFloat(document.getElementById('vt-precio-unit')?.value) || 0;
  const el       = document.getElementById('vt-total-calc');
  if (el) el.textContent = '$' + (cantidad * precio).toFixed(2);
}

// ── CARRITO ──
let carrito = [];

function agregarAlCarrito() {
  const id_producto = val('vt-idprod');
  const nombre      = val('vt-prod-nombre') || val('vt-prod-search');
  const cantidad    = parseInt(val('vt-cantidad')) || 0;
  const precio      = parseFloat(document.getElementById('vt-precio-unit')?.value) || 0;

  if (!id_producto) { alert('Selecciona un producto del buscador'); return; }
  if (cantidad < 1) { alert('La cantidad debe ser al menos 1'); return; }
  if (precio <= 0)  { alert('Selecciona un producto con precio válido'); return; }

  const total = parseFloat((cantidad * precio).toFixed(2));
  const idx   = carrito.findIndex(i => String(i.id_producto) === String(id_producto));
  if (idx >= 0) {
    carrito[idx].cantidad += cantidad;
    carrito[idx].total     = parseFloat((carrito[idx].cantidad * precio).toFixed(2));
  } else {
    carrito.push({ id_producto: parseInt(id_producto), nombre, cantidad, precio, total });
  }

  clearInputs(['vt-idprod','vt-prod-nombre','vt-cantidad']);
  document.getElementById('vt-prod-search').value = '';
  document.getElementById('vt-precio-unit').value = '';
  const el = document.getElementById('vt-total-calc');
  if (el) el.textContent = '$0.00';
  _productosCache = [];
  renderCarrito();
  animarAgregarCarrito(nombre, cantidad, precio);
}

function animarAgregarCarrito(nombre, cantidad, precio) {
  // Crear chip flotante que vuela hacia el carrito
  const chip = document.createElement('div');
  chip.textContent = `+${cantidad} ${nombre}`;
  chip.style.cssText = `
    position:fixed; z-index:9999; pointer-events:none;
    background:var(--success); color:#fff;
    font-family:'IBM Plex Mono',monospace; font-size:12px; font-weight:600;
    padding:6px 14px; border-radius:20px;
    box-shadow:0 4px 16px rgba(46,125,50,0.4);
    white-space:nowrap; letter-spacing:.5px;
    transition: transform .55s cubic-bezier(.22,.61,.36,1), opacity .55s ease;
    opacity:1; transform:translateY(0) scale(1);
  `;

  // Posicionar cerca del botón "Agregar al Carrito"
  const btnAgregar = document.querySelector('#form-venta .btn-save');
  const rect = btnAgregar ? btnAgregar.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2 };
  chip.style.left = rect.left + 'px';
  chip.style.top  = (rect.top - 10) + 'px';
  document.body.appendChild(chip);

  // Animar hacia el label del carrito
  const destino = document.querySelector('.seccion-label');
  const destRect = destino ? destino.getBoundingClientRect() : { left: rect.left, top: rect.top - 80 };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const dx = destRect.left - rect.left;
      const dy = destRect.top  - rect.top - 10;
      chip.style.transform = `translate(${dx}px, ${dy}px) scale(0.75)`;
      chip.style.opacity   = '0';
    });
  });

  // Flash verde en la sección del carrito
  setTimeout(() => {
    const seccion = document.querySelector('.seccion-label');
    if (seccion) {
      seccion.style.transition = 'color .15s';
      seccion.style.color = 'var(--success)';
      setTimeout(() => { seccion.style.color = ''; }, 400);
    }
    // Animar la última fila del carrito
    const filas = document.querySelectorAll('#tbody-carrito tr');
    if (filas.length > 1) {
      const ultima = filas[filas.length - 2]; // última fila de producto (no total)
      ultima.style.animation = 'carritoEntrada .35s ease';
    }
    chip.remove();
  }, 560);

  // Badge contador en el label del carrito
  const labelCarrito = document.querySelector('.seccion-label');
  if (labelCarrito) {
    let badge = document.getElementById('carrito-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'carrito-badge';
      badge.style.cssText = `
        background:var(--accent); color:#fff; border-radius:50%;
        font-size:11px; font-weight:700; font-family:'IBM Plex Mono',monospace;
        padding:1px 7px; margin-left:8px; display:inline-block;
        animation: badgePop .3s cubic-bezier(.175,.885,.32,1.275);
      `;
      labelCarrito.appendChild(badge);
    }
    badge.textContent = carrito.length;
    badge.style.animation = 'none';
    requestAnimationFrame(() => { badge.style.animation = 'badgePop .3s cubic-bezier(.175,.885,.32,1.275)'; });
  }
}

function quitarDelCarrito(idx) {
  carrito.splice(idx, 1);
  renderCarrito();
  // Actualizar badge
  const badge = document.getElementById('carrito-badge');
  if (badge) {
    if (carrito.length === 0) { badge.remove(); }
    else { badge.textContent = carrito.length; }
  }
}

function renderCarrito() {
  const tbody        = document.getElementById('tbody-carrito');
  const totalGeneral = carrito.reduce((s, i) => s + i.total, 0);
  tbody.innerHTML = carrito.length
    ? carrito.map((i, idx) => `
        <tr>
          <td>${i.nombre || '<code>PRD-'+i.id_producto+'</code>'}</td>
          <td>${i.cantidad}</td>
          <td>$${i.precio.toFixed(2)}</td>
          <td>$${i.total.toFixed(2)}</td>
          <td><button class="btn-sm btn-delete" onclick="quitarDelCarrito(${idx})">✕</button></td>
        </tr>`).join('')
      + `<tr style="font-weight:700;border-top:2px solid var(--border)">
           <td colspan="3">TOTAL</td>
           <td>$${totalGeneral.toFixed(2)}</td><td></td>
         </tr>`
    : '<tr><td colspan="5" style="text-align:center;padding:12px;opacity:.5">Carrito vacío</td></tr>';
}

async function finalizarVenta() {
  if (!carrito.length) { alert('El carrito está vacío'); return; }
  const id_usuario = currentUser?.id_usuario || currentUser?.id || null;
  if (!id_usuario) { alert('Error de sesión. Vuelve a iniciar sesión.'); return; }

  const totalGeneral  = carrito.reduce((s, i) => s + i.total, 0);
  const carritoTicket = [...carrito];

  try {
    for (const item of carritoTicket) {
      await apiFetch('/ventas', 'POST', {
        id_producto: parseInt(item.id_producto),
        cantidad:    parseInt(item.cantidad),
        id_usuario:  parseInt(id_usuario)
      });
      await registrarMovimiento('salida', item.cantidad, item.id_producto);
    }
    carrito = [];
    renderCarrito();
    const badge = document.getElementById('carrito-badge');
    if (badge) badge.remove();
    generarTicket(carritoTicket, id_usuario, totalGeneral);
    await renderVentas();
    await renderInventario();
  } catch (e) { alert('Error al finalizar venta: ' + e.message); }
}

function generarTicket(items, id_usuario, total) {
  const fecha = new Date().toLocaleString('es-MX');
  const win   = window.open('', '_blank', 'width=420,height=620');
  const filas = items.map(i => `
    <tr>
      <td style="padding:4px 8px;">${i.nombre||'PRD-'+i.id_producto}</td>
      <td style="padding:4px 8px;text-align:center;">${i.cantidad}</td>
      <td style="padding:4px 8px;text-align:right;">$${i.precio.toFixed(2)}</td>
      <td style="padding:4px 8px;text-align:right;">$${i.total.toFixed(2)}</td>
    </tr>`).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Ticket</title>
  <style>body{font-family:monospace;padding:24px;max-width:420px;margin:auto}h2{text-align:center;letter-spacing:2px}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:6px;text-align:left}td{border-bottom:1px solid #eee}.total{font-weight:bold;font-size:1.1rem;text-align:right;margin-top:12px}.footer{text-align:center;margin-top:18px;font-size:.8rem;color:#888}@media print{button{display:none}}</style></head>
  <body>
    <h2>🧾 LA ESQUINA</h2>
    <p style="text-align:center;font-size:.85rem;">Abarrotes — Control de Inventario</p>
    <hr/>
    <p><strong>Fecha:</strong> ${fecha}<br/><strong>Cajero:</strong> USR-${id_usuario}</p>
    <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Total</th></tr></thead>
    <tbody>${filas}</tbody></table>
    <div class="total">TOTAL: $${total.toFixed(2)}</div>
    <div class="footer">¡Gracias por su compra!</div>
    <br/><button onclick="window.print()" style="width:100%;padding:10px;background:#111;color:#fff;border:none;cursor:pointer;font-size:1rem;">🖨 Imprimir Ticket</button>
  </body></html>`);
  win.document.close();
}

// ══════════════════════════════════════════════════
// ── REPORTES ──
// ══════════════════════════════════════════════════
function exportarReportePDF(titulo, thead, tbody) {
  const win = window.open('', '_blank', 'width=800,height=600');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${titulo}</title>
  <style>body{font-family:sans-serif;padding:24px}h2{text-align:center}table{width:100%;border-collapse:collapse}th{background:#111;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #ddd}tr:nth-child(even){background:#f9f9f9}.footer{text-align:center;margin-top:16px;font-size:.8rem;color:#888}@media print{button{display:none}}</style></head>
  <body><h2>${titulo}</h2>
  <p style="text-align:center">Abarrotes La Esquina — ${new Date().toLocaleDateString('es-MX')}</p>
  <table>${thead}${tbody}</table>
  <div class="footer">Generado el ${new Date().toLocaleString('es-MX')}</div>
  <br/><button onclick="window.print()" style="padding:10px 20px;background:#111;color:#fff;border:none;cursor:pointer;font-size:1rem;">🖨 Imprimir / Guardar PDF</button>
  </body></html>`);
  win.document.close();
}

async function loadReporteMasVendidos() {
  try {
    const datos = await apiFetch('/reportes/productos-vendidos');
    const titulo    = '📈 Productos Más Vendidos';
    const theadHtml = '<tr><th>Producto</th><th>Vendidos</th><th>Transacciones</th><th>Precio Unit.</th><th>Ingreso Estimado</th></tr>';
    const tbodyHtml = datos.map(d => `<tr><td>${d.nombre_producto}</td><td>${d.total_vendido} uds</td><td>${d.cantidad_movimientos}</td><td>$${parseFloat(d.precio).toFixed(2)}</td><td>$${(d.total_vendido*d.precio).toFixed(2)}</td></tr>`).join('');
    document.getElementById('tabla-reporte').style.display = 'table';
    document.getElementById('reporte-titulo').textContent  = titulo;
    document.getElementById('thead-reporte').innerHTML = theadHtml;
    document.getElementById('tbody-reporte').innerHTML = tbodyHtml;
    if (!esSoloLectura()) exportarReportePDF(titulo, `<thead>${theadHtml}</thead>`, `<tbody>${tbodyHtml}</tbody>`);
  } catch (e) { alert('Error al cargar reporte: ' + e.message); }
}

async function loadReporteInventario() {
  try {
    const datos = await apiFetch('/reportes/inventario');
    const titulo    = '📦 Resumen de Inventario';
    const theadHtml = '<tr><th>Producto</th><th>Stock</th><th>Precio Unit.</th><th>Valor Total</th></tr>';
    const tbodyHtml = datos.map(d => `<tr><td>${d.nombre}</td><td>${d.stock} uds</td><td>$${parseFloat(d.precio).toFixed(2)}</td><td>$${parseFloat(d.valor_total).toFixed(2)}</td></tr>`).join('');
    document.getElementById('tabla-reporte').style.display = 'table';
    document.getElementById('reporte-titulo').textContent  = titulo;
    document.getElementById('thead-reporte').innerHTML = theadHtml;
    document.getElementById('tbody-reporte').innerHTML = tbodyHtml;
    if (!esSoloLectura()) exportarReportePDF(titulo, `<thead>${theadHtml}</thead>`, `<tbody>${tbodyHtml}</tbody>`);
  } catch (e) { alert('Error al cargar reporte: ' + e.message); }
}

async function loadReporteVentasDia() {
  try {
    const hoy    = new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const hoyISO = new Date().toISOString().slice(0, 10);

    // Cargar ventas y detalle en paralelo
    const [ventas, detalles, productos, usuarios] = await Promise.all([
      DB.get('ventas').catch(()=>[]),
      apiFetch('/detalle_venta').catch(()=>[]),
      DB.get('productos').catch(()=>[]),
      DB.get('usuarios').catch(()=>[]),
    ]);

    // Filtrar solo las ventas de hoy
    const ventasHoy = ventas.filter(v => v.fecha && String(v.fecha).slice(0,10) === hoyISO);

    if (!ventasHoy.length) {
      document.getElementById('tabla-reporte').style.display = 'none';
      document.getElementById('reporte-titulo').textContent  = `🗓 Sin ventas registradas hoy (${hoyISO})`;
      return;
    }

    const totalDia     = ventasHoy.reduce((s, v) => s + parseFloat(v.total||0), 0);
    const totalUnidades = detalles
      .filter(d => ventasHoy.some(v => v.id_venta === d.id_venta))
      .reduce((s, d) => s + parseInt(d.cantidad||0), 0);

    const titulo    = `🗓 Ventas del Día — ${hoy}`;
    const theadHtml = '<tr><th>#Venta</th><th>Hora</th><th>Cajero</th><th>Productos</th><th>Unidades</th><th>Total</th></tr>';

    const tbodyHtml = ventasHoy.map(v => {
      const usuario    = usuarios.find(u => u.id_usuario === v.id_usuario);
      const itemsVenta = detalles.filter(d => d.id_venta === v.id_venta);
      const productosStr = itemsVenta.map(d => {
        const prod = productos.find(p => p.id_producto === d.id_producto);
        return `${prod?.nombre || 'PRD-'+d.id_producto} ×${d.cantidad}`;
      }).join(', ') || '—';
      const unidades = itemsVenta.reduce((s, d) => s + parseInt(d.cantidad||0), 0);
      const hora = v.fecha ? new Date(v.fecha).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) : '—';
      return `<tr>
        <td><code>VT-${v.id_venta}</code></td>
        <td>${hora}</td>
        <td>${usuario?.nombre || 'USR-'+v.id_usuario}</td>
        <td style="font-size:12px;">${productosStr}</td>
        <td style="text-align:center;">${unidades}</td>
        <td style="font-weight:700;color:#2e7d32;">$${parseFloat(v.total).toFixed(2)}</td>
      </tr>`;
    }).join('') + `
      <tr style="background:#e8f5e9;font-weight:700;border-top:2px solid #2e7d32;">
        <td colspan="4" style="text-align:right;padding-right:12px;">TOTALES DEL DÍA</td>
        <td style="text-align:center;">${totalUnidades} uds</td>
        <td style="color:#2e7d32;font-size:1.05rem;">$${totalDia.toFixed(2)}</td>
      </tr>`;

    document.getElementById('tabla-reporte').style.display = 'table';
    document.getElementById('reporte-titulo').textContent  = titulo;
    document.getElementById('thead-reporte').innerHTML = theadHtml;
    document.getElementById('tbody-reporte').innerHTML = tbodyHtml;
    if (!esSoloLectura()) exportarReportePDF(titulo, `<thead>${theadHtml}</thead>`, `<tbody>${tbodyHtml}</tbody>`);
  } catch (e) { alert('Error al cargar reporte del día: ' + e.message); }
}

// ══════════════════════════════════════════════════
// ── UTILS ──
// ══════════════════════════════════════════════════
async function deleteRow(col, id, modal) {
  if (!confirm('¿Eliminar este registro?')) return;
  try {
    await DB.delete(col, id);
    refreshTable(modal);
  } catch (e) { alert('Error al eliminar: ' + e.message); }
}

// Helper: retorna true si el rol actual es solo lectura (Consultor)
function esSoloLectura() {
  return ROLES_SOLO_LECTURA.includes(currentUser?.rol || '');
}

// Ocultar/mostrar botones de acción en modals según rol
function aplicarRestriccionesRol() {
  if (!esSoloLectura()) return;
  // Ocultar botones de acción en todos los modals EXCEPTO en reportes
  document.querySelectorAll('.btn-add, .btn-save, .btn-finalizar, .modal-actions .btn-primary').forEach(el => {
    // Si el botón está dentro del modal de reportes, no ocultarlo
    if (el.closest('#modal-reportes')) return;
    el.style.display = 'none';
  });
  // Reportes: el Consultor puede ver pero no imprimir (controlado en loadReporte*)
}

function val(id) { return document.getElementById(id)?.value?.trim() || ''; }
function showMsg(el, text, type) { el.textContent = text; el.className = 'auth-msg ' + type; }
function clearInputs(ids) { ids.forEach(id => { const el = document.getElementById(id); if(el) el.value=''; }); }

(function init() {
  const sess = loadSession();
  if (sess) { currentUser = sess; enterApp(); }
  const now = new Date().toISOString().slice(0, 16);
  ['mv-fecha','vt-fecha','cp-fecha'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = now;
  });

  // Cerrar dropdowns al hacer click fuera — usar mousedown para que se ejecute ANTES del blur
  document.addEventListener('mousedown', function(e) {
    const listas = ['vt-prod-lista', 'cp-prod-lista'];
    const busquedas = ['vt-prod-search', 'cp-prod-search'];
    listas.forEach((listaId, i) => {
      const lista    = document.getElementById(listaId);
      const busqueda = document.getElementById(busquedas[i]);
      if (!lista) return;
      // Solo cerrar si el click NO fue dentro del dropdown ni en el input
      if (!lista.contains(e.target) && e.target !== busqueda) {
        lista.style.display = 'none';
      }
    });
  });
})();