// inicio.js auqneu no es inicio es imagenMensajes.js
const fs = require('fs').promises;
const path = require('path');
// la caja pequeña jeje
const { filtros } = require('./filtros');


let mensajeImgenPath;
let mensajeImagen = {
    "1": {},
    "2": {},
    "3": {},
    "4": {},
    "5": {}
};
let electronAppRef = null;

/*
 * Inicializa el módulo de mensajes predeterminados.
 * Carga los datos existentes o crea un archivo nuevo si no existe.
 */
async function inicializarMensajeImagen(app) {
    electronAppRef = app;
    mensajeImgenPath = path.join(electronAppRef.getPath('userData'), 'mensajesImagen.json');

    try {
        const data = await fs.readFile(mensajeImgenPath, 'utf8');
        const loadedData = JSON.parse(data);
        
        // Asegura que la estructura por agentes exista.
        if (loadedData && typeof loadedData === 'object') {
            // Migra la estructura antigua si es necesario.
            if (!loadedData["1"] && !loadedData["2"] && !loadedData["3"] && !loadedData["4"] && !loadedData["5"]) {
                mensajeImagen = {
                    "1": loadedData,
                    "2": {},
                    "3": {},
                    "4": {},
                    "5": {}
                };
            } else {
                // Carga la estructura nueva.
                mensajeImagen = {
                    "1": loadedData["1"] || {},
                    "2": loadedData["2"] || {},
                    "3": loadedData["3"] || {},
                    "4": loadedData["4"] || {},
                    "5": loadedData["5"] || {}
                };
            }
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            // Si el archivo no existe, inicializa con una estructura vacía.
            mensajeImagen = {
                "1": {},
                "2": {},
                "3": {},
                "4": {},
                "5": {}
            };
            try {
                // Intenta crear el archivo vacío.
                await fs.writeFile(mensajeImgenPath, JSON.stringify(mensajeImagen, null, 2), 'utf8');
            } catch (writeError) {
                // Manejo de errores al crear el archivo.
            }
        } else {
            // En caso de otros errores, inicializa con una estructura vacía.
            mensajeImagen = {
                "1": {},
                "2": {},
                "3": {},
                "4": {},
                "5": {}
            };
        }
    }
}

/*
 * Guarda un nuevo grupo de palabras clave y su mensaje/archivos para un agente.
 * Genera un ID único para el grupo.
 */
async function saveMensajeImagen(messageData, agente = "1", activo, filtrosData) {
    if (!mensajeImgenPath) {
        if (!electronAppRef) {
            throw new Error('Módulo de mensajes predeterminados no inicializado.');
        }
        await inicializarMensajeImagen(electronAppRef);
    }

    // Asegura que la estructura para este agente exista.
    if (!mensajeImagen[agente]) {
        mensajeImagen[agente] = {};
    }

    
    mensajeImagen[agente]["mensaje"] = messageData;
    mensajeImagen[agente]["activo"] = activo;

    try {
        await fs.writeFile(mensajeImgenPath, JSON.stringify(mensajeImagen, null, 2), 'utf8');
        filtros.guardar(filtrosData, agente)
        return "Guardado ✅"
    } catch (error) {
        throw error;
    }
}

/*
 * Obtiene todos los mensajes predeterminados para un agente específico.
 */
async function getMensajeImagen(agente = "1") {

        // Verificar si el agente y el cliente existen
    if (!mensajeImagen[agente]) {
        return {"activo": false}; // o false, o undefined - lo que prefieras para indicar que no existe
    }
    
    return mensajeImagen[agente] 
}



module.exports = {
    inicializarMensajeImagen,
    saveMensajeImagen,
    getMensajeImagen
    
};
