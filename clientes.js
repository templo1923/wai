// clientes.js
const fs = require('fs').promises;
const path = require('path');


let clientesPath;
let clientes = {
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
async function inicializarClientes(app) {
    electronAppRef = app;
    clientesPath = path.join(electronAppRef.getPath('userData'), 'clientes.json');

    try {
        const data = await fs.readFile(clientesPath, 'utf8');
        const loadedData = JSON.parse(data);
        
        // Asegura que la estructura por agentes exista.
        if (loadedData && typeof loadedData === 'object') {
            // Migra la estructura antigua si es necesario.
            if (!loadedData["1"] && !loadedData["2"] && !loadedData["3"] && !loadedData["4"] && !loadedData["5"]) {
                clientes = {
                    "1": loadedData,
                    "2": {},
                    "3": {},
                    "4": {},
                    "5": {}
                };
            } else {
                // Carga la estructura nueva.
                clientes = {
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
            clientes = {
                "1": {},
                "2": {},
                "3": {},
                "4": {},
                "5": {}
            };
            try {
                // Intenta crear el archivo vacío.
                await fs.writeFile(clientesPath, JSON.stringify(clientes, null, 2), 'utf8');
            } catch (writeError) {
                // Manejo de errores al crear el archivo.
            }
        } else {
            // En caso de otros errores, inicializa con una estructura vacía.
            clientes = {
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
guarda clientes con su etiqueta para el minicrm
 */
async function saveClientes(numero, agente = "1", activo = true, nombre = "cliente", etiqueta = "Contactado 🤖", color = "#adc9e7", tiempo=new Date().toLocaleString('es-ES')) {
    if (!clientesPath) {
        if (!electronAppRef) {
            throw new Error('Módulo de mensajes predeterminados no inicializado.');
        }
        await inicializarMensajes(electronAppRef);
    }

    // Asegura que la estructura para este agente exista.
    if (!clientes[agente]) {
        clientes[agente] = {};
    }

    
    clientes[agente][numero]={
        "activo" : activo,
        "nombre" : nombre,
        "etiqueta" : etiqueta,
        "color" : color,
        "tiempo" : tiempo
    }
    
    
    

    try {
        await fs.writeFile(clientesPath, JSON.stringify(clientes, null, 2), 'utf8');
        return "Guardado ✅"
    } catch (error) {
        throw error;
    }
}

/*
 * Obtiene todos los mensajes predeterminados para un agente específico.
 */
async function getClientes(agente = "1", numero) {
    // Verificar si el agente y el cliente existen
    if (!clientes[agente] || !clientes[agente][numero]) {
        return null; // o false, o undefined - lo que prefieras para indicar que no existe
    }
    
    console.log("clientes[agente][numero].activo", clientes[agente][numero].activo)

    return clientes[agente][numero].activo ?? true;
}

async function getTotalClientes(agente = "1") {

        // Verificar si el agente TIENE CLIENTES
    if (!clientes[agente]) {
        return null; // No tiene clientes
    }
    
    console.log( `Sí hay clientes para el agente ${agente}`)

    return clientes[agente];

    
}



module.exports = {
    inicializarClientes,
    saveClientes,
    getClientes,
    getTotalClientes
    
};
