//app.js aquí esta es la logica de inicio de whatsapp
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    isPnUser 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const { guardarUltimoMensaje, obtenerUltimoMensaje } = require('./ultimo.js');
const path = require('path');
const fs = require('fs').promises;
const { listador, inicializarListador } = require('./listador');
const { inicializarGuardado } = require('./guardado');
const { transcribirGroq } = require('./oir');
const {transcribirOpen} = require('./oirOpen');
const {transcribirGemini} = require('./oirGemini')
// Importar funciones para obtener mensajes predeterminados
const { getPredeterminedMessages } = require('./mensajesPredeterminados');
const { getMensajeInicial } = require('./inicio');
const { getClientes, saveClientes } = require('./clientes');
const logs = require('./logs');

// Importar la función responder actualizada
const { responder } = require('./enviar');

const { procesarImagen } = require('./imagen');
const { Console } = require('console');

// Objeto para manejar múltiples clientes WhatsApp
let clientesWhatsapp = {};
let electronAppRef = null;
let parametrosCargados = null;
let onStatusUpdateRef = null;
let sesionesConectando = {}; // Flag para evitar múltiples intentos de conexión por agente

function normalizeText(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Función para limpiar sesión corrupta específica
async function limpiarSesionCorrompida(agente = '1') {
    try {
        if (!electronAppRef) return;

        const rutaSesiones = path.join(electronAppRef.getPath('userData'), 'sesiones', agente);

        try {
            await fs.access(rutaSesiones);
            const archivos = await fs.readdir(rutaSesiones);
            for (const archivo of archivos) {
                const rutaArchivo = path.join(rutaSesiones, archivo);
                const stats = await fs.stat(rutaArchivo);
                if (stats.isDirectory()) {
                    await fs.rmdir(rutaArchivo, { recursive: true });
                } else {
                    await fs.unlink(rutaArchivo);
                }
            }
            console.log(`✅ Datos de sesión '${agente}' limpiados exitosamente`);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`⚠️ Error limpiando sesión '${agente}':`, error);
            }
        }
    } catch (error) {
        console.error(`❌ Error en limpiarSesionCorrompida para '${agente}':`, error);
    }
}

// Función para obtener lista de sesiones disponibles
async function obtenerSesionesDisponibles() {
    try {
        if (!electronAppRef) return [];

        const rutaSesiones = path.join(electronAppRef.getPath('userData'), 'sesiones');

        try {
            await fs.access(rutaSesiones);
            const carpetas = await fs.readdir(rutaSesiones);
            const sesiones = [];

            for (const carpeta of carpetas) {
                const rutaCarpeta = path.join(rutaSesiones, carpeta);
                const stats = await fs.stat(rutaCarpeta);
                if (stats.isDirectory()) {
                    // Verificar si tiene archivos de credenciales
                    const rutaCreds = path.join(rutaCarpeta, 'creds.json');
                    try {
                        await fs.access(rutaCreds);
                        sesiones.push({
                            nombre: carpeta,
                            activa: clientesWhatsapp[carpeta] && clientesWhatsapp[carpeta].user ? true : false,
                            conectando: sesionesConectando[carpeta] || false
                        });
                    } catch {
                        // No tiene credenciales válidas
                        sesiones.push({
                            nombre: carpeta,
                            activa: false,
                            conectando: sesionesConectando[carpeta] || false,
                            sinCredenciales: true
                        });
                    }
                }
            }

            return sesiones;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // No existe la carpeta de sesiones
            }
            throw error;
        }
    } catch (error) {
        console.error('❌ Error obteniendo sesiones disponibles:', error);
        return [];
    }
}

async function whatsapp(electronApp, onStatusUpdate, parametros, agente = "1") {

    let seleccion = "groq";

    electronAppRef = electronApp;
    parametrosCargados = parametros;
    onStatusUpdateRef = onStatusUpdate;

    
    

    await inicializarGuardado(electronAppRef);
    inicializarListador(electronAppRef);



    // Verificar si ya está conectado Y en buen estado para esta sesión específica
    if (clientesWhatsapp[agente] && clientesWhatsapp[agente].user && !sesionesConectando[agente]) {
        onStatusUpdate({ type: 'status', data: `✅ WhatsApp sesión del agente '${agente}' ya está listo`, sesion: agente });
        return;
    }

    // Evitar múltiples intentos simultáneos para esta sesión
    if (sesionesConectando[agente]) {
        onStatusUpdate({ type: 'status', data: `⏳ Sesión '${agente}' ya en proceso de conexión...`, sesion: agente  });
        return;
    }

    try {
        sesionesConectando[agente] = true; // Marcar como conectando

        // Crear ruta específica para esta sesión
        const rutaSesiones = path.join(electronAppRef.getPath('userData'), 'sesiones', agente);

        // Crear directorio si no existe
        await fs.mkdir(rutaSesiones, { recursive: true });

        // Configurar autenticación multi-dispositivo para esta sesión específica
        const { state, saveCreds } = await useMultiFileAuthState(rutaSesiones);

        const { version } = await fetchLatestBaileysVersion();

        console.log('la ultima version es: ', version)

        // CONFIGURACIÓN MEJORADA del socket
        const clienteWhatsapp = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: [`WAI: Agente ${agente}`, 'Chrome', '115.0.5790.40'],
            // CONFIGURACIONES CRÍTICAS MEJORADAS:
            connectTimeoutMs: 30000,       // Reducido de 60s a 30s
            defaultQueryTimeoutMs: 30000, // Cambiado de 0 a 30s (0 = sin timeout puede causar problemas)
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            markOnlineOnConnect: false,   // Cambiado a false para evitar problemas
            syncFullHistory: false,
            fireInitQueries: true,
            generateHighQualityLinkPreview: false,
            retryRequestDelayMs: 5000,    // Reducido de 10s a 5s
            maxMsgRetryCount: 3,          // Reducido de 5 a 3
            version: version, //la ultima version
            // NUEVAS CONFIGURACIONES IMPORTANTES:
            shouldIgnoreJid: jid => isJidBroadcast(jid), // Ignorar broadcasts
            getMessage: async (key) => {
                // Función requerida para reenvío de mensajes
                return null; // Implementar según necesidades
            }
        });

        // Asociar cada cliente con su agente
        clienteWhatsapp.agenteId = agente;

        // Almacenar cliente en el objeto de clientes
        clientesWhatsapp[agente] = clienteWhatsapp;

        // Guardar credenciales cuando se actualicen - MEJORADO
        clienteWhatsapp.ev.on('creds.update', async () => {
            try {
                await saveCreds();
                console.log(`✅ Credenciales guardadas exitosamente para sesión '${agente}'`);
            } catch (error) {
                console.error(`❌ Error guardando credenciales para sesión '${agente}':`, error);
                onStatusUpdate({
                    type: 'status',
                    data: `⚠️ Error guardando credenciales sesión '${agente}': ${error.message}` , 
                    sesion: agente 
                });
            }
        });

        // MANEJADOR DE CONEXIÓN MEJORADO
        clienteWhatsapp.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            console.log(`🔄 Connection update para '${agente}':`, { connection, isNewLogin });

            // Manejar QR code
            if (qr) {
                console.log(`📱 Nuevo QR code generado para sesión '${agente}'`);
                qrcode.generate(qr, { small: true });
                onStatusUpdate({ type: 'qr', data: qr, sesion: agente });
                // NO marcamos sesionesConectando[agente] = false aquí, seguimos en proceso
            }

            // Manejar conexión establecida
            if (connection === 'open') {
                sesionesConectando[agente] = false; // ✅ Conexión exitosa
                //console.log(`✅ Conexión WhatsApp establecida para sesión '${agente}'`);

                if (isNewLogin) {
                    onStatusUpdate({ type: 'status', data: `✅ Nueva conexión de WhatsApp sesión '${agente}' establecida`, sesion: agente });
                } else {
                    onStatusUpdate({ type: 'status', data: `✅ WhatsApp sesión '${agente}' ya está listo`, sesion: agente });
                }
            }

            // Manejar estados de conexión
            if (connection === 'connecting') {
                onStatusUpdate({ type: 'status', data: `🔄 Conectando WhatsApp sesión '${agente}'...`, sesion: agente  });
            }

            // MANEJO MEJORADO de desconexión
            if (connection === 'close') {
                sesionesConectando[agente] = false; // Reset del flag

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const errorMessage = lastDisconnect?.error?.message || 'Desconocido';

                //console.log(`❌ Conexión cerrada para '${agente}':`, { statusCode, errorMessage });
                const mensajeLog = `❌ Conexión cerrada para '${agente}': statusCode: ${statusCode}, errorMessage: ${errorMessage}`;
                

                onStatusUpdate({
                    type: 'status',
                    data: `❌ Se ha cerrado la sesión ${agente}`, 
                    sesion: agente 
                });

                // Limpiar la instancia actual del objeto de clientes
                delete clientesWhatsapp[agente];

                // LÓGICA DE RECONEXIÓN MEJORADA
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    // Casos que requieren reconexión automática
                    if (statusCode === DisconnectReason.restartRequired ||
                        statusCode === DisconnectReason.timedOut ||
                        statusCode === DisconnectReason.connectionClosed ||
                        statusCode === DisconnectReason.connectionLost ||
                        errorMessage.includes('restart required') ||
                        errorMessage.includes('Connection Failure')||
                        statusCode === 428 ||
                        statusCode === 503 ||
                        statusCode === 408 ||
                        statusCode === 500
                    
                    ) {

                        onStatusUpdate({ type: 'status', data: `🔄 Empezando conexión sesión '${agente}'...` , sesion: agente });

                        let TiempoReconexion = 25000

                        if (statusCode === 515){
                            TiempoReconexion = 1500
                        }

                        // Esperar antes de reconectar - tiempo reducido
                        setTimeout(async () => {
                            try {
                               // console.log(`🔄 Iniciando conexión automática para sesión '${agente}'...`);
                                await whatsapp(electronAppRef, onStatusUpdateRef, parametrosCargados, agente);
                            } catch (error) {
                                onStatusUpdate({
                                    type: 'status',
                                    data: `❌ Error al reconectar sesión '${agente}': ${error.message}` ,
                                    sesion: agente 
                                });
                            }
                        }, TiempoReconexion); // segun el valor de tiempo de reconexion
                    } else {
                        // Para otros tipos de desconexión, no reconectar automáticamente
                        console.log(`⚠️ No se reintentará la reconexión automática para sesión '${agente}'`);
                    }
                } else {
                    // Logout explícito, limpiar todo
                    console.log(`🚪 Logout detectado para sesión '${agente}', limpiando referencias`);

                    // Limpiar datos de sesión corrupta específica
                    await limpiarSesionCorrompida(agente);

                    // Solo limpiar referencias globales si no hay otras sesiones activas
                    if (Object.keys(clientesWhatsapp).length === 0) {
                        electronAppRef = null;
                        parametrosCargados = null;
                        onStatusUpdateRef = null;
                    }
                }
                await logs.guardar(mensajeLog)
            }
        });

        // RESTO DE MANEJADORES DE EVENTOS (adaptados para múltiples sesiones)
        clienteWhatsapp.ev.on('messages.upsert', async (m) => {
            const mensaje = m.messages[0];

            //console.log("nuevo mensaje cómo llega ", mensaje)

            if (mensaje.key.fromMe) return

            let numero

            //console.log("esto es el remoteJID ", mensaje.key.remoteJid)

            if (isPnUser(mensaje.key.remoteJid)) {
                    // Caso: remitente con número de teléfono (PN)
                    numero = mensaje.key.remoteJid.replace('@s.whatsapp.net', '')
                } else {
                    // Caso: remitente con LID

                    //console.log("tiene un lid esto es el JID: ",mensaje.key.remoteJid )
                    
                    const pn = await clienteWhatsapp.signalRepository.lidMapping.getPNForLID(mensaje.key.remoteJid)


                    if (pn) {
                        numero = pn.replace('@s.whatsapp.net', '').replace(/:\d+$/, '')
                    } else {
                        // No hay PN → usamos el LID directamente
                        numero = mensaje.key.remoteJid
                    }
                }

                // Si por algún motivo no hay número ni LID, salimos
                if (!numero) return

                
                let mensajeProcesado = '';

                // Obtener el agente actual de este cliente
                const agenteActual = clienteWhatsapp.agenteId;

                
                // Procesar diferentes tipos de mensajes
                if (mensaje.message?.conversation) {
                    mensajeProcesado = mensaje.message.conversation;
                    const snippet = mensajeProcesado.length > 30 ? mensajeProcesado.substring(0, 30) + '...' : mensajeProcesado;
                    onStatusUpdate({ type: 'status', data: `💬 [${agenteActual}] Mensaje de Texto de ${numero}: "${snippet}" recibido` , sesion: agente });
                }
                else if (mensaje.message?.extendedTextMessage?.text) {
                    mensajeProcesado = mensaje.message.extendedTextMessage.text;
                    const snippet = mensajeProcesado.length > 30 ? mensajeProcesado.substring(0, 30) + '...' : mensajeProcesado;
                    onStatusUpdate({ type: 'status', data: `💬 [${agenteActual}] Mensaje de Texto de ${numero}: "${snippet}" recibido`, sesion: agente  });
                }
                else if (mensaje.message?.audioMessage) {
                    onStatusUpdate({ type: 'status', data: `🎙️ [${agenteActual}] Mensaje de Audio de ${numero}: Descargando...` , sesion: agente });

                    try {
                        const buffer = await downloadMediaMessage(mensaje, 'buffer', {});
                        const mimetype = mensaje.message.audioMessage.mimetype || 'audio/ogg';

                        onStatusUpdate({ type: 'status', data: `🎙️ [${agenteActual}] Mensaje de Audio de ${numero}: Transcribiendo...`, sesion: agente  });

                        

                        seleccion = global.parametros[agenteActual]?.seleccion || "groq";
                       
                        if (!seleccion) {
                            return
                        }
                        const keyActual = global.parametros[agenteActual][seleccion]?.key || null;

                        if (seleccion === "groq") {
                            const transcripcion = await transcribirGroq(buffer, mimetype, keyActual);
                            mensajeProcesado = transcripcion;
                            onStatusUpdate({ type: 'status', data: `🎙️ [${agenteActual}] Mensaje de Audio de ${numero}: Transcripción: "${mensajeProcesado.substring(0, 30)}..."` , sesion: agente });
                        } else if (seleccion === "openai") {
                            const transcripcion = await transcribirOpen(buffer, mimetype, keyActual );
                            mensajeProcesado = transcripcion;
                            onStatusUpdate({ type: 'status', data: `🎙️ [${agenteActual}] Mensaje de Audio de ${numero}: Transcripción: "${mensajeProcesado.substring(0, 30)}..."` , sesion: agente });
                        } else if (seleccion === "gemini") {
                            const transcripcion = await transcribirGemini(buffer, mimetype, keyActual );
                            mensajeProcesado = transcripcion;
                            onStatusUpdate({ type: 'status', data: `🎙️ [${agenteActual}] Mensaje de Audio de ${numero}: Transcripción: "${mensajeProcesado.substring(0, 30)}..."` , sesion: agente });
                        }
                    } catch (error) {
                        onStatusUpdate({ type: 'status', data: `❌ [${agenteActual}] Mensaje de Audio de ${numero}: Error al transcribir.` , sesion: agente });

                        if (error.message && error.message.includes("Archivo de audio demasiado grande")) {
                            await responder(numero, "Lo siento, el audio es demasiado grande, Por favor, envía un audio más corto o un mensaje de texto.", clienteWhatsapp);
                        } else if (error.message && error.message.includes("Tipo de archivo de audio no soportado")) {
                            await responder(numero, "Lo siento, el formato de este audio no es compatible. Por favor, envía un audio en una nota de audio o un mensaje de texto.", clienteWhatsapp);
                        } else {
                            await responder(numero, "Lo siento, no pude escuchar tu audio. Por favor, intenta de nuevo o envía un mensaje de texto.", clienteWhatsapp);
                        }
                        return;
                    }
                }

                else if (mensaje.message?.imageMessage) {
                    onStatusUpdate({ type: 'status', data: `🖼️ [${agenteActual}] Mensaje de Imagen de ${numero}: Descargando...` , sesion: agente });

                    try {
                        const buffer = await downloadMediaMessage(mensaje, 'buffer', {});
                        const mimetype = mensaje.message.imageMessage.mimetype || 'image/jpeg';

                        onStatusUpdate({ type: 'status', data: `🖼️ [${agenteActual}] Mensaje de Imagen de ${numero}: Guardando...`, sesion: agente  });


                        // 1. Define la ruta del directorio de imágenes
                        const dirImagenes = path.join(electronAppRef.getPath('userData'), 'imagenes');

                        // 2. Asegúrate de que el directorio exista. Créalo si no es así.
                        await fs.mkdir(dirImagenes, { recursive: true });

                        
                        // Aquí puedes guardar la imagen 
                        const rutaImagen = path.join(electronAppRef.getPath('userData'), 'imagenes', `${numero}.jpg`);
                        await fs.writeFile(rutaImagen, buffer);

                        
                        onStatusUpdate({ type: 'status', data: `🖼️ [${agenteActual}] Mensaje de Imagen de ${numero}: Guardada. ` , sesion: agente });

                        // Logica para Procesar la imagen
                        procesarImagen(rutaImagen, agenteActual, numero, clienteWhatsapp);

                    } catch (error) {
                        onStatusUpdate({ type: 'status', data: `❌ [${agenteActual}] Error al descargar imagen de ${numero}.`, sesion: agente  });
                        return;
                    }
                }
                    
                else {
                    // Otros tipos de mensajes (imágenes, videos, documentos, etc.)
                    const messageType = Object.keys(mensaje.message || {})[0];
                    onStatusUpdate({ type: 'status', data: `ℹ️ [${agenteActual}] Mensaje de ${numero}: Tipo '${messageType}' ignorado (Confirmación de lectura).`, sesion: agente  });
                    return;
                }

                //AQÍ VA SI HAY MENSAJE INICIAL Y EL CLIENTE ESTA ACTIVO

                let clienteActual = await getClientes(agenteActual, numero)

                if (clienteActual === null) {
                        // Cliente no existe
                        console.log("Cliente no existe");

                        let mensajeInicial =  await getMensajeInicial(agente);

                        // Agregar fecha actual al guardar el cliente en formato legible
                        const fechaActual = new Date().toLocaleString('es-ES');
                        await saveClientes(numero, agenteActual, true, "cliente", "Nuevo", "#adc9e7", fechaActual)
                        console.log("guardado el cliente con fecha:", fechaActual);

                        clienteActual = await getClientes(agenteActual, numero)

                        console.log("aqui paso 1")

                        console.log(mensajeInicial)
                        console.log("aqui paso 2")

                        if (mensajeInicial.activo){
                                //mensaje de incio activo
                            console.log("El mensaje de incio está activo")
                            const group = mensajeInicial.mensaje                   
                            
                            const mediaFilesToSend = group.files ? group.files.map(file => ({
                                name: file.name,
                                path: file.path,
                                type: file.type
                            })) : [];

                            const delay = Math.floor(Math.random() * (10000 - 7000 + 1)) + 7000;
                            console.log(`Esperando ${delay} ms antes de enviar el mensaje...`);
                            await new Promise(resolve => setTimeout(resolve, delay));

                            await responder(numero, group.text, clienteWhatsapp, mediaFilesToSend);

                            onStatusUpdate({ type: 'status', data: `✅ Agente ${agenteActual}: Mensaje inicial enviado a ${numero}.`, sesion: agente  });
                            
                            return;

                            }                        
                    };

                    console.log("Valor de clienteActual:", clienteActual, "Tipo:", typeof clienteActual);
                
                if (!clienteActual){
                    console.log("Cliente desactivado")
                    return
                };

                // Si no hay contenido procesado, salir
                if (!mensajeProcesado) {
                    return;
                }

                // Lógica: Verificar mensajes predeterminados
                const normalizedMessage = normalizeText(mensajeProcesado);
                const predeterminedMessages = getPredeterminedMessages(agente);
                

                let matchedPredetermined = false;
                for (const keyId in predeterminedMessages) {
                    const group = predeterminedMessages[keyId];
                    const normalizedKeywords = group.keywords.map(kw => normalizeText(kw));

                    const keywordMatch = normalizedKeywords.some(nk => normalizedMessage.includes(nk));

                    if (keywordMatch) {
                        onStatusUpdate({ type: 'status', data: `✅ Agente ${agenteActual}: Plabra clave encontrada. Mensaje predeterminado enviado a ${numero}.`, sesion: agente  });

                        const mediaFilesToSend = group.files ? group.files.map(file => ({
                            name: file.name,
                            path: file.path,
                            type: file.type
                        })) : [];

                        seleccion = global.parametros[agenteActual]?.seleccion || "groq";

                        //Guarda y consulta el ultimo mensaje para que no se repita los mensajes
                        const ultimoMensajeCrudo = obtenerUltimoMensaje(numero, agente);
                        console.log(ultimoMensajeCrudo)
                        if (ultimoMensajeCrudo === normalizedMessage) {
                            
                            return;
                        }
                        guardarUltimoMensaje(numero, normalizedMessage, agente);

                        const delay = Math.floor(Math.random() * (10000 - 7000 + 1)) + 7000;
                        console.log(`Esperando ${delay} ms antes de enviar el mensaje...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        await responder(numero, group.text, clienteWhatsapp, mediaFilesToSend);

                        matchedPredetermined = true;
                        break;
                    }
                }

                if (matchedPredetermined) {
                    return;
                }

                // Si no hubo coincidencia con mensajes predeterminados, procesar con listador
                try {
                    console.log ("se envia a listador")
                    await listador(numero, mensajeProcesado, clienteWhatsapp, agenteActual, seleccion);
                } catch (e) {
                    onStatusUpdate({ type: 'status', data: `❌ [${agenteActual}] Error procesando mensaje de ${numero}.`, sesion: agente  });
                    //await responder(numero, "En este momento no estamos disponibles", clienteWhatsapp);
                }
            
        });

    } catch (authError) {
        sesionesConectando[agente] = false; // Reset del flag en caso de error
        console.error(`❌ Error de autenticación para sesión '${agente}':`, authError);
        onStatusUpdate({
            type: 'status',
            data: `❌ Error de autenticación sesión '${agente}': ${authError.message}`,
            sesion: agente 
        });
        throw authError;
    }

    return `Solicitud de inicio recibida para sesión '${agente}'.`;
}

// FUNCIÓN MODIFICADA: Cerrar sesión específica
async function cerrarWhatsapp(agente = 'agente1', forceLogout = false) {
    if (clientesWhatsapp[agente]) {
        try {
            sesionesConectando[agente] = false; // Reset del flag

            if (forceLogout) {
                // Solo hacer logout si se solicita explícitamente
                console.log(`🚪 Cerrando sesión de WhatsApp '${agente}'...`);
                await clientesWhatsapp[agente].logout();
            } else {
                // Solo cerrar la conexión sin logout
                console.log(`🔌 Cerrando conexión (manteniendo sesión) '${agente}'...`);
                await clientesWhatsapp[agente].end(undefined); // Cierra sin error específico
            }
        } catch (error) {
            console.error(`Error al cerrar cliente '${agente}':`, error);
            // Si hay error, forzar cierre directo
            if (clientesWhatsapp[agente].ws) {
                clientesWhatsapp[agente].ws.close();
            }
        } finally {
            delete clientesWhatsapp[agente];
            delete sesionesConectando[agente];

            // Solo limpiar referencias globales si no hay otras sesiones activas
            if (Object.keys(clientesWhatsapp).length === 0) {
                electronAppRef = null;
                parametrosCargados = null;
                onStatusUpdateRef = null;
            }
        }
    }
}

// FUNCIÓN NUEVA: Cerrar sesión específica explícitamente
async function cerrarSesionWhatsapp(agente = 'agente1') {
    await clientesWhatsapp[agente].logout();
    return await cerrarWhatsapp(agente, true); // Forzar logout
}

// FUNCIÓN NUEVA: Cerrar todas las sesiones
async function cerrarTodasLasSesiones(forceLogout = false) {
    const sesiones = Object.keys(clientesWhatsapp);

    for (const agente of sesiones) {
        try {
            await cerrarWhatsapp(agente, forceLogout);
        } catch (error) {
            console.error(`Error cerrando sesión '${agente}':`, error);
        }
    }

    // Limpiar todo
    clientesWhatsapp = {};
    sesionesConectando = {};
    electronAppRef = null;
    parametrosCargados = null;
    onStatusUpdateRef = null;
}

// FUNCIÓN NUEVA: Obtener cliente WhatsApp específico
function obtenerClienteWhatsapp(agente = "1") {
    return clientesWhatsapp[agente] || null;
}

// FUNCIÓN NUEVA: Obtener estado de todas las sesiones
function obtenerEstadoSesiones() {
    const sesiones = {};

    for (const [nombre, cliente] of Object.entries(clientesWhatsapp)) {
        sesiones[nombre] = {
            conectado: cliente && cliente.user ? true : false,
            conectando: sesionesConectando[nombre] || false,
            numeroTelefono: cliente && cliente.user ? cliente.user.id.split(':')[0] : null
        };
    }

    return sesiones;
}

// FUNCIÓN AUXILIAR
function isJidBroadcast(jid) {
    return jid === 'status@broadcast';
}

module.exports = {
    whatsapp,
    cerrarWhatsapp,
    cerrarSesionWhatsapp,
    cerrarTodasLasSesiones,
    obtenerEstadoSesiones,
    obtenerSesionesDisponibles,
    limpiarSesionCorrompida,
    obtenerClienteWhatsapp
};