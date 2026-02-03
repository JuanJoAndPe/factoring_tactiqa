import mysql from 'mysql2/promise';
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// CONFIGURACIÓN DE BASE DE DATOS
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
};

const s3Client = new S3Client({ region: "us-east-2" }); 
const BUCKET_NAME = "factoring-docs";

let pool;

export const handler = async (event) => {
    // HEADERS CORS - Más completos
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "OPTIONS, POST, GET, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token, X-Amz-User-Agent",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400"
    };

    // Manejo explícito de OPTIONS (Preflight)
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS preflight successful' }) };
    }

    try {
        if (!pool) pool = mysql.createPool(dbConfig);

        // LIMPIEZA DE RUTA
        let rawPath = event.rawPath || event.path || "";
        const method = event.requestContext?.http?.method || event.httpMethod;
        const segments = rawPath.split('/').filter(s => s !== "" && s !== "default" && s !== "prod");
        const path = '/' + segments.join('/');
        
        console.log(`=== DEBUG === Path: ${path}, Method: ${method}`);

        let body = {};
        try { 
            if (event.body) {
                body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            }
        } catch(e) {
            console.error('Error parsing body:', e);
        }
        
        let result = {};

        
        // ==========================================
        // === RUTA: PROXY SRI (CORREGIDA FINAL) ===
        // ==========================================
        if (path === '/sri/validar' && method === 'POST') {
            const { clave_acceso } = body;

            if (!clave_acceso) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Falta clave_acceso" }) };
            }

            console.log(`Consultando SRI para clave: ${clave_acceso}`);

            const soapBody = `
                <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
                    <soapenv:Header/>
                    <soapenv:Body>
                        <ec:autorizacionComprobante>
                            <claveAccesoComprobante>${clave_acceso}</claveAccesoComprobante>
                        </ec:autorizacionComprobante>
                    </soapenv:Body>
                </soapenv:Envelope>`;

            try {
                const response = await fetch('https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl', {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/xml;charset=UTF-8' },
                    body: soapBody
                });

                const xmlText = await response.text();
                
                // --- LÓGICA DE EXTRACCIÓN MEJORADA ---
                let estado = 'DESCONOCIDO';
                
                // 1. Detectar Estado
                if (xmlText.includes('<estado>AUTORIZADO</estado>')) estado = 'AUTORIZADO';
                else if (xmlText.includes('<estado>NO AUTORIZADO</estado>')) estado = 'NO AUTORIZADO';
                else if (xmlText.includes('<estado>EN PROCESO</estado>')) estado = 'EN PROCESO';
                else if (xmlText.includes('<estado>RECHAZADA</estado>')) estado = 'RECHAZADA';

                // 2. Extraer el XML real de la factura (oculto dentro de <comprobante>)
                let razonSocial = null;
                let importeTotal = null;
                let mensajeError = null;

                // Buscamos el bloque comprobante. La 's' permite multilineas.
                const comprobanteMatch = xmlText.match(/<comprobante>(.*?)<\/comprobante>/s);

                if (comprobanteMatch && estado === 'AUTORIZADO') {
                    let innerXml = comprobanteMatch[1];
                    
                    // Limpiamos caracteres escapados para convertirlo en XML real
                    innerXml = innerXml
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/<!\[CDATA\[/g, '') // Quitar wrapper CDATA si existe
                        .replace(/\]\]>/g, '');

                    // Buscamos Razón Social
                    const rzMatch = innerXml.match(/<razonSocial>(.*?)<\/razonSocial>/);
                    if (rzMatch) razonSocial = rzMatch[1];

                    // Buscamos Importe Total
                    const impMatch = innerXml.match(/<importeTotal>(.*?)<\/importeTotal>/);
                    if (impMatch) importeTotal = impMatch[1];
                }

                // 3. Si no es autorizado, buscamos mensaje de error
                if (estado !== 'AUTORIZADO') {
                    const infoMatch = xmlText.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/);
                    const msgMatch = xmlText.match(/<mensaje>(.*?)<\/mensaje>/);
                    
                    if (infoMatch) mensajeError = infoMatch[1];
                    else if (msgMatch) mensajeError = msgMatch[1];
                }

                result = {
                    success: true,
                    data: {
                        estado: estado,
                        razonSocial: razonSocial || "---",
                        monto: importeTotal || "0.00",
                        mensajeError: mensajeError
                    }
                };
                
            } catch (sriError) {
                console.error("Error conectando al SRI:", sriError);
                result = { success: false, message: "Error de conexión con el SRI", error: sriError.message };
            }
        }

        // === RUTA: LOGIN ===
        else if (path === '/login' && method === 'POST') {
            const { email, password } = body;
            const [users] = await pool.execute('SELECT * FROM Users WHERE email = ?', [email]);
            if (users.length > 0 && users[0].password_hash === password) {
                result = { success: true, user: { ...users[0], userType: 'STAFF' } };
            } else {
                const [clientes] = await pool.execute('SELECT * FROM Clientes WHERE email_contacto = ?', [email]);
                if (clientes.length > 0 && clientes[0].ruc === password) {
                    result = { success: true, user: { ...clientes[0], userType: 'CLIENTE' } };
                } else {
                    return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: "Credenciales incorrectas" }) };
                }
            }
        }

        // === RUTA: CREAR CLIENTE ===
        else if (path === '/clientes' && method === 'POST') {
            const { id, tipo: tipoCliente, data } = body;
            
            // Extracción de datos según tipo (PJ o PN)
            let rucVal = tipoCliente === 'PJ' ? data.pj_ruc : (data.pn_ruc || data.pn_num_id);
            let emailVal = tipoCliente === 'PJ' ? data.pj_contacto_email : data.pn_email;
            let razonVal = tipoCliente === 'PJ' ? data.pj_razon_social : (data.pn_razon || `${data.pn_nombre} ${data.pn_apellido}`);
            let telVal = tipoCliente === 'PJ' ? data.pj_contacto_cel : data.pn_cel;

            try {
                // CAMBIO CLAVE AQUÍ: 'PENDIENTE' EN LUGAR DE 'ACTIVO'
                await pool.execute(
                    `INSERT INTO Clientes (id, ruc, razon_social, tipo, email_contacto, telefono, estado, fecha_creacion) 
                     VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', NOW())`,
                    [id, rucVal, razonVal, tipoCliente, emailVal, telVal]
                );
                
                // Crear usuario asociado (Login)
                if (rucVal && emailVal) {
                    try {
                        await pool.execute(
                            `INSERT INTO Users (id, email, password_hash, role, nombre, cliente_id) VALUES (?, ?, ?, 'CLIENTE', ?, ?)`,
                            [`usr_${Date.now()}`, emailVal, rucVal, razonVal, id]
                        );
                    } catch(e) { console.warn("Usuario ya existía o error secundario:", e.message); }
                }
                
                result = { success: true, id, message: "Cliente creado y enviado a revisión." };

            } catch (err) {
                 if (err.code === 'ER_DUP_ENTRY') return { statusCode: 409, headers, body: JSON.stringify({ success: false, message: "Este Cliente (RUC) ya existe" }) };
                 throw err;
            }
        }

        // ==========================================
        // === RUTA: DASHBOARD CLIENTE (NUEVA) ===
        // ==========================================
        else if (path === '/dashboard/cliente' && method === 'GET') {
            const clienteId = event.queryStringParameters?.id;

            if (!clienteId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Falta ID cliente" }) };
            }

            try {
                // CORRECCIÓN: Usamos 'razon_social as nombre' porque la columna 'nombre' no existe en Clientes
                const [clientes] = await pool.execute(
                    'SELECT razon_social as nombre, fecha_creacion, estado, cupo_asignado, tasa_interes FROM Clientes WHERE id = ?', 
                    [clienteId]
                );

                if (clientes.length === 0) {
                    return { statusCode: 404, headers, body: JSON.stringify({ success: false, message: "Cliente no encontrado en BD" }) };
                }
                const infoCliente = clientes[0];

                // 2. Calcular KPIs
                const queryKPI = `
                    SELECT 
                        COUNT(*) as total_ops,
                        SUM(monto_total) as total_negociado,
                        SUM(CASE WHEN estado NOT IN ('PAGADO', 'RECHAZADA', 'ELIMINADO') THEN monto_total ELSE 0 END) as deuda_actual,
                        COUNT(CASE WHEN estado NOT IN ('PAGADO', 'RECHAZADA', 'ELIMINADO') THEN 1 END) as ops_vigentes
                    FROM Operaciones 
                    WHERE cliente_id = ?`;
                
                const [kpis] = await pool.execute(queryKPI, [clienteId]);
                const stats = kpis[0];

                // 3. Obtener las 5 últimas operaciones
                const [recentOps] = await pool.execute(`
                    SELECT o.id, o.fecha_carga, o.monto_total, o.estado, p.nombre as pagador_nombre 
                    FROM Operaciones o
                    LEFT JOIN Pagadores p ON o.pagador_ruc = p.ruc
                    WHERE o.cliente_id = ?
                    ORDER BY o.fecha_carga DESC
                    LIMIT 5
                `, [clienteId]);

                // 4. Cálculos Finales
                const cupo = Number(infoCliente.cupo_asignado || 0);
                const utilizado = Number(stats.deuda_actual || 0);
                const disponible = cupo - utilizado;

                result = {
                    success: true,
                    data: {
                        cliente: {
                            nombre: infoCliente.nombre, // Ahora sí llega poblado
                            desde: infoCliente.fecha_creacion,
                            estado: infoCliente.estado
                        },
                        kpis: {
                            historialOps: stats.total_ops || 0,
                            historialMonto: stats.total_negociado || 0,
                            opsVigentes: stats.ops_vigentes || 0,
                            lineaAsignada: cupo,
                            valorNegociado: stats.total_negociado || 0,
                            saldoCapital: utilizado,
                            lineaDisponible: disponible
                        },
                        operaciones: recentOps.map(op => ({
                            fecha: op.fecha_carga,
                            numero: op.id,
                            deudor: op.pagador_nombre || "Desconocido",
                            valor: op.monto_total,
                            anticipo: op.monto_total * 0.80,
                            estado: op.estado
                        }))
                    }
                };
            } catch (dbError) {
                console.error("Error BD Dashboard:", dbError);
                // Tip extra: Si falla aquí, suele ser porque faltan las columnas nuevas (cupo_asignado)
                return { 
                    statusCode: 500, 
                    headers, 
                    body: JSON.stringify({ 
                        success: false, 
                        message: "Error interno BD (¿Columnas faltantes?)", 
                        debug: dbError.message 
                    }) 
                };
            }
        }

        // === RUTA: PAGADORES (POST) ===
        else if (path === '/pagadores' && method === 'POST') {
            const { ruc, nombre, estado, estado_calificacion, doc_ruc, doc_otros } = body;
            
            // Si el cliente manda "EN_REVISION", usamos eso. Si no, "ACTIVO" o lo que venga.
            const estadoFinal = estado_calificacion || estado || 'ACTIVO';
           
            try {
                // Intentamos guardar con documentos
                await pool.execute(
                    `INSERT INTO Pagadores (ruc, nombre, estado, doc_ruc, doc_otros) 
                     VALUES (?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                        nombre = ?, 
                        estado = ?,
                        doc_ruc = IF(? IS NOT NULL, ?, doc_ruc), -- Solo actualiza si viene nuevo doc
                        doc_otros = IF(? IS NOT NULL, ?, doc_otros)`,
                    [
                        ruc, nombre, estadoFinal, doc_ruc || null, doc_otros || null, // INSERT
                        nombre, estadoFinal, 
                        doc_ruc || null, doc_ruc || null, // UPDATE doc_ruc
                        doc_otros || null, doc_otros || null // UPDATE doc_otros
                    ]
                );
            } catch (error) {
                // Si falla (probablemente porque faltan columnas en BD), intentamos guardar solo lo básico
                console.warn("Fallo guardado completo (posible falta de columnas), guardando básico:", error.message);
                await pool.execute(
                    'INSERT INTO Pagadores (ruc, nombre, estado) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE nombre=?, estado=?',
                    [ruc, nombre, estadoFinal, nombre, estadoFinal]
                );
            }
            
            result = { success: true, message: "Pagador procesado correctamente" };
        }

        // === RUTA: VERIFICAR RUC (GET) ===
        else if (path === '/clientes/check-ruc' && method === 'GET') {
            const ruc = event.queryStringParameters?.ruc;
            const [rows] = await pool.execute('SELECT * FROM Clientes WHERE ruc = ? LIMIT 1', [ruc]);
            result = { success: true, exists: rows.length > 0, cliente: rows[0] || null };
        }

        // === RUTA: LISTAR CLIENTES (GET) ===
        else if (path === '/clientes' && method === 'GET') {
            const [rows] = await pool.execute('SELECT * FROM Clientes ORDER BY fecha_creacion DESC');
            result = { items: rows };
        }

        // ==========================================
        // === RUTA: ACTUALIZAR CLIENTE (PUT) ===
        // ==========================================
        else if (path === '/clientes' && method === 'PUT') {
            const clienteId = event.queryStringParameters?.id; // Leemos el ?id=...
            const { estado, kpis_financieros, documentos_financieros, informe_riesgo } = body;

            if (!clienteId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Falta ID cliente" }) };
            }

            try {
                // Construimos la consulta dinámicamente según lo que llegue
                let updates = [];
                let values = [];

                if (estado) {
                    updates.push("estado = ?");
                    values.push(estado);
                }
                if (kpis_financieros) {
                    updates.push("kpis_financieros = ?");
                    values.push(typeof kpis_financieros === 'object' ? JSON.stringify(kpis_financieros) : kpis_financieros);
                }
                if (documentos_financieros) {
                    updates.push("documentos_financieros = ?");
                    values.push(typeof documentos_financieros === 'object' ? JSON.stringify(documentos_financieros) : documentos_financieros);
                }
                if (informe_riesgo) {
                    updates.push("informe_riesgo = ?");
                    values.push(typeof informe_riesgo === 'object' ? JSON.stringify(informe_riesgo) : informe_riesgo);
                }

                if (updates.length === 0) {
                    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Nada que actualizar" }) };
                }

                // Agregamos el ID al final para el WHERE
                values.push(clienteId);

                const sql = `UPDATE Clientes SET ${updates.join(', ')} WHERE id = ?`;
                
                await pool.execute(sql, values);

                result = { success: true, message: "Cliente actualizado correctamente" };

            } catch (dbError) {
                console.error("Error Update:", dbError);
                return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: "Error BD", error: dbError.message }) };
            }
        }

        // === RUTA: LISTAR OPERACIONES (GET) ===
        else if (path === '/operaciones' && method === 'GET') {
             const params = event.queryStringParameters || {};
             const sqlParams = [];
             
             // 1. QUERY BASE
             // CORRECCIÓN IMPORTANTE: Usamos 'c.razon_social' en vez de 'c.nombre'
             let query = `
                    SELECT o.*, 
                           COALESCE(c.razon_social, CONCAT('Cliente ', o.cliente_id)) as cliente_nombre,
                           COALESCE(p.nombre, CONCAT('Pagador ', o.pagador_ruc)) as pagador_nombre
                    FROM Operaciones o
                    LEFT JOIN Clientes c ON o.cliente_id = c.id
                    LEFT JOIN Pagadores p ON o.pagador_ruc = p.ruc
                    WHERE 1=1 `; // Truco para concatenar ANDs fácilmente

             // 2. APLICAR FILTROS DINÁMICOS
             
             // Filtro por Cliente (Seguridad)
             if (params.cliente_id) {
                 query += " AND o.cliente_id = ? ";
                 sqlParams.push(params.cliente_id);
             }

             // Filtro por Estado
             if (params.estado) {
                 if (params.estado === 'ACTIVO') {
                     // Si piden 'ACTIVO', traemos todo lo vigente (ni pagado ni rechazado)
                     query += " AND o.estado NOT IN ('PAGADO', 'RECHAZADA', 'ELIMINADO') ";
                 } else {
                     query += " AND o.estado = ? ";
                     sqlParams.push(params.estado);
                 }
             }

             // Ordenamiento
             query += " ORDER BY o.fecha_carga DESC";

             console.log("SQL GET:", query, sqlParams); // Debug en CloudWatch

            const [rows] = await pool.execute(query, sqlParams);
            result = { success: true, items: rows };
        }

        // === RUTA: LISTAR PAGADORES (GET) ===
        else if (path === '/pagadores' && method === 'GET') {
            const [rows] = await pool.execute('SELECT * FROM Pagadores ORDER BY nombre ASC');
            result = { success: true, items: rows };
        }

        // === RUTA: FILES UPLOAD URL ===
        else if (path === '/files/upload-url' && method === 'POST') {
            const { fileName, folder, contentType } = body; 
            const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const key = folder ? `${folder}/${Date.now()}_${sanitized}` : `${Date.now()}_${sanitized}`;
            
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME, Key: key, ContentType: contentType || "application/octet-stream"
            });
            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
            result = { success: true, uploadUrl, publicUrl: `https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/${key}`, key };
        }

        // === RUTA: FILES READ URL ===
        else if (path === '/files/read-url' && method === 'GET') {
             const fileKey = event.queryStringParameters?.key;
             const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: fileKey });
             const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
             result = { success: true, url: signedUrl };
        }

        // ==========================================
        // === RUTA: CREAR OPERACION (CORREGIDA) ===
        // ==========================================
        else if (path === '/operaciones' && method === 'POST') {
             const o = body;
             
             // 1. SANITIZACIÓN DE VARIABLES (Evita el error 'undefined')
             // Si no viene 'estado', buscamos 'estado_operacion', o ponemos 'PENDIENTE' por defecto.
             const estadoFinal = o.estado || o.estado_operacion || 'PENDIENTE';
             
             // Aseguramos que los números sean números o 0
             const cantidadDocs = o.cantidad_docs !== undefined ? o.cantidad_docs : 0;
             const montoTotal = o.monto_total !== undefined ? o.monto_total : 0;
             
             // Aseguramos que textos no sean undefined
             const creadoPor = o.creado_por || 'SISTEMA';
             const clienteId = o.cliente_id || null;
             const pagadorRuc = o.pagador_ruc || null;

             // Validar ID obligatorio
             if (!o.id) {
                 return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Falta ID de operación" }) };
             }

             await pool.execute(
                `INSERT INTO Operaciones (id, cliente_id, pagador_ruc, fecha_carga, cantidad_docs, monto_total, estado, creado_por) 
                 VALUES (?, ?, ?, NOW(), ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE cliente_id=?, pagador_ruc=?, cantidad_docs=?, monto_total=?, estado=?, creado_por=?`,
                [
                    o.id, 
                    clienteId, 
                    pagadorRuc, 
                    cantidadDocs, 
                    montoTotal, 
                    estadoFinal, 
                    creadoPor,
                    clienteId, 
                    pagadorRuc, 
                    cantidadDocs, 
                    montoTotal, 
                    estadoFinal,
                    creadoPor
                ]
             );
             result = { success: true, id: o.id };
        }

        // === RUTA: BATCH FACTURAS ===
        else if (path === '/operaciones/facturas/batch' && method === 'POST') {
             const { operacion_id, facturas } = body;
             for (const f of facturas) {
                 if (!f.clave_acceso) continue;
                 const detId = `FAC-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
                 
                 const [ex] = await pool.execute('SELECT id FROM DetalleFacturas WHERE operacion_id=? AND clave_acceso=?', [operacion_id, f.clave_acceso]);
                 if (ex.length === 0) {
                     await pool.execute('INSERT INTO DetalleFacturas (id, operacion_id, clave_acceso, monto, url_pdf, estado_sri) VALUES (?,?,?,?,?,?)',
                         [detId, operacion_id, f.clave_acceso, f.monto, f.url_pdf, f.estado_sri]);
                 } else {
                     await pool.execute('UPDATE DetalleFacturas SET monto=?, url_pdf=?, estado_sri=? WHERE operacion_id=? AND clave_acceso=?',
                         [f.monto, f.url_pdf, f.estado_sri, operacion_id, f.clave_acceso]);
                 }
             }
             result = { success: true };
        }

        // === RUTA: SAVE LINK ===
        else if (path === '/files/save-link' && method === 'POST') {
            const { tabla, id, columna, url } = body;
            const safeTables = ['Operaciones', 'Documentos', 'Clientes', 'Users'];
            if (!safeTables.includes(tabla)) throw new Error("Tabla no permitida");
            await pool.execute(`UPDATE ${tabla} SET ${columna} = ? WHERE id = ?`, [url, id]);
            result = { success: true };
        }

        // === RUTA: DOCS DE OPERACION ===
        else if (path === '/operaciones/documentos' && method === 'GET') {
            const opId = event.queryStringParameters?.id;
            const [facturas] = await pool.execute('SELECT * FROM DetalleFacturas WHERE operacion_id = ?', [opId]);
            result = { success: true, facturas };
        }

        else {
            return { statusCode: 404, headers, body: JSON.stringify({ message: "Ruta no encontrada" }) };
        }

        return { statusCode: 200, headers, body: JSON.stringify(result) };

    } catch (error) {
        console.error("Error Global:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ success: false, message: error.message }) 
        };
    }
};