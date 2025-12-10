// ultimo.js

// Objeto para almacenar el último mensaje recibido por cada número.
// La estructura será: { agente: { numero: mensaje } }
let ultimosMensajes = {};

// Guarda el último mensaje recibido para un número específico
function guardarUltimoMensaje(numero, mensaje, agente) {
    // Validar que los parámetros existan
    if (!numero || !mensaje || !agente) {
        console.error('Error: parámetros faltantes en guardarUltimoMensaje');
        return;
    }
    
    // Inicializar el objeto para el agente si no existe
    if (!ultimosMensajes[agente]) {
        ultimosMensajes[agente] = {};
    }
    
    ultimosMensajes[agente][numero] = mensaje;
    console.log(`Último mensaje guardado para ${numero} del agente ${agente}. mensaje guardado: ${mensaje}`);
}

// Obtiene el último mensaje guardado para un número específico
function obtenerUltimoMensaje(numero, agente) {
    // Validar que los parámetros existan
    if (!numero || !agente) {
        console.error('Error: parámetros faltantes en obtenerUltimoMensaje');
        return undefined;
    }
    
    // Verificar que el agente existe en ultimosMensajes
    if (!ultimosMensajes[agente]) {
        return undefined;
    }
    
    return ultimosMensajes[agente][numero];
}

// Exportar las funciones
module.exports = {
    guardarUltimoMensaje,
    obtenerUltimoMensaje
};