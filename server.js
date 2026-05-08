const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path'); // Útil para manejar rutas de archivos

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Middleware de Seguridad: Solo Administradores
const soloAdmin = (req, res, next) => {
  const userRole = req.headers['user-role']; 
  if (userRole === 'Administrador') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado: Se requieren permisos de Administrador' });
  }
};

// ══════════════════════════════════════════
// ── CONEXIÓN A BASE DE DATOS (Híbrida) ──
// ══════════════════════════════════════════
// Usamos createPool porque es más eficiente para múltiples usuarios
const db = mysql.createPool({
  host: process.env.MYSQLHOST || 'localhost',
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD || 'Rareclock_33233', 
  database: process.env.MYSQLDATABASE || 'tienda_abarrotes',
  port: process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Verificación de conexión inicial
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error al conectar con la base de datos:', err.message);
    return;
  }
  console.log('✅ Conexión exitosa a la base de datos (Railway o Local)');
  connection.release();
});

// ══════════════════════════════════════════
// ── USUARIOS ──
// ══════════════════════════════════════════
app.get('/api/usuarios', (req, res) => {
  db.query('SELECT id_usuario, nombre, rol FROM usuarios', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/usuarios/registro', async (req, res) => {
  const { nombre, rol, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  db.query('INSERT INTO usuarios (nombre, rol, password) VALUES (?, ?, ?)',
    [nombre, rol, hashedPassword], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id_usuario: result.insertId, nombre, rol });
    });
});

app.post('/api/usuarios/login', (req, res) => {
  const { nombre, password } = req.body;
  db.query('SELECT * FROM usuarios WHERE nombre = ?', [nombre], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });

    const usuario = results[0];
    let coinciden;
    if (usuario.password.startsWith('$2')) {
      coinciden = await bcrypt.compare(password, usuario.password);
    } else {
      coinciden = password === usuario.password;
    }

    if (coinciden) {
      const { password: _, ...userSinPassword } = usuario;
      res.json(userSinPassword);
    } else {
      res.status(401).json({ error: 'Contraseña incorrecta' });
    }
  });
});

app.put('/api/usuarios/recuperar', async (req, res) => {
  const { nombre, nuevaPassword } = req.body;
  
  if (!nombre || !nuevaPassword) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }

  try {
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
    db.query('UPDATE usuarios SET password = ? WHERE nombre = ?', 
      [hashedPassword, nombre], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) {
          return res.status(404).json({ error: 'El usuario no existe' });
        }
        res.json({ mensaje: 'Contraseña actualizada correctamente ✅' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar la solicitud' });
  }
});

app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { rol } = req.body;
  db.query('UPDATE usuarios SET rol = ? WHERE id_usuario = ?', [rol, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Rol actualizado ✅' });
  });
});

app.delete('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM usuarios WHERE id_usuario = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Usuario eliminado ✅' });
  });
});

// ══════════════════════════════════════════
// ── PRODUCTOS ──
// ══════════════════════════════════════════
app.get('/api/productos', (req, res) => {
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/productos', (req, res) => {
  const { nombre, categoria, precio, stock } = req.body;
  const stockVal = parseInt(stock) || 0;
  db.query('INSERT INTO productos (nombre, categoria, precio, stock_global) VALUES (?, ?, ?, ?)',
    [nombre, categoria, precio, stockVal], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const id_producto = result.insertId;
      // Insertar en inventario DENTRO del callback y responder desde ahí
      db.query('INSERT INTO inventario (id_producto, stock_actual, stock_minimo) VALUES (?, ?, ?)',
        [id_producto, stockVal, 5], (errInv) => {
          if (errInv) console.warn('Inventario no creado:', errInv.message);
          res.json({ id_producto, nombre, categoria, precio, stock_global: stockVal });
        });
    });
});

app.put('/api/productos/:id', soloAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, precio } = req.body;
  db.query('UPDATE productos SET nombre = ?, categoria = ?, precio = ? WHERE id_producto = ?',
    [nombre, categoria, precio, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Producto actualizado ✅' });
    });
});

app.delete('/api/productos/:id', soloAdmin, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM productos WHERE id_producto = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Producto eliminado ✅' });
  });
});

// ══════════════════════════════════════════
// ── PROVEEDORES ──
// ══════════════════════════════════════════
app.get('/api/proveedores', (req, res) => {
  db.query('SELECT * FROM proveedores', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/proveedores', (req, res) => {
  const { nombre, telefono, correo } = req.body;
  db.query('INSERT INTO proveedores (nombre, telefono, correo) VALUES (?, ?, ?)',
    [nombre, telefono, correo], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id_proveedor: result.insertId, nombre, telefono, correo });
    });
});

app.put('/api/proveedores/:id', soloAdmin, (req, res) => {
  const { id } = req.params;
  const { nombre, telefono, correo } = req.body;
  db.query('UPDATE proveedores SET nombre = ?, telefono = ?, correo = ? WHERE id_proveedor = ?',
    [nombre, telefono, correo, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Proveedor actualizado ✅' });
    });
});

app.delete('/api/proveedores/:id', soloAdmin, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM proveedores WHERE id_proveedor = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Proveedor eliminado ✅' });
  });
});

// ══════════════════════════════════════════
// ── INVENTARIO ──
// ══════════════════════════════════════════
app.get('/api/inventario', (req, res) => {
  const sql = `
    SELECT i.id_inventario, i.id_producto, i.stock_actual, i.stock_minimo,
           p.nombre AS nombre_producto
    FROM inventario i
    JOIN productos p ON i.id_producto = p.id_producto
    ORDER BY i.id_inventario`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/inventario', (req, res) => {
  const { id_producto, stock_actual, stock_minimo } = req.body;
  if (!id_producto) return res.status(400).json({ error: 'id_producto requerido' });
  // Verificar si ya existe un registro para este producto
  db.query('SELECT id_inventario FROM inventario WHERE id_producto = ?', [id_producto], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length > 0) {
      // Ya existe — actualizar en lugar de insertar
      db.query('UPDATE inventario SET stock_actual = ?, stock_minimo = ? WHERE id_producto = ?',
        [stock_actual || 0, stock_minimo || 5, id_producto], (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ id_inventario: rows[0].id_inventario, id_producto, stock_actual, stock_minimo, updated: true });
        });
    } else {
      // No existe — insertar nuevo
      db.query('INSERT INTO inventario (id_producto, stock_actual, stock_minimo) VALUES (?, ?, ?)',
        [id_producto, stock_actual || 0, stock_minimo || 5], (err2, result) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ id_inventario: result.insertId, id_producto, stock_actual, stock_minimo });
        });
    }
  });
});

app.put('/api/inventario/:id', soloAdmin, (req, res) => {
  const { id } = req.params;
  const { stock_actual, stock_minimo } = req.body;
  db.query('UPDATE inventario SET stock_actual = ?, stock_minimo = ? WHERE id_inventario = ?',
    [stock_actual, stock_minimo, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ mensaje: 'Inventario actualizado ✅' });
    });
});

app.delete('/api/inventario/:id', soloAdmin, (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM inventario WHERE id_inventario = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Registro de inventario eliminado ✅' });
  });
});

// ══════════════════════════════════════════
// ── COMPRAS ──
// ══════════════════════════════════════════
app.get('/api/compras', (req, res) => {
  db.query('SELECT * FROM compras ORDER BY fecha DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/compras', (req, res) => {
  const { id_proveedor, id_producto, cantidad, precio_unitario } = req.body;
  const total = cantidad * precio_unitario;

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.beginTransaction(err => {
      if (err) return res.status(500).json({ error: err.message });

      // 1. Registrar la Compra
      connection.query('INSERT INTO compras (id_proveedor, total_compra) VALUES (?, ?)',
        [id_proveedor, total], (err, resCompra) => {
          if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

          // 2. Registrar el Detalle
          connection.query('INSERT INTO detalle_compra (id_compra, id_producto, cantidad, precio_compra) VALUES (?, ?, ?, ?)',
            [resCompra.insertId, id_producto, cantidad, precio_unitario], (err) => {
              if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

              // 3. Actualizar stock_global
              connection.query('UPDATE productos SET stock_global = stock_global + ? WHERE id_producto = ?',
                [cantidad, id_producto], (err) => {
                  if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

                  // 4. Actualizar stock_actual en inventario
                  connection.query('UPDATE inventario SET stock_actual = stock_actual + ? WHERE id_producto = ?',
                    [cantidad, id_producto], (err) => {
                      if (err) console.warn('Inventario no actualizado:', err.message);

                      connection.commit(err => {
                        if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));
                        connection.release();
                        res.json({ mensaje: 'Compra registrada y stock actualizado ✅', id_compra: resCompra.insertId });
                      });
                    });
                });
            });
        });
    });
  });
});

app.get('/api/detalle_venta', (req, res) => {
  db.query('SELECT * FROM detalle_venta', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/detalle_compra', (req, res) => {
  db.query('SELECT * FROM detalle_compra', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.delete('/api/compras/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM compras WHERE id_compra = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ mensaje: 'Compra eliminada ✅' });
  });
});

// ══════════════════════════════════════════
// ── VENTAS ──
// ══════════════════════════════════════════
app.get('/api/ventas', (req, res) => {
  db.query('SELECT * FROM ventas ORDER BY fecha DESC', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/ventas', (req, res) => {
  const { id_producto, cantidad, id_usuario } = req.body;

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.beginTransaction(err => {
      if (err) return res.status(500).json({ error: err.message });

      // 1. Verificar stock disponible
      connection.query('SELECT stock_global, precio FROM productos WHERE id_producto = ?',
        [id_producto], (err, rows) => {
          if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));
          if (rows.length === 0) return connection.rollback(() => res.status(404).json({ error: 'Producto no encontrado' }));

          const producto = rows[0];
          if (producto.stock_global < cantidad) {
            return connection.rollback(() => res.status(400).json({ error: `Stock insuficiente. Disponible: ${producto.stock_global}` }));
          }

          const total = producto.precio * cantidad;

          // 2. Registrar la venta (cabecera)
          connection.query('INSERT INTO ventas (total, id_usuario) VALUES (?, ?)',
            [total, id_usuario], (err, resVenta) => {
              if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

              // 3. Registrar detalle de venta
              connection.query('INSERT INTO detalle_venta (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
                [resVenta.insertId, id_producto, cantidad, producto.precio], (err) => {
                  if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

                  // 4. Descontar stock_global del producto
                  connection.query('UPDATE productos SET stock_global = stock_global - ? WHERE id_producto = ?',
                    [cantidad, id_producto], (err) => {
                      if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

                      // 5. Descontar stock_actual en inventario
                      connection.query('UPDATE inventario SET stock_actual = stock_actual - ? WHERE id_producto = ? AND stock_actual >= ?',
                        [cantidad, id_producto, cantidad], (err) => {
                          if (err) console.warn('Inventario no actualizado:', err.message);

                          connection.commit(err => {
                            if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));
                            connection.release();
                            res.json({ mensaje: 'Venta registrada ✅', id_venta: resVenta.insertId, total });
                          });
                        });
                    });
                });
            });
        });
    });
  });
});

app.delete('/api/ventas/:id', (req, res) => {
  const { id } = req.params;

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction(async (err) => {
      if (err) return res.status(500).json({ error: err.message });

      try {
        // 1. Obtener los detalles de la venta antes de borrar nada
        const [detalles] = await connection.promise().query(
          'SELECT id_producto, cantidad FROM detalle_venta WHERE id_venta = ?', 
          [id]
        );

        // 2. Devolver el stock a cada producto
        for (const item of detalles) {
          await connection.promise().query(
            'UPDATE productos SET stock_global = stock_global + ? WHERE id_producto = ?',
            [item.cantidad, item.id_producto]
          );
          
          await connection.promise().query(
            'UPDATE inventario SET stock_actual = stock_actual + ? WHERE id_producto = ?',
            [item.cantidad, item.id_producto]
          );
        }

        // 3. Borrar los movimientos de inventario asociados a esta venta
        // Nota: Asumiendo que guardas el id_venta o una referencia en movimientos
        await connection.promise().query(
          "DELETE FROM movimientos_inventario WHERE tipo_movimiento = 'salida' AND fecha IN (SELECT fecha FROM ventas WHERE id_venta = ?)", 
          [id]
        );

        // 4. Borrar la venta (esto borrará detalle_venta por el ON DELETE CASCADE que configuramos antes)
        await connection.promise().query('DELETE FROM ventas WHERE id_venta = ?', [id]);

        connection.commit(err => {
          if (err) throw err;
          connection.release();
          res.json({ mensaje: 'Venta cancelada, stock restaurado e historial de movimientos limpio ✅' });
        });

      } catch (error) {
        connection.rollback(() => {
          connection.release();
          res.status(500).json({ error: error.message });
        });
      }
    });
  });
});

// ══════════════════════════════════════════
// ── MOVIMIENTOS INVENTARIO ──
// ══════════════════════════════════════════
app.get('/api/movimientos_inventario', (req, res) => {
  const sql = `
    SELECT m.id_movimiento, m.fecha, m.tipo_movimiento, m.cantidad,
           m.id_producto, p.nombre AS nombre_producto
    FROM movimientos_inventario m
    JOIN productos p ON m.id_producto = p.id_producto
    ORDER BY m.fecha DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/movimientos_inventario', (req, res) => {
  const { tipo_movimiento, cantidad, id_producto } = req.body;

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });
    connection.beginTransaction(err => {
      if (err) return res.status(500).json({ error: err.message });

      // Verificar que el producto existe
      connection.query('SELECT stock_global FROM productos WHERE id_producto = ?',
        [id_producto], (err, rows) => {
          if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));
          if (rows.length === 0) return connection.rollback(() => res.status(404).json({ error: 'Producto no encontrado' }));

          // Registrar el movimiento (sin modificar stock — ya lo hace ventas/compras)
          connection.query('INSERT INTO movimientos_inventario (tipo_movimiento, cantidad, id_producto) VALUES (?, ?, ?)',
            [tipo_movimiento, cantidad, id_producto], (err) => {
              if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

              connection.commit(err => {
                if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));
                connection.release();
                res.json({ mensaje: `Movimiento de ${tipo_movimiento} registrado ✅` });
              });
            });
        });
    });
  });
});

app.delete('/api/movimientos_inventario/:id', (req, res) => {
  const { id } = req.params;

  db.getConnection((err, connection) => {
    if (err) return res.status(500).json({ error: err.message });

    connection.beginTransaction(err => {
      if (err) return res.status(500).json({ error: err.message });

      // 1. Obtener los datos del movimiento antes de borrarlo
      connection.query('SELECT id_producto, cantidad, tipo_movimiento FROM movimientos_inventario WHERE id_movimiento = ?', [id], (err, results) => {
        if (err || results.length === 0) {
          return connection.rollback(() => {
            res.status(404).json({ error: 'Movimiento no encontrado' });
          });
        }

        const { id_producto, cantidad, tipo_movimiento } = results[0];

        // 2. Determinar si sumamos o restamos
        // Si cancelamos una SALIDA (venta), debemos SUMAR al stock.
        // Si cancelamos una ENTRADA (compra), debemos RESTAR del stock.
        const ajuste = (tipo_movimiento === 'salida') ? cantidad : -cantidad;

        // 3. Actualizar la tabla de Productos
        connection.query('UPDATE productos SET stock_global = stock_global + ? WHERE id_producto = ?', [ajuste, id_producto], (err) => {
          if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

          // 4. Actualizar la tabla de Inventario
          connection.query('UPDATE inventario SET stock_actual = stock_actual + ? WHERE id_producto = ?', [ajuste, id_producto], (err) => {
            if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

            // 5. Finalmente, borrar el movimiento
            connection.query('DELETE FROM movimientos_inventario WHERE id_movimiento = ?', [id], (err) => {
              if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));

              connection.commit(err => {
                if (err) return connection.rollback(() => res.status(500).json({ error: err.message }));
                connection.release();
                res.json({ mensaje: 'Movimiento cancelado y stock restaurado ✅' });
              });
            });
          });
        });
      });
    });
  });
});

// ══════════════════════════════════════════
// ── REPORTES ──
// ══════════════════════════════════════════
app.get('/api/reportes/inventario', (req, res) => {
  const sql = `
    SELECT id_producto, nombre, stock_global AS stock, precio,
           precio * stock_global AS valor_total
    FROM productos`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/api/reportes/productos-vendidos', (req, res) => {
  const sql = `
    SELECT p.id_producto, p.nombre AS nombre_producto, p.precio,
           SUM(m.cantidad) AS total_vendido,
           COUNT(m.id_movimiento) AS cantidad_movimientos
    FROM movimientos_inventario m
    JOIN productos p ON m.id_producto = p.id_producto
    WHERE m.tipo_movimiento = 'salida'
    GROUP BY p.id_producto, p.nombre, p.precio
    ORDER BY total_vendido DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));