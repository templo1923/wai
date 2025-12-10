// inicio.js
const fs = require('fs').promises;
const path = require('path');


let inicioPath;
let mensajeInicial = {
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
async function inicializarMensajes(app) {
    electronAppRef = app;
    inicioPath = path.join(electronAppRef.getPath('userData'), 'inicio.json');

    try {
        const data = await fs.readFile(inicioPath, 'utf8');
        const loadedData = JSON.parse(data);
        
        // Asegura que la estructura por agentes exista.
        if (loadedData && typeof loadedData === 'object') {
            // Migra la estructura antigua si es necesario.
            if (!loadedData["1"] && !loadedData["2"] && !loadedData["3"] && !loadedData["4"] && !loadedData["5"]) {
                mensajeInicial = {
                    "1": loadedData,
                    "2": {},
                    "3": {},
                    "4": {},
                    "5": {}
                };
            } else {
                // Carga la estructura nueva.
                mensajeInicial = {
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
            mensajeInicial = {
                "1": {},
                "2": {},
                "3": {},
                "4": {},
                "5": {}
            };
            try {
                // Intenta crear el archivo vacío.
                await fs.writeFile(inicioPath, JSON.stringify(mensajeInicial, null, 2), 'utf8');
            } catch (writeError) {
                // Manejo de errores al crear el archivo.
            }
        } else {
            // En caso de otros errores, inicializa con una estructura vacía.
            mensajeInicial = {
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
async function saveMensajeInicial(messageData, agente = "1", activo) {
    if (!inicioPath) {
        if (!electronAppRef) {
            throw new Error('Módulo de mensajes predeterminados no inicializado.');
        }
        await inicializarMensajes(electronAppRef);
    }

    // Asegura que la estructura para este agente exista.
    if (!mensajeInicial[agente]) {
        mensajeInicial[agente] = {};
    }
    
    
    mensajeInicial[agente]["mensaje"] = messageData;
    mensajeInicial[agente]["activo"] = activo;

    try {
        await fs.writeFile(inicioPath, JSON.stringify(mensajeInicial, null, 2), 'utf8');
        return "Guardado ✅"
    } catch (error) {
        throw error;
    }
}

/*
 * Obtiene todos los mensajes predeterminados para un agente específico.
 */
async function getMensajeInicial(agente = "1") {

        // Verificar si el agente y el cliente existen
    if (!mensajeInicial[agente]) {
        return {"activo": false}; // o false, o undefined - lo que prefieras para indicar que no existe
    }
    
    return mensajeInicial[agente] 
}



module.exports = {
    inicializarMensajes,
    saveMensajeInicial,
    getMensajeInicial,
    
};
