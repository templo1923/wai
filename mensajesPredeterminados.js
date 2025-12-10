// mensajesPredeterminados.js
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // Para generar IDs únicas

let predeterminedMessagesPath;
let predeterminedMessages = {
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
async function inicializarMensajesPredeterminados(app) {
    electronAppRef = app;
    predeterminedMessagesPath = path.join(electronAppRef.getPath('userData'), 'predetermined_messages.json');

    try {
        const data = await fs.readFile(predeterminedMessagesPath, 'utf8');
        const loadedData = JSON.parse(data);
        
        // Asegura que la estructura por agentes exista.
        if (loadedData && typeof loadedData === 'object') {
            // Migra la estructura antigua si es necesario.
            if (!loadedData["1"] && !loadedData["2"] && !loadedData["3"] && !loadedData["4"] && !loadedData["5"]) {
                predeterminedMessages = {
                    "1": loadedData,
                    "2": {},
                    "3": {},
                    "4": {},
                    "5": {}
                };
            } else {
                // Carga la estructura nueva.
                predeterminedMessages = {
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
            predeterminedMessages = {
                "1": {},
                "2": {},
                "3": {},
                "4": {},
                "5": {}
            };
            try {
                // Intenta crear el archivo vacío.
                await fs.writeFile(predeterminedMessagesPath, JSON.stringify(predeterminedMessages, null, 2), 'utf8');
            } catch (writeError) {
                // Manejo de errores al crear el archivo.
            }
        } else {
            // En caso de otros errores, inicializa con una estructura vacía.
            predeterminedMessages = {
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
async function savePredeterminedMessage(messageData, agente = "1") {
    if (!predeterminedMessagesPath) {
        if (!electronAppRef) {
            throw new Error('Módulo de mensajes predeterminados no inicializado.');
        }
        await inicializarMensajesPredeterminados(electronAppRef);
    }

    // Asegura que la estructura para este agente exista.
    if (!predeterminedMessages[agente]) {
        predeterminedMessages[agente] = {};
    }

    const newId = uuidv4();
    predeterminedMessages[agente][newId] = messageData;

    try {
        await fs.writeFile(predeterminedMessagesPath, JSON.stringify(predeterminedMessages, null, 2), 'utf8');
        return newId;
    } catch (error) {
        throw error;
    }
}

/*
 * Obtiene todos los mensajes predeterminados para un agente específico.
 */
function getPredeterminedMessages(agente = "1") {
    return predeterminedMessages[agente] || {};
}

/*
 * Elimina un grupo de mensajes predeterminados por su ID para un agente específico.
 */
async function deletePredeterminedMessage(id, agente = "1") {
    if (!predeterminedMessagesPath) {
        if (!electronAppRef) {
            throw new Error('Módulo de mensajes predeterminados no inicializado.');
        }
        await inicializarMensajesPredeterminados(electronAppRef);
    }

    if (predeterminedMessages[agente] && predeterminedMessages[agente][id]) {
        delete predeterminedMessages[agente][id];
        try {
            await fs.writeFile(predeterminedMessagesPath, JSON.stringify(predeterminedMessages, null, 2), 'utf8');
        } catch (error) {
            throw error;
        }
    } else {
        // El mensaje predeterminado con el ID especificado no existe para este agente.
    }
}

module.exports = {
    inicializarMensajesPredeterminados,
    savePredeterminedMessage,
    getPredeterminedMessages,
    deletePredeterminedMessage
};
