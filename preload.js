const { contextBridge, ipcRenderer } = require('electron');


// Obtener el ID de instancia de los argumentos
let instanceId = 1; // Default
const args = process.argv;
for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--instance-id=')) {
        instanceId = parseInt(args[i].split('=')[1]) || 1;
        break;
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    // Información de instancia
    getInstanceId: () => instanceId,
    
    // Gestión de ventanas
    createNewWindow: () => ipcRenderer.invoke('create-new-window'),
    
    // Actualizaciones
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    
    // WhatsApp
    ejecutarWhatsapp: () => ipcRenderer.invoke('ejecutar-whatsapp'),
    cerrarWhatsapp: () => ipcRenderer.invoke('cerrar-whatsapp'),
    cerrarSesionWhatsapp: () => ipcRenderer.invoke('cerrar-sesion-whatsapp'),
    reiniciarWhatsapp: () => ipcRenderer.invoke('reiniciar-whatsapp'),
    
    // Parámetros de instancia
    getContexto: () => ipcRenderer.invoke('get-contexto'),
    saveContexto: (contexto) => ipcRenderer.invoke('save-contexto', contexto),
    getKey: () => ipcRenderer.invoke('get-key'),
    saveKey: (key) => ipcRenderer.invoke('save-key', key),
    getActivo: () => ipcRenderer.invoke('get-activo'),
    toggleActivo: () => ipcRenderer.invoke('toggle-activo'),
    setActivo: (estado) => ipcRenderer.invoke('set-activo', estado),
    
    // Parámetros globales
    getCondiciones: () => ipcRenderer.invoke('get-condiciones'),
    saveCondiciones: (condiciones) => ipcRenderer.invoke('save-condiciones', condiciones),
    
    // Mensajes predeterminados
    savePredeterminedMessage: (messageData) => ipcRenderer.invoke('save-predetermined-message', messageData),
    getPredeterminedMessages: () => ipcRenderer.invoke('get-predetermined-messages'),
    deletePredeterminedMessage: (keyId) => ipcRenderer.invoke('delete-predetermined-message', keyId),
    
    // Utilidades
    restartApp: () => ipcRenderer.invoke('restart-app'),
    openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url),
    openDownloadLink: (url) => ipcRenderer.invoke('open-download-link', url),
    
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    
    // Eventos
    onWhatsappStatusUpdate: (callback) => {
        ipcRenderer.on('whatsapp-status-update', (event, data) => callback(data));
    },
    
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    },

    agenteValor: (valor) => ipcRenderer.invoke('agente-valor', valor),

    getAgente: () => ipcRenderer.invoke('get-agente'),
    
        //  Mensajes iniciales
    getMensajeInicial: () => ipcRenderer.invoke('get-mensaje-inicial'),
    saveMensajeInicial: (messageData, activo) => ipcRenderer.invoke('save-mensaje-inicial', messageData, activo),
    
    //  Gestión de clientes
    getClientes: () => ipcRenderer.invoke('get-clientes'),
    saveClientes: (numero, agente, activo, nombre, etiqueta, color) => 
        ipcRenderer.invoke('save-clientes', numero, agente, activo, nombre, etiqueta, color),
    getTotalClientes:() => ipcRenderer.invoke('get-total-clientes'),

    //Guardar y obtener cuenta
    saveCuenta: (correo, clave, equipo) => ipcRenderer.invoke('save-cuenta',correo, clave, equipo),
    getCuenta: () => ipcRenderer.invoke('get-cuenta'),
    validarEquipo: () => ipcRenderer.invoke('validar-equipo'),
    cerrarCuenta: () => ipcRenderer.invoke('cerrar-cuenta'),
    getParametros: () => ipcRenderer.invoke('get-parametros'),
    getSeleccion: () => ipcRenderer.invoke('get-seleccion'),
    saveSeleccion: (seleccion) => ipcRenderer.invoke('save-seleccion', seleccion),

    //Mensajes de imagen
    getMensajeImagen: () => ipcRenderer.invoke('get-mensaje-imagen'),
    saveMensajeImagen: (messageData, activo, filtros) => ipcRenderer.invoke('save-mensaje-imagen', messageData, activo, filtros),
    getFiltros: () => ipcRenderer.invoke('get-filtros'),
    saveFiltros: (filtrosObject) => ipcRenderer.invoke('save-filtros', filtrosObject),
    
    // Remarketing - actualizado para coincidir con main.js
    saveRemarketing: (messageData, activo, horario, rango) => ipcRenderer.invoke('save-remarketing', messageData, activo, horario, rango),
    getRemarketing: () => ipcRenderer.invoke('get-remarketing'),
    toggleRemarketing: (activo) => ipcRenderer.invoke('toggle-remarketing', activo),
    estaRemarketingActivo: () => ipcRenderer.invoke('esta-remarketing-activo'),

});