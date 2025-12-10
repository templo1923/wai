const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const https = require('https');
const { v4: uuidv4 } = require('uuid');

const { whatsapp, cerrarWhatsapp, cerrarSesionWhatsapp } = require('./app');
const { inicializarGuardado } = require('./guardado');
const {inicializarFiltros, filtros} = require('./filtros')
const { inicializarMensajesPredeterminados, savePredeterminedMessage, getPredeterminedMessages, deletePredeterminedMessage } = require('./mensajesPredeterminados');
const { inicializarMensajes, saveMensajeInicial, getMensajeInicial} = require('./inicio.js');
const { inicializarClientes,saveClientes, getClientes, getTotalClientes  } = require('./clientes.js');
const {  inicializarMensajeImagen, saveMensajeImagen, getMensajeImagen} = require('./imagenMensajes.js')
const { saveMensajeRemarketing, getMensajeRemarketing, guardarActivo, iniciarRemarketingAutomatico, remarketingMensajes} = require('./remarketing.js');
const logs = require('./logs');
const { get } = require('http');

let ventanaPrincipal;
let rutaParametros;
let parametrosCargados = null;

let agente ="1"

let seleccion ="groq"

const agenteWhatsApp = {
    "1": { 
            type: 'status', 
            data: '✅ Haz clic en "Iniciar WhatsApp" para activar el agente (recuerda haber ajustado el contexto si es necesario).' 
            },
    "2": {type: 'status', 
            data: '✅ Haz clic en "Iniciar WhatsApp" para activar el agente (recuerda haber ajustado el contexto si es necesario).' 
            },
    "3": {type: 'status', 
            data: '✅ Haz clic en "Iniciar WhatsApp" para activar el agente (recuerda haber ajustado el contexto si es necesario).' 
            },
    "4": {type: 'status', 
            data: '✅ Haz clic en "Iniciar WhatsApp" para activar el agente (recuerda haber ajustado el contexto si es necesario).' 
            },
    "5": {type: 'status', 
            data: '✅ Haz clic en "Iniciar WhatsApp" para activar el agente (recuerda haber ajustado el contexto si es necesario).' 
            }
}

const APP_VERSION = '5.1205';
const VERSION_URL = 'https://artechclick.com/wai-info/version/';
const DOWNLOAD_URL = 'https://artechclick.com/wai-info/descargar/';

function crearVentana() {
    ventanaPrincipal = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'Agente IA WhatsApp',
        icon: path.join(__dirname, './icon.ico'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js'),
            devTools: true,
            webSecurity: false
        },
        show: false
    });

    ventanaPrincipal.loadFile(path.join(__dirname, './build/index.html'));

    ventanaPrincipal.once('ready-to-show', () => {
        ventanaPrincipal.show();
    });

    ventanaPrincipal.on('closed', () => {
        ventanaPrincipal = null;
    });

    ventanaPrincipal.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    ventanaPrincipal.webContents.on('context-menu', (event, params) => {
        const menuContextual = Menu.buildFromTemplate([
            { role: 'undo', label: 'Deshacer' },
            { role: 'redo', label: 'Rehacer' },
            { type: 'separator' },
            { role: 'cut', label: 'Cortar' },
            { role: 'copy', label: 'Copiar' },
            { role: 'paste', label: 'Pegar' },
            { type: 'separator' },
            { role: 'selectAll', label: 'Seleccionar todo' }
        ]);
        menuContextual.popup(ventanaPrincipal);
    });
}

function crearMenu() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                { role: 'quit', label: 'Salir' }
            ]
        },
        {
            label: 'Edición',
            submenu: [
                { 
                    role: 'undo', 
                    label: 'Deshacer',
                    accelerator: 'CmdOrCtrl+Z'
                },
                { 
                    role: 'redo', 
                    label: 'Rehacer',
                    accelerator: 'CmdOrCtrl+Y'
                },
                { type: 'separator' },
                { 
                    role: 'cut', 
                    label: 'Cortar',
                    accelerator: 'CmdOrCtrl+X'
                },
                { 
                    role: 'copy', 
                    label: 'Copiar',
                    accelerator: 'CmdOrCtrl+C'
                },
                { 
                    role: 'paste', 
                    label: 'Pegar',
                    accelerator: 'CmdOrCtrl+V'
                },
                { role: 'delete', label: 'Eliminar' },
                { 
                    role: 'selectAll', 
                    label: 'Seleccionar todo',
                    accelerator: 'CmdOrCtrl+A'
                }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { role: 'minimize', label: 'Minimizar' },
                { role: 'zoomIn', label: 'Acercar' },
                { role: 'zoomOut', label: 'Alejar' },
                { role: 'resetZoom', label: 'Restablecer zoom' },
                { type: 'separator' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Creado por artechclick.com',
                    click: async () => {
                        await shell.openExternal('https://artechclick.com/');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

app.on('web-contents-created', (event, contents) => {
    contents.on('will-navigate', (navigationEvent, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        
        if (parsedUrl.protocol !== 'file:') {
            navigationEvent.preventDefault();
        }
    });
});

async function copiarArchivoSiNoExiste(origen, destino) {
    try {
        await fs.access(destino);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(path.dirname(destino), { recursive: true });
            await fs.copyFile(origen, destino);
        } else {
            throw error;
        }
    }
}

async function cargarParametros() {
    if (!rutaParametros) {
        throw new Error("Ruta de parámetros no definida.");
    }
    try {
        const data = await fs.readFile(rutaParametros, 'utf-8');
        const fechaActual = new Date().toLocaleString('es-ES');
        console.log('Contenido del archivo:', data, 'Fecha de carga:', fechaActual); // Ver qué contiene
        parametrosCargados = JSON.parse(data);


        if (parametrosCargados[agente].seleccion === undefined) parametrosCargados[agente].seleccion = "groq";
        seleccion = parametrosCargados[agente].seleccion; //Aquí asignamos la selección del agente
        console.log('Selección del agente:', seleccion);

                // AGREGAR ESTA VERIFICACIÓN AQUÍ ↓↓↓
        if (!parametrosCargados[agente][seleccion]) {
            parametrosCargados[agente][seleccion] = {};
        }               
                // Ahora sí puedes asignar propiedades
        if (parametrosCargados[agente][seleccion].key === undefined) {
            parametrosCargados[agente][seleccion].key = " Sin configurar";
        }
        if (parametrosCargados[agente][seleccion].contexto === undefined) {
            parametrosCargados[agente][seleccion].contexto = "respondes que en este momento no estás disponible";
        }
        
        if (parametrosCargados.condiciones === undefined) parametrosCargados.condiciones = false;
        if (parametrosCargados[agente].activo === undefined) parametrosCargados[agente].activo = false;

        consultarEquipo();

    } catch (error) {
        if (error.code === 'ENOENT') {
            parametrosCargados = {
                
                condiciones: false
                
            };
            try {
                await fs.writeFile(rutaParametros, JSON.stringify(parametrosCargados, null, 2), 'utf-8');
            } catch (writeError) {
                console.error('Error al crear parametros.json:', writeError);
            }
        } else {
            console.error('Error específico:', error.message);
            throw new Error('No se pudo cargar el archivo de parámetros.');
        }
    }
}

async function guardarParametrosEnDisco() {
    try {
        const dataToSave = JSON.stringify(parametrosCargados, null, 2);
        await fs.writeFile(rutaParametros, dataToSave, 'utf-8');
    } catch (error) {
        throw error;
    }
}

async function guardarGlobal() {
    try {
        global.parametros = parametrosCargados;
    } catch (error) {
        throw error;
    }
}


//sin autologin

app.whenReady().then(async () => {
    rutaParametros = path.join(app.getPath('userData'), 'parametros.json');

    const parametrosOrigen = path.join(__dirname, 'parametros.json');
    await copiarArchivoSiNoExiste(parametrosOrigen, rutaParametros);

    borrarCache(); 
    setInterval(async () => {
        await borrarCache();
    }, 1800000);

    await cargarParametros();
    await inicializarGuardado(app);
    await inicializarMensajesPredeterminados(app);
    await inicializarMensajes(app);
    await inicializarClientes(app);
    await inicializarFiltros(app);
    await inicializarMensajeImagen(app);
    await logs.inicializar(app);
    
    // Inicializar remarketing
    
    await remarketingMensajes(app);

    await iniciarRemarketingAutomatico();

    crearVentana();
    crearMenu();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            crearVentana();
        }
    });
});

app.on('window-all-closed', async () => {
    
    await cerrarWhatsapp(agente);
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

process.on('SIGINT', async () => {
   
    await cerrarWhatsapp(agente);
    app.quit();
});

async function borrarCache() {
    const cacheApp = path.join(app.getPath('userData'), 'Cache');
    
    try {
        await fs.access(cacheApp);
        await fs.rm(cacheApp, { recursive: true, force: true });
        console.log('✅ Cache borrado exitosamente');
        return '✅ Cache borrado exitosamente.';
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️ La carpeta Cache no existe');
            return 'Cache no existe o ya fue borrado.';
        } else {
            console.error('❌ Error al borrar cache:', error);
            throw new Error('❌ Error al borrar cache.');
        }
    }
}




//Agente estado enviar

function agenteEstado() {
    console.log(`tipo: ${agenteWhatsApp[agente].type}`)
    if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
        ventanaPrincipal.webContents.send('whatsapp-status-update', agenteWhatsApp[agente]);
    }
}

agenteEstado()



//FUNCION DE EQUIPO CONSULTA

async function consultarEquipo() {
  // Verificación básica (la dejamos igual para no romper nada)
  if (!parametrosCargados) {
    console.log("parametrosCargados no está inicializado");
    return { ok: false, error: "Parámetros no inicializados" };
  }

  // --- INICIO DEL BYPASS ---
  console.log("🔓 BYPASS ACTIVADO: Simulando licencia válida...");

  // Creamos una respuesta falsa que activa todo
  const dataHack = {
      ok: true,
      mensaje: "Licencia Ilimitada Activada",
      plan: "Empresarial", // Nos inventamos un plan PRO
      estado: "activo", 
      fecha_vencimiento: "2099-12-31", // Licencia de por vida
      mensajes_diarios: 999999
  };

  // Inyectamos la data falsa en la configuración
  parametrosCargados.activa = dataHack;
  
  // Guardamos en el disco para que el programa "recuerde" que es PRO
  await guardarParametrosEnDisco();
  await guardarGlobal();
  
  console.log("✅ Equipo validado exitosamente (Local):", dataHack);
  
  // Mantenemos el ciclo de ejecución para que no falle la lógica interna
  setTimeout(() => consultarEquipo(), 3600000);
  
  return { ok: true, data: dataHack };
  // --- FIN DEL BYPASS ---
}




// MANEJADORES IPC

ipcMain.handle('check-for-updates', async () => {
    const localVersion = parseFloat(APP_VERSION);
    
    return new Promise((resolve) => {
        https.get(VERSION_URL, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const remoteVersionMatch = data.match(/<body>\s*([\d.]+)\s*<\/body>/i);
                    const remoteVersionString = remoteVersionMatch ? remoteVersionMatch[1] : null;

                    if (remoteVersionString) {
                        const remoteVersion = parseFloat(remoteVersionString);

                        if (remoteVersion > localVersion) {
                            resolve({ updateAvailable: true, latestVersion: remoteVersionString, downloadUrl: DOWNLOAD_URL });
                        } else {
                            resolve({ updateAvailable: false, latestVersion: remoteVersionString });
                        }
                    } else {
                        resolve({ updateAvailable: false, error: 'Error al obtener la versión remota.' });
                    }
                } catch (error) {
                    resolve({ updateAvailable: false, error: 'Error al procesar la versión remota.' });
                }
            });
        }).on('error', (error) => {
            resolve({ updateAvailable: false, error: 'Error al conectar con el servidor de versión.' });
        });
    });
});

// MODIFICADO: Handler de WhatsApp con control de instancia única
ipcMain.handle('ejecutar-whatsapp', async (evento) => {
    // NUEVO: Verificar si ya está en proceso

     

    try {
        
        
        const onStatusUpdate = (update) => {

            console.log(`DESDE ESTATUS tipo: ${update.type}`)
            agenteWhatsApp[update.sesion]=update;
            if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
                agenteEstado()
                // Reset flag cuando se conecta exitosamente o falla definitivamente
                if (update.type === 'status') {
                    if (update.data.includes('✅ WhatsApp listo') || 
                        update.data.includes('❌ Error:') ||
                        update.data.includes('logout')) {
                        
                    }
                }
            }
        };

        
        const mensajeInicial = await whatsapp(app, onStatusUpdate, parametrosCargados, agente);
        return mensajeInicial;

    } catch (error) {
        
        if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
            ventanaPrincipal.webContents.send('whatsapp-status-update', { 
                type: 'status', 
                data: `❌ Error: ${error.message}` 
            });
        }
        throw error;
    }
});

// Handler de cerrar con control de instancia
ipcMain.handle('cerrar-whatsapp', async (evento) => {
    try {
        
        await cerrarWhatsapp(agente, false); // false = no hacer logout
        return '✅ WhatsApp cerrado';
    } catch (error) {
        throw new Error('❌ Error al cerrar cliente.');
    }
});

// NUEVO: Handler para cerrar sesión explícitamente
ipcMain.handle('cerrar-sesion-whatsapp', async (evento) => {
    try {
        
        await cerrarSesionWhatsapp(agente); // Hacer logout completo
        return '✅ Sesión de WhatsApp Eliminada';
    } catch (error) {
        throw new Error('❌ Error al cerrar sesión.');
    }
});

// MODIFICADO: Handler de reiniciar con control de instancia
ipcMain.handle('reiniciar-whatsapp', async (evento) => {
    const rutaSesiones = path.join(app.getPath('userData'), 'sesiones', agente);

    try {
        
        
        if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
            ventanaPrincipal.webContents.send('whatsapp-status-update', { 
                type: 'status', 
                data: '🔌 Cerrando cliente WhatsApp...' 
            });
        }
        
        await cerrarWhatsapp(agente);
        
        // Esperar un momento antes de borrar sesiones
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
            await fs.access(rutaSesiones);
            if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
                ventanaPrincipal.webContents.send('whatsapp-status-update', { 
                    type: 'status', 
                    data: '🗑️ Borrando sesiones...' 
                });
            }
            await fs.rm(rutaSesiones, { recursive: true, force: true });
        } catch (accessError) {
            if (accessError.code === 'ENOENT') {
                console.log('ℹ️ La carpeta de sesiones no existe');
                if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
                    ventanaPrincipal.webContents.send('whatsapp-status-update', { 
                        type: 'status', 
                        data: '✅ Sesión reiniciada.'
                    });
                }
                return 'La sesión borrada';
            } else {
                throw accessError;
            }
        }

        return '✅ Sesión reiniciada.';

    } catch (error) {
        if (ventanaPrincipal && !ventanaPrincipal.isDestroyed()) {
            ventanaPrincipal.webContents.send('whatsapp-status-update', { 
                type: 'status', 
                data: `❌ Error al reiniciar: ${error.message}` 
            });
        }
        throw new Error('❌ Error al reiniciar sesión.');
    }
});

// [Resto de handlers IPC sin cambios...]

ipcMain.handle('get-contexto', async () => {
    console.log('📋 Obteniendo contexto...');
    const contexto = global.parametros[agente]?.[seleccion]?.contexto;
    if (contexto !== undefined) {
        return contexto || "respondes que en este momento no estás disponible";
    } else {
        return "respondes que en este momento no estás disponible";
    }
});

ipcMain.handle('save-contexto', async (evento, nuevoContexto) => {
    if (typeof nuevoContexto !== 'string' || nuevoContexto.trim() === '') {
        throw new Error('El contexto no puede estar vacío.');
    }
    if (nuevoContexto.length > 15000) {
        throw new Error('El contexto no puede exceder los 10,000 caracteres.');
    }

    try {

                // AGREGAR ESTA VERIFICACIÓN ↓↓↓
        if (!parametrosCargados[agente][seleccion]) {
            parametrosCargados[agente][seleccion] = {};
        }

        parametrosCargados[agente][seleccion].contexto = nuevoContexto;
        await guardarParametrosEnDisco();
        await guardarGlobal();
        return '✅ Contexto guardado.';
    } catch (error) {
        throw new Error('❌ Error al guardar contexto.');
    }
});

ipcMain.handle('get-key', async () => {
    console.log('📋 Obteniendo API Key...');
    const key = parametrosCargados?.[agente]?.[seleccion]?.key;
    
    return key || "Aún no has configurado la API Key";
});
    


ipcMain.handle('save-key', async (evento, nuevaKey) => {
    console.log('💾 Guardando API Key:', nuevaKey);
    if (typeof nuevaKey !== 'string' || nuevaKey.trim() === '') {
        throw new Error('La Key no puede estar vacía.');
    }
    console.log('Agente:', agente, 'Selección:', seleccion);

    try {
        // AGREGAR ESTA VERIFICACIÓN ↓↓↓
        if (!parametrosCargados[agente][seleccion]) {
            parametrosCargados[agente][seleccion] = {};
        }
        
        parametrosCargados[agente][seleccion].key = nuevaKey;
        await guardarParametrosEnDisco();
        await guardarGlobal();

        console.log('✅ Key guardada:', nuevaKey, 'agente:', agente, 'selección:', seleccion);
        return '✅ Key guardada.';
    } catch (error) {
        throw new Error('❌ Error al guardar Key.', error);
    }
});

ipcMain.handle('get-condiciones', async () => {
    console.log('📋 Obteniendo estado de condiciones...');
    if (parametrosCargados && parametrosCargados.condiciones !== undefined) {
        console.log('✅ Condiciones cargadas:', parametrosCargados.condiciones);
        return parametrosCargados.condiciones;
    } else {
        console.log('⚠️ No se encontraron condiciones, devolviendo false por defecto');
        return false;
    }
});

ipcMain.handle('save-condiciones', async (evento, estadoCondiciones) => {
    console.log('💾 Guardando estado de condiciones:', estadoCondiciones);
    
    if (typeof estadoCondiciones !== 'boolean') {
        throw new Error('El estado de condiciones debe ser un valor booleano (true/false).');
    }

    try {
        parametrosCargados.condiciones = estadoCondiciones;
        await guardarParametrosEnDisco();
        await guardarGlobal();
        console.log('✅ Estado de condiciones guardado exitosamente');
        return '✅ Estado de condiciones guardado.';
    } catch (error) {
        console.error('❌ Error al guardar estado de condiciones:', error);
        throw new Error('❌ Error al guardar el estado de condiciones.');
    }
});

ipcMain.handle('restart-app', async () => {
    app.relaunch();
    app.quit();
});

ipcMain.handle('open-external-link', async (event, url) => {
    try {
        await shell.openExternal(url);
    } catch (error) {
        throw new Error('No se pudo abrir el enlace externo.');
    }
});

ipcMain.handle('open-download-link', async (event, url) => {
    try {
        await shell.openExternal(url);
    } catch (error) {
        throw new Error('No se pudo abrir el enlace de descarga.');
    }
});

ipcMain.handle('save-predetermined-message', async (event, messageData) => {
    try {
        const mediaDir = path.join(app.getPath('userData'), 'predetermined_media');
        await fs.mkdir(mediaDir, { recursive: true });

        const processedFiles = [];
        for (const file of messageData.files) {
            if (file.arrayBuffer) {
                const uniqueFileName = `${uuidv4()}-${file.name}`;
                const destPath = path.join(mediaDir, uniqueFileName);
                try {
                    await fs.writeFile(destPath, Buffer.from(file.arrayBuffer));
                    processedFiles.push({ name: file.name, path: destPath, type: file.type });
                } catch (writeError) {
                    throw new Error(`Error al guardar el archivo ${file.name}: ${writeError.message}`);
                }
            } else {
                throw new Error(`El archivo ${file.name} no contiene datos válidos.`);
            }
        }
        messageData.files = processedFiles;

        await savePredeterminedMessage(messageData, agente);
        return { success: true };
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('get-predetermined-messages', async () => {
    try {
        return getPredeterminedMessages(agente);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('delete-predetermined-message', async (event, keyId) => {
    try {
        const messages = getPredeterminedMessages(agente);
        const messageToDelete = messages[keyId];

        if (messageToDelete && messageToDelete.files && messageToDelete.files.length > 0) {
            for (const file of messageToDelete.files) {
                try {
                    await fs.unlink(file.path);
                } catch (unlinkError) {
                    if (unlinkError.code !== 'ENOENT') {
                        console.error('Error eliminando archivo:', unlinkError);
                    }
                }
            }
        }

        await deletePredeterminedMessage(keyId,agente);
        return { success: true };
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('borrar-cache', async () => {
    try {
        return await borrarCache();
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('show-message-box', async (event, options) => {
    const result = await dialog.showMessageBox(BrowserWindow.getFocusedWindow(), {
        type: options.type || 'info',
        title: options.title || 'Información',
        message: options.message || '',
        buttons: options.buttons || ['OK'],
        defaultId: options.defaultId || 0,
        cancelId: options.cancelId
    });
    
    return result;
});

ipcMain.handle('get-activo', async () => {
    console.log('📋 Obteniendo estado activo...');
    if (parametrosCargados && parametrosCargados[agente].activo !== undefined) {
        console.log('✅ Estado activo cargado:', parametrosCargados[agente].activo);
        return parametrosCargados[agente].activo;
    } else {
        console.log('⚠️ No se encontró estado activo, devolviendo false por defecto');
        return false;
    }
});

ipcMain.handle('toggle-activo', async () => {
    console.log('🔄 Alternando estado activo...');
    
    try {
        if (parametrosCargados[agente].activo === undefined) {
            parametrosCargados[agente].activo = false;
        }
        
        const estadoAnterior = parametrosCargados[agente].activo;
        parametrosCargados[agente].activo = !parametrosCargados[agente].activo;
        
        await guardarParametrosEnDisco();
        await guardarGlobal();
        
        console.log(`✅ Estado activo cambiado de ${estadoAnterior} a ${parametrosCargados[agente].activo}`);
        return {
            success: true,
            nuevoEstado: parametrosCargados[agente].activo,
            mensaje: `Estado ${parametrosCargados[agente].activo ? 'activado' : 'desactivado'} correctamente.`
        };
    } catch (error) {
        console.error('❌ Error al alternar estado activo:', error);
        throw new Error('❌ Error al cambiar el estado activo.');
    }
});

ipcMain.handle('set-activo', async (evento, nuevoEstado) => {
    console.log('💾 Estableciendo estado activo a:', nuevoEstado);
    
    if (typeof nuevoEstado !== 'boolean') {
        throw new Error('El estado activo debe ser un valor booleano (true/false).');
    }

    try {
        parametrosCargados[agente].activo = nuevoEstado;
        await guardarParametrosEnDisco();
        await guardarGlobal();
        console.log('✅ Estado activo establecido exitosamente a:', nuevoEstado);
        return {
            success: true,
            nuevoEstado: nuevoEstado,
            mensaje: `Estado ${nuevoEstado ? 'activado' : 'desactivado'} correctamente.`
        };
    } catch (error) {
        console.error('❌ Error al establecer estado activo:', error);
        throw new Error('❌ Error al establecer el estado activo.');
    }
});

ipcMain.handle('agente-valor', async (evento, AgenteN) => {
    agente = String(AgenteN);
    seleccion = parametrosCargados[agente].seleccion || "groq";
    console.log('Agente seleccionado:', agente, 'con selección:', seleccion);
    return agente;
});

ipcMain.handle('get-agente', async () => {
    agenteEstado();
    return agente;
});

//mensaje incial FALTAN LOS PRELOAD

ipcMain.handle('get-mensaje-inicial', async () => {
    try {
        return getMensajeInicial(agente);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('save-mensaje-inicial', async (evento, messageData, activo) => {
    console.log('💾 Guardando mensaje inicial para agente:', agente);
    console.log('📝 Datos del mensaje:', messageData);
    console.log('🔄 Estado activo:', activo);
    
    try {
        // Validar que los datos no estén vacíos
        if (!messageData || (typeof messageData === 'string' && messageData.trim() === '')) {
            throw new Error('El mensaje inicial no puede estar vacío.');
        }

        // Procesar archivos si existen
        if (messageData.files && messageData.files.length > 0) {
            const mediaDir = path.join(app.getPath('userData'), 'mensaje_inicial_media');
            await fs.mkdir(mediaDir, { recursive: true });

            const processedFiles = [];
            
            for (const file of messageData.files) {
                // Si el archivo ya tiene path, es un archivo existente, no lo proceses
                if (file.path) {
                    processedFiles.push(file);
                } else if (file.arrayBuffer) {
                    // Solo procesar archivos nuevos que tienen arrayBuffer
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const uniqueFileName = `${timestamp}-${randomNum}-${file.name}`;
                    const destPath = path.join(mediaDir, uniqueFileName);
                    
                    try {
                        await fs.writeFile(destPath, Buffer.from(file.arrayBuffer));
                        processedFiles.push({ name: file.name, path: destPath, type: file.type });
                    } catch (writeError) {
                        throw new Error(`Error al guardar el archivo ${file.name}: ${writeError.message}`);
                    }
                } else {
                    throw new Error(`El archivo ${file.name} no contiene datos válidos.`);
                }
            }
            messageData.files = processedFiles;
        }

        // Guardar el mensaje inicial usando tu función existente
        await saveMensajeInicial(messageData, agente, activo);
        
        console.log('✅ Mensaje inicial guardado exitosamente');
        return {
            success: true,
            mensaje: '✅ Mensaje inicial guardado exitosamente.'
        };
    } catch (error) {
        console.error('❌ Error al guardar mensaje inicial:', error);
        throw new Error(`❌ Error al guardar mensaje inicial: ${error.message}`);
    }
});

ipcMain.handle('get-clientes', async () => {
    try {
        return await getClientes(agente);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('get-total-clientes', async () => {
    try {
        return await getTotalClientes(agente);
    } catch (error) {
        throw error;
    }
});


ipcMain.handle('save-clientes', async (evento, numero, agente = "1", activo = true, nombre = "cliente", etiqueta = "Registrado 🤖", color = "#adc9e7") => {
    console.log('💾 Guardando mensaje inicial para agente:', agente);
    
    try {
        // Validar que el número no esté vacío
        if (!numero || (typeof numero === 'string' && numero.trim() === '')) {
            throw new Error('El número no puede estar vacío.');
        }
        // Guardar el mensaje inicial usando tu función existente
        await saveClientes(numero, agente, activo, nombre, etiqueta, color);
        
        console.log('✅ Mensaje inicial guardado exitosamente');
        return {
            success: true,
            mensaje: '✅ Mensaje inicial guardado exitosamente.'
        };
    } catch (error) {
        console.error('❌ Error al guardar cliente:', error);
        throw new Error(`❌ Error al guardar cliente: ${error.message}`);
    }
});

//GUARDAR PARAMETROS DE CUENTA:
ipcMain.handle('save-cuenta', async (evento, correo, clave, equipo) => {
    try {
        console.log(`🔓 Intento de login con: ${correo} (Bypass aceptado)`);

        // Guardamos los datos que metió el usuario (aunque sean falsos)
        parametrosCargados.cuenta = {
            "correo": correo,
            "clave": clave,
            "equipo": equipo
        };
        
        // Forzamos la activación inmediata
        parametrosCargados.activa = { 
            ok: true, 
            estado: "activo",
            plan: "Empresarial" 
        };

        await guardarParametrosEnDisco();
        await guardarGlobal();
        
        // Llamamos a nuestra función hackeada para confirmar todo
        await consultarEquipo(); 

        console.log('✅ Cuenta guardada y activada localmente.');
        return true; // Decimos "TRUE" (Éxito) sin preguntar a internet

    } catch (error) {
        console.error('Error en save-cuenta:', error);
        return false;
    }
});

ipcMain.handle('get-cuenta', async () => {
    if (parametrosCargados && parametrosCargados.cuenta !== undefined) {
        console.log("vefirificaion de cuenta: ",parametrosCargados.cuenta)
        return true;
    } else {
        throw new Error('No se pudo cargar la cuenta.');
        
    }
});

ipcMain.handle('validar-equipo', async () => {
    if (parametrosCargados && parametrosCargados.activa !== undefined) {
        console.log("verificación de equipo: ", parametrosCargados.activa);
        return parametrosCargados.activa;
    } else {
        throw new Error('No se pudo cargar la cuenta.');
    }
});

ipcMain.handle('cerrar-cuenta', async () => {
    if (parametrosCargados && parametrosCargados.cuenta !== undefined) {
        console.log("Cerrando cuenta: ", parametrosCargados.cuenta);
        parametrosCargados.cuenta = {};
        parametrosCargados.activa = {};
        parametrosCargados.condiciones = false;
        await guardarParametrosEnDisco();
        await guardarGlobal();
        console.log("Cuenta cerrada exitosamente.");
        app.relaunch();
        app.quit();
        return true;
        
    } else {
        throw new Error('No se pudo cargar la cuenta.');
    }
});

ipcMain.handle('get-parametros', async () => {
    if (parametrosCargados) {
        return parametrosCargados;
    } else {
        throw new Error('No se pudieron cargar los parámetros.');
    }
});

ipcMain.handle('save-seleccion', async (evento, nuevaSeleccion) => {  
    if (typeof nuevaSeleccion !== 'string' || nuevaSeleccion.trim() === '') {
        throw new Error('La selección no puede estar vacía.');
    }
    
    try {
        seleccion= nuevaSeleccion;
        parametrosCargados[agente].seleccion = nuevaSeleccion;
        await guardarParametrosEnDisco();
        await guardarGlobal();

        console.log('✅ Selección guardada:', nuevaSeleccion);
        return '✅ Selección guardada.';
    } catch (error) {
        throw new Error('❌ Error al guardar la selección.');
    }
});

ipcMain.handle('get-seleccion', async () => {
    if (parametrosCargados && parametrosCargados[agente] && parametrosCargados[agente].seleccion !== undefined) {
        return parametrosCargados[agente].seleccion;
    } else {
        throw new Error('No se pudo cargar la selección.');
    }
});


//Leer imagenes, con filtros

ipcMain.handle('save-mensaje-imagen', async (evento, messageData, activo, filtros) => {
    console.log('💾 Guardando mensaje inicial para agente:', agente);
    console.log('📝 Datos del mensaje:', messageData);
    console.log('🔄 Estado activo:', activo);
    console.log('estos son los filtros: ', filtros)
    
    try {
        // Validar que los datos no estén vacíos
        if (!messageData || (typeof messageData === 'string' && messageData.trim() === '')) {
            throw new Error('El mensaje de paso imagen no puede estar vacío.');
        }

        // PARA ARCHIVOS DE APROBADOS
        if (messageData.aprobado.files && messageData.aprobado.files.length > 0) {
            const mediaDir = path.join(app.getPath('userData'), 'media');
            // Esta línea es tuya y la mantengo.
            await fs.mkdir(mediaDir, { recursive: true });

            // --- LÍNEA DE CORRECCIÓN AÑADIDA AQUÍ ---
            // Se asegura de que la subcarpeta 'aprobado' exista antes del bucle.
            const aprobadoDir = path.join(mediaDir, 'aprobado');
            await fs.mkdir(aprobadoDir, { recursive: true });
            
            const processedFiles = [];
            
            for (const file of messageData.aprobado.files) {
                // Si el archivo ya tiene path, es un archivo existente, no lo proceses
                if (file.path) {
                    processedFiles.push(file);
                } else if (file.arrayBuffer) {
                    // Solo procesar archivos nuevos que tienen arrayBuffer
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const uniqueFileName = `${timestamp}-${randomNum}-${file.name}`;
                    
                    // --- CORRECCIÓN MÍNIMA EN LA RUTA ---
                    // Usamos la variable 'aprobadoDir' que acabamos de definir.
                    const destPath = path.join(aprobadoDir, uniqueFileName);
                    
                    try {
                        await fs.writeFile(destPath, Buffer.from(file.arrayBuffer));
                        processedFiles.push({ name: file.name, path: destPath, type: file.type });
                    } catch (writeError) {
                        throw new Error(`Error al guardar el archivo ${file.name}: ${writeError.message}`);
                    }
                } else {
                    throw new Error(`El archivo ${file.name} no contiene datos válidos.`);
                }
            }
            messageData.aprobado.files = processedFiles;
        }

        //PARA ARCHIVOS DE RECHAZADOS
        // Procesar archivos si existen
        if (messageData.rechazado.files && messageData.rechazado.files.length > 0) {
            const mediaDir = path.join(app.getPath('userData'), 'media');
            // Esta línea es tuya y la mantengo.
            await fs.mkdir(mediaDir, { recursive: true });
            
            // --- LÍNEA DE CORRECCIÓN AÑADIDA AQUÍ ---
            // Se asegura de que la subcarpeta 'rechazado' exista antes del bucle.
            const rechazadoDir = path.join(mediaDir, 'rechazado');
            await fs.mkdir(rechazadoDir, { recursive: true });

            const processedFiles = [];
            
            for (const file of messageData.rechazado.files) {
                // Si el archivo ya tiene path, es un archivo existente, no lo proceses
                if (file.path) {
                    processedFiles.push(file);
                } else if (file.arrayBuffer) {
                    // Solo procesar archivos nuevos que tienen arrayBuffer
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const uniqueFileName = `${timestamp}-${randomNum}-${file.name}`;

                    // --- CORRECCIÓN MÍNIMA EN LA RUTA ---
                    // Usamos la variable 'rechazadoDir' que acabamos de definir.
                    const destPath = path.join(rechazadoDir, uniqueFileName);
                    
                    try {
                        await fs.writeFile(destPath, Buffer.from(file.arrayBuffer));
                        processedFiles.push({ name: file.name, path: destPath, type: file.type });
                    } catch (writeError) {
                        throw new Error(`Error al guardar el archivo ${file.name}: ${writeError.message}`);
                    }
                } else {
                    throw new Error(`El archivo ${file.name} no contiene datos válidos.`);
                }
            }
            messageData.rechazado.files = processedFiles;
        }

        // Guardar el mensaje inicial usando tu función existente
        await saveMensajeImagen(messageData, agente, activo, filtros);
        
        console.log('✅ Mensaje inicial guardado exitosamente');
        return {
            success: true,
            mensaje: '✅ Mensaje inicial guardado exitosamente.'
        };
    } catch (error) {
        console.error('❌ Error al guardar mensaje de imagen:', error);
        throw new Error(`❌ Error al guardar mensaje imagen: ${error.message}`);
    }
});

ipcMain.handle('get-mensaje-imagen', async () => {
    try {
        return getMensajeImagen(agente);
    } catch (error) {
        throw error;
    }
});

ipcMain.handle('get-filtros', async () =>{
    try {
        return filtros.leer(agente);
    } catch (error) {
        throw error;
    }

});

// IPC HANDLER PARA GUARDAR EL ESTADO COMPLETO DE LOS FILTROS
ipcMain.handle('save-filtros', async (evento, filtrosData) => {
    try {
        // Usamos la misma variable 'agente' global que ya tienes
        console.log(`💾 Guardando filtros para el agente ${agente}:`, filtrosData);

        // Llamamos a la función que ya existe en tu módulo de filtros
        await filtros.guardar(filtrosData, agente);
        
        return { success: true, message: 'Filtros guardados exitosamente.' };
    } catch (error) {
        console.error('❌ Error en el manejador save-filtros:', error);
        throw error; // Propaga el error de vuelta a React
    }
});

ipcMain.handle('save-remarketing', async (evento, messageData, activo, horario, rango) => {
    try {
        // Validar que los datos no estén vacíos
        if (!messageData || (typeof messageData === 'string' && messageData.trim() === '')) {
            throw new Error('El mensaje inicial no puede estar vacío.');
        }

        // Procesar archivos si existen
        if (messageData.files && messageData.files.length > 0) {
            const mediaDir = path.join(app.getPath('userData'), 'media');
            await fs.mkdir(mediaDir, { recursive: true });

            const processedFiles = [];
            
            for (const file of messageData.files) {
                // Si el archivo ya tiene path, es un archivo existente, no lo proceses
                if (file.path) {
                    processedFiles.push(file);
                } else if (file.arrayBuffer) {
                    // Solo procesar archivos nuevos que tienen arrayBuffer
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const uniqueFileName = `${timestamp}-${randomNum}-${file.name}`;
                    const destPath = path.join(mediaDir, uniqueFileName);
                    
                    try {
                        await fs.writeFile(destPath, Buffer.from(file.arrayBuffer));
                        processedFiles.push({ name: file.name, path: destPath, type: file.type });
                    } catch (writeError) {
                        throw new Error(`Error al guardar el archivo ${file.name}: ${writeError.message}`);
                    }
                } else {
                    throw new Error(`El archivo ${file.name} no contiene datos válidos.`);
                }
            }
            messageData.files = processedFiles;
        }

        // Guardar el mensaje de remarketing usando tu función existente
        await saveMensajeRemarketing(messageData, agente, activo, horario, rango);

        console.log('✅ Mensaje de remarketing guardado exitosamente');
        return {
            success: true,
            mensaje: '✅ Mensaje de remarketing guardado exitosamente.'
        };
    } catch (error) {
        console.error('❌ Error al guardar mensaje de remarketing:', error);
        throw new Error(`❌ Error al guardar mensaje de remarketing: ${error.message}`);
    }
});

ipcMain.handle('get-remarketing', async () => {
    try {
        return await getMensajeRemarketing(agente);
    } catch (error) {
        console.error('❌ Error en el manejador get-remarketing:', error);
        throw error;
    }
});

// Handler para activar/desactivar remarketing sin cambiar configuración
ipcMain.handle('toggle-remarketing', async (evento, activo) => {
    try {
        if (typeof activo !== 'boolean') {
            throw new Error('El estado de remarketing debe ser un valor booleano (true/false).');
        }
        
        // Usar guardarActivo en lugar de la función undefined
        await guardarActivo(agente, activo);

        console.log(`✅ Remarketing ${activo ? 'iniciado' : 'detenido'} para agente ${agente}`);
        return { success: true, message: `Remarketing ${activo ? 'activado' : 'desactivado'}.` };
    } catch (error) {
        console.error('❌ Error al toggle remarketing:', error);
        return { success: false, message: 'Error al cambiar el estado del remarketing.' };
    }
});

// Handler para verificar si remarketing está activo
ipcMain.handle('esta-remarketing-activo', async () => {
    try {

        // ✅ BIEN - llamar la función directamente
        const configRemarketing = await getMensajeRemarketing(agente);
        if (configRemarketing?.activo) {
            return true;
        } else {
            return false;
        }

    } catch (error) {
        console.error('❌ Error verificando estado de remarketing:', error);
        throw error;
    }
});
