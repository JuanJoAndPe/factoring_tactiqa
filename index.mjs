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
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // También verificar si viene de API Gateway v2
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ message: 'CORS preflight successful' })
        };
    }

    try {
        if (!pool) pool = mysql.createPool(dbConfig);

        // 2. LIMPIEZA DE RUTA
        let rawPath = event.rawPath || event.path || "";
        const method = event.requestContext?.http?.method || event.httpMethod;

        // Filtra segmentos vacíos y omite prefijos de etapa de API Gateway
        const segments = rawPath.split('/').filter(s => s !== "" && s !== "default" && s !== "prod");
        const path = '/' + segments.join('/');
        
        console.log(`=== DEBUG ===`);
        console.log('Method:', method);
        console.log('Path:', path);
        console.log('Full path:', rawPath);
        console.log('Segments:', segments);
        console.log('Query params:', event.queryStringParameters);
        console.log('=== END DEBUG ===');

        let body = {};
        try { 
            if (event.body) {
                body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            }
        } catch(e) {
            console.error('Error parsing body:', e);
        }
        
        let result = {};

        // === RUTA: LOGIN (ACTUALIZADA PARA CLIENTES Y STAFF) ===
        if (path === '/login' && method === 'POST') {
            const { email, password } = body;
            
            console.log('Login attempt:', { email, passwordLength: password?.length });
            
            try {
                let user = null;
                let userType = null;
                
                // 1. Primero buscar en Users (empleados/admin)
                const [users] = await pool.execute(
                    'SELECT * FROM Users WHERE email = ?', 
                    [email]
                );
                
                if (users.length > 0) {
                    // Usuario del sistema
                    const dbUser = users[0];
                    
                    // Verificar contraseña (texto plano)
                    if (dbUser.password_hash === password) {
                        user = {
                            id: dbUser.id,
                            email: dbUser.email,
                            role: dbUser.role,
                            name: dbUser.nombre,
                            userType: 'STAFF'
                        };
                        userType = 'STAFF';
                        console.log('✅ Login staff exitoso');
                    }
                } 
                
                // 2. Si no es staff, buscar en Clientes
                if (!user) {
                    console.log('Buscando en Clientes...');
                    const [clientes] = await pool.execute(
                        `SELECT 
                            id, 
                            ruc,
                            email_contacto as email,
                            razon_social as nombre,
                            tipo,
                            estado
                         FROM Clientes 
                         WHERE email_contacto = ?`,
                        [email]
                    );
                    
                    if (clientes.length > 0) {
                        const cliente = clientes[0];
                        
                        // Verificar que el RUC coincida con la contraseña
                        if (cliente.ruc === password) {
                            user = {
                                id: cliente.id,
                                email: cliente.email,
                                role: 'CLIENTE',
                                name: cliente.nombre,
                                ruc: cliente.ruc,
                                tipo: cliente.tipo,
                                userType: 'CLIENTE'
                            };
                            userType = 'CLIENTE';
                            console.log('✅ Login cliente exitoso');
                        } else {
                            console.log('❌ RUC no coincide con contraseña');
                            console.log('RUC en BD:', cliente.ruc);
                            console.log('Password recibido:', password);
                        }
                    }
                }
                
                if (user) {
                    result = { 
                        success: true, 
                        user: user,
                        userType: userType
                    };
                } else {
                    return { 
                        statusCode: 401, 
                        headers, 
                        body: JSON.stringify({ 
                            success: false, 
                            message: "Email o RUC incorrectos. Si es cliente nuevo, regístrese primero." 
                        }) 
                    };
                }
                
            } catch (error) {
                console.error('Error en login:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: `Error interno: ${error.message}`
                    })
                };
            }
        }

        // === RUTA: CREAR CLIENTE (ACTUALIZADA) ===
        else if (path === '/clientes' && method === 'POST') {
            console.log('Creando cliente:', body);
            
            const { id, tipo: tipoCliente, data } = body;
            
            if (!id || !tipoCliente || !data) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        message: "Faltan campos obligatorios" 
                    })
                };
            }
            
            try {
                // Extraer datos según tipo de cliente
                let rucValue = '';
                let razonSocialValue = '';
                let emailValue = '';
                let telefonoValue = '';
                let nombreCompleto = '';
                
                if (tipoCliente === 'PJ') {
                    rucValue = data.pj_ruc || '';
                    razonSocialValue = data.pj_razon_social || '';
                    emailValue = data.pj_contacto_email || '';
                    telefonoValue = data.pj_contacto_cel || '';
                    nombreCompleto = `${data.pj_contacto_primer_nombre || ''} ${data.pj_contacto_primer_apellido || ''}`.trim();
                } else if (tipoCliente === 'PN') {
                    rucValue = data.pn_ruc || data.pn_num_id || '';
                    razonSocialValue = data.pn_razon || `${data.pn_nombre} ${data.pn_apellido}` || '';
                    emailValue = data.pn_email || '';
                    telefonoValue = data.pn_cel || '';
                    nombreCompleto = `${data.pn_nombre || ''} ${data.pn_apellido || ''}`.trim();
                }
                
                // Verificar si ya existe el RUC
                if (rucValue) {
                    const [existing] = await pool.execute(
                        'SELECT id FROM Clientes WHERE ruc = ? LIMIT 1',
                        [rucValue]
                    );
                    
                    if (existing.length > 0) {
                        return {
                            statusCode: 409,
                            headers,
                            body: JSON.stringify({ 
                                success: false, 
                                exists: true,
                                message: "Cliente ya registrado (RUC/Cédula duplicado)" 
                            })
                        };
                    }
                }
                
                // Verificar si ya existe el email
                if (emailValue) {
                    const [existingEmail] = await pool.execute(
                        'SELECT id FROM Clientes WHERE email_contacto = ? LIMIT 1',
                        [emailValue]
                    );
                    
                    if (existingEmail.length > 0) {
                        return {
                            statusCode: 409,
                            headers,
                            body: JSON.stringify({ 
                                success: false, 
                                exists: true,
                                message: "Email ya registrado. Use otro email o recupere su acceso." 
                            })
                        };
                    }
                }
                
                const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

                
                
                // INSERTAR EN CLIENTES
                await pool.execute(
                    `INSERT INTO Clientes (
                        id, ruc, razon_social, tipo, email_contacto, telefono,
                        estado, fecha_creacion, usuario_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        id,
                        rucValue || null,
                        razonSocialValue || null,
                        tipoCliente,
                        emailValue || null,
                        telefonoValue || null,
                        'ACTIVO',
                        now,
                        null
                    ]
                );
                
                // CREAR USUARIO AUTOMÁTICO EN TABLA Users (OPCIONAL)
                if (emailValue && rucValue) {
                    try {
                        const userId = `usr_${Date.now()}`;
                        
                        await pool.execute(
                            `INSERT INTO Users (id, email, password_hash, role, nombre, cliente_id)
                             VALUES (?, ?, ?, ?, ?, ?)`,
                            [
                                userId,
                                emailValue,
                                rucValue, // RUC como contraseña
                                'CLIENTE',
                                nombreCompleto || razonSocialValue,
                                id
                            ]
                        );
                        
                        console.log(`✅ Usuario creado para cliente: ${emailValue} / RUC: ${rucValue}`);
                    } catch (userError) {
                        console.warn('Nota: No se pudo crear usuario en tabla Users:', userError.message);
                        // No es crítico, el login buscará directamente en Clientes
                    }
                }
                
                result = { 
                    success: true, 
                    exists: false,
                    message: "✅ Cliente creado exitosamente. Puede iniciar sesión con su email y RUC.",
                    id: id,
                    email: emailValue,
                    ruc: rucValue
                };
                
            } catch (error) {
                console.error('Error al crear cliente:', error);
                
                if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate')) {
                    return {
                        statusCode: 409,
                        headers,
                        body: JSON.stringify({ 
                            success: false, 
                            exists: true,
                            message: "Cliente ya existe en la base de datos" 
                        })
                    };
                }
                
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        message: `Error: ${error.message}`,
                        code: error.code
                    })
                };
            }
        }

        // === RUTA: CREAR/ACTUALIZAR PAGADOR ===
else if (path === '/pagadores' && method === 'POST') {
    console.log('Creando/actualizando pagador:', body);
    
    const { ruc, nombre, estado } = body;
    
    if (!ruc || !nombre) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                success: false, 
                message: "RUC y Nombre son requeridos" 
            })
        };
    }
    
    try {
        // Verificar si ya existe
        const [existing] = await pool.execute(
            'SELECT ruc FROM Pagadores WHERE ruc = ?',
            [ruc]
        );
        
        if (existing.length > 0) {
            // Actualizar existente
            await pool.execute(
                'UPDATE Pagadores SET nombre = ?, estado = ? WHERE ruc = ?',
                [nombre, estado || 'ACTIVO', ruc]
            );
            result = { 
                success: true, 
                action: 'updated',
                message: "Pagador actualizado exitosamente",
                ruc: ruc
            };
        } else {
            // Crear nuevo
            await pool.execute(
                'INSERT INTO Pagadores (ruc, nombre, estado) VALUES (?, ?, ?)',
                [ruc, nombre, estado || 'ACTIVO']
            );
            result = { 
                success: true, 
                action: 'created',
                message: "Pagador creado exitosamente",
                ruc: ruc
            };
        }
        
    } catch (error) {
        console.error('Error al guardar pagador:', error);
        
        if (error.code === 'ER_DUP_ENTRY' || error.message.includes('Duplicate')) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    message: "Pagador ya existe" 
                })
            };
        }
        
        throw error;
    }
}

        // === RUTA: VERIFICAR RUC ===
        else if (path === '/clientes/check-ruc' && method === 'GET') {
            const ruc = event.queryStringParameters?.ruc;
            
            if (!ruc) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        success: false, 
                        message: "Parámetro 'ruc' es requerido" 
                    })
                };
            }
            
            try {
                // Buscar exactamente como tienes la columna 'ruc'
                const [rows] = await pool.execute(
                    `SELECT id, ruc, razon_social, tipo, email_contacto, estado 
                     FROM Clientes 
                     WHERE ruc = ? 
                     LIMIT 1`,
                    [ruc]
                );
                
                const exists = rows.length > 0;
                
                result = { 
                    success: true, 
                    exists: exists,
                    cliente: exists ? rows[0] : null 
                };
                
            } catch (error) {
                console.error('Error al verificar RUC:', error);
                
                // Si hay error, asumir que no existe para no bloquear registro
                result = { 
                    success: true, 
                    exists: false,
                    cliente: null,
                    error: error.message 
                };
            }
        }

        // === RUTA: LISTAR CLIENTES ===
        else if (path === '/clientes' && method === 'GET') {
            const [rows] = await pool.execute('SELECT * FROM Clientes ORDER BY fecha_creacion DESC');
            result = { items: rows };
        }

        // === RUTA: LISTAR OPERACIONES ===
        else if (path === '/operaciones' && method === 'GET') {
            try {
                // Consulta JOIN para obtener información completa
                const query = `
                    SELECT 
                        o.id,
                        o.cliente_id,
                        COALESCE(c.nombre, 'Cliente ' + o.cliente_id) as cliente_nombre,
                        o.pagador_ruc,
                        COALESCE(p.nombre, 'Pagador ' + o.pagador_ruc) as pagador_nombre,
                        o.fecha_carga,
                        COALESCE(o.fecha_vencimiento, DATE_ADD(o.fecha_carga, INTERVAL 30 DAY)) as fecha_vencimiento,
                        o.cantidad_docs,
                        o.monto_total,
                        COALESCE(o.saldo_pendiente, o.monto_total) as saldo_pendiente,
                        o.estado,
                        o.creado_por,
                        o.doc_factura_pdf
                    FROM Operaciones o
                    LEFT JOIN Clientes c ON o.cliente_id = c.id
                    LEFT JOIN Pagadores p ON o.pagador_ruc = p.ruc
                    ORDER BY o.fecha_carga DESC
                `;
                
                const [rows] = await pool.execute(query);
                
                console.log(`✅ ${rows.length} operaciones encontradas`);
                
                result = { 
                    success: true, 
                    items: rows,
                    count: rows.length 
                };
                
            } catch (error) {
                console.error('Error en consulta de operaciones:', error);
                
                // Si falla el JOIN, intentar con consulta básica
                try {
                    const [rows] = await pool.execute(`
                        SELECT 
                            id,
                            cliente_id,
                            CONCAT('Cliente ', cliente_id) as cliente_nombre,
                            pagador_ruc,
                            CONCAT('Pagador ', pagador_ruc) as pagador_nombre,
                            fecha_carga,
                            COALESCE(fecha_vencimiento, DATE_ADD(fecha_carga, INTERVAL 30 DAY)) as fecha_vencimiento,
                            cantidad_docs,
                            monto_total,
                            COALESCE(saldo_pendiente, monto_total) as saldo_pendiente,
                            estado,
                            creado_por
                        FROM Operaciones 
                        ORDER BY fecha_carga DESC
                    `);
                    
                    result = { 
                        success: true, 
                        items: rows,
                        count: rows.length,
                        warning: "Usando consulta básica (sin JOIN)"
                    };
                    
                } catch (fallbackError) {
                    console.error('Error en fallback:', fallbackError);
                    throw new Error(`Error al obtener operaciones: ${error.message}`);
                }
            }
        }

        // === RUTA: LISTAR PAGADORES ===
        else if (path === '/pagadores' && method === 'GET') {
            const [rows] = await pool.execute('SELECT ruc, nombre, estado FROM Pagadores ORDER BY nombre ASC');
            result = { success: true, items: rows }; 
        }

        // === RUTA: GENERAR LINK DE SUBIDA ===
        else if (path === '/files/upload-url' && method === 'POST') {
            console.log('Generando URL para:', body);
            
            const { fileName, folder, contentType } = body; 
            if (!fileName) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: "fileName es requerido" })
                };
            }
            
            const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
            const key = folder ? `${folder}/${Date.now()}_${sanitizedFileName}` : `${Date.now()}_${sanitizedFileName}`;
            
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                ContentType: contentType || "application/octet-stream"
            });

            const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
            const publicUrl = `https://${BUCKET_NAME}.s3.us-east-2.amazonaws.com/${key}`;

            console.log('URL generada:', { uploadUrl: uploadUrl.substring(0, 50) + '...', publicUrl });
            result = { success: true, uploadUrl, publicUrl, key };
        }

        

        // === RUTA: CREAR OPERACIÓN ===
        else if (path === '/operaciones' && method === 'POST') {
            const o = body;
            if (!o.id || !o.cliente_id || !o.pagador_ruc) {
                return { 
                    statusCode: 400, 
                    headers, 
                    body: JSON.stringify({ success: false, message: "Faltan campos obligatorios" }) 
                };
            }

            const [existe] = await pool.execute('SELECT id FROM Operaciones WHERE id = ?', [o.id]);
            if (existe.length === 0) {
                await pool.execute(
                    'INSERT INTO Operaciones (id, cliente_id, pagador_ruc, fecha_carga, cantidad_docs, monto_total, estado, creado_por) VALUES (?, ?, ?, NOW(), ?, ?, ?, ?)',
                    [o.id, o.cliente_id, o.pagador_ruc, o.cantidad_docs || 0, o.monto_total || 0, o.estado || 'PENDIENTE', o.creado_por || 'CLIENTE']
                );
            } else {
                await pool.execute(
                    'UPDATE Operaciones SET cliente_id=?, pagador_ruc=?, cantidad_docs=?, monto_total=?, estado=?, creado_por=? WHERE id=?',
                    [o.cliente_id, o.pagador_ruc, o.cantidad_docs || 0, o.monto_total || 0, o.estado || 'PENDIENTE', o.creado_por || 'CLIENTE', o.id]
                );
            }
            result = { success: true, id: o.id };
        }

        // === RUTA: BATCH FACTURAS ===
        else if (path === '/operaciones/facturas/batch' && method === 'POST') {
            const { operacion_id, facturas } = body;
            
            if (!operacion_id || !Array.isArray(facturas)) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: "operacion_id y facturas array son requeridos" })
                };
            }
            
            for (const f of facturas) {
                if (!f.clave_acceso) continue;
                const [ex] = await pool.execute('SELECT id FROM DetalleFacturas WHERE operacion_id=? AND clave_acceso=?', [operacion_id, f.clave_acceso]);
                if (ex.length === 0) {
                    const detId = `FAC-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
                    await pool.execute(
                        'INSERT INTO DetalleFacturas (id, operacion_id, clave_acceso, monto, url_pdf, estado_sri) VALUES (?, ?, ?, ?, ?, ?)',
                        [detId, operacion_id, f.clave_acceso, f.monto || null, f.url_pdf || null, f.estado_sri || null]
                    );
                } else {
                    await pool.execute(
                        'UPDATE DetalleFacturas SET monto=?, url_pdf=?, estado_sri=? WHERE operacion_id=? AND clave_acceso=?',
                        [f.monto || null, f.url_pdf || null, f.estado_sri || null, operacion_id, f.clave_acceso]
                    );
                }
            }
            result = { success: true, count: facturas.length };
        }

        // RUTA: GUARDAR LINK EN BD
        else if (path === '/files/save-link' && method === 'POST') {
            const { tabla, id, columna, url } = body;
            
            if (!tabla || !id || !columna) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ success: false, message: "tabla, id y columna son requeridos" })
                };
            }
            
            try {
                // UPDATE dinámico - IMPORTANTE: valida que la tabla y columna existan
                const safeTables = ['Operaciones', 'Documentos', 'Clientes', 'Users']; // Whitelist
                if (!safeTables.includes(tabla)) {
                    throw new Error(`Tabla no permitida: ${tabla}`);
                }
                
                const query = `UPDATE ${tabla} SET ${columna} = ? WHERE id = ?`;
                console.log('Ejecutando query:', query, [url, id]);
                
                const [updateResult] = await pool.execute(query, [url, id]);
                
                result = { 
                    success: true, 
                    message: "URL guardada correctamente",
                    affectedRows: updateResult.affectedRows 
                };
            } catch (dbError) {
                console.error('Error en save-link:', dbError);
                throw new Error(`Error al guardar en BD: ${dbError.message}`);
            }
        }

        // === NUEVA RUTA: OBTENER DETALLE DE DOCUMENTOS DE UNA OPERACIÓN ===
        else if (path === '/operaciones/documentos' && method === 'GET') {
            const opId = event.queryStringParameters?.id;
            
            if (!opId) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "ID requerido" }) };
            }

            try {
                // 1. Buscar Facturas Individuales (DetalleFacturas)
                // Asegúrate que los nombres de columnas coincidan con tu BD (url_pdf, clave_acceso, etc.)
                const [facturas] = await pool.execute(
                    'SELECT id, clave_acceso, monto, url_pdf, estado_sri FROM DetalleFacturas WHERE operacion_id = ?', 
                    [opId]
                );

                // 2. (Opcional) Buscar otros documentos adjuntos si tienes tabla 'Documentos'
                // const [otrosDocs] = await pool.execute('SELECT * FROM Documentos WHERE referencia_id = ?', [opId]);

                result = { 
                    success: true, 
                    facturas: facturas, 
                    otros_documentos: [] // Aquí irían los otrosDocs si implementas esa tabla
                };
            } catch (error) {
                console.error(error);
                return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
            }
        }

        // RUTA NO ENCONTRADA
        else {
            return { 
                statusCode: 404, 
                headers, 
                body: JSON.stringify({ 
                    success: false, 
                    message: `Ruta no encontrada: ${path}`,
                    method: method,
                    rawPath: rawPath,
                    segments: segments
                }) 
            };
        }

        // Respuesta Exitosa
        return { 
            statusCode: 200, 
            headers, 
            body: JSON.stringify(result) 
        };

    } catch (error) {
        console.error("Error Global:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                success: false, 
                message: error.message,
                stack: error.stack 
            }) 
        };
    }
};