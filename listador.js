const {ia} = require ('./groq');
const {responder} = require ('./enviar.js')
const { guardar, obtenerMemoria } = require('./guardado.js');
const { guardarUltimoMensaje, obtenerUltimoMensaje } = require('./ultimo.js');
const iaOpen = require('./open.js');    
const iaGemini = require('./gemini.js');


let electronAppRef = null;

const mensajesPendientes = {};
const temporizadoresMensajes = {};


function inicializarListador(electronApp) {
    electronAppRef = electronApp;
    

    Object.keys(global.parametros).forEach(agente => {
        if (!mensajesPendientes[agente]) {
            mensajesPendientes[agente] = {};
        }
        if (!temporizadoresMensajes[agente]) {
            temporizadoresMensajes[agente] = {};
        }
    });
}

async function listador(numero, mensaje, cliente, agente) {

    const seleccion = global.parametros[agente]?.seleccion || "groq";


    if (!global.parametros[agente]) {
        console.error(`Error: agente '${agente}' no encontrado en parametros.`);
        return;
    }

    // Asegurar que los objetos existen para este agente
    if (!mensajesPendientes[agente][numero]) {
        mensajesPendientes[agente][numero] = {};
    }
    if (!temporizadoresMensajes[agente][numero]) {
        temporizadoresMensajes[agente][numero] = {};
    }

    //Guarda y consulta el ultimo mensaje para que no se repita los mensajes
    const ultimoMensajeCrudo = obtenerUltimoMensaje(numero, agente);
    console.log(ultimoMensajeCrudo)
    if (ultimoMensajeCrudo === mensaje) {
        return;
    }
    guardarUltimoMensaje(numero, mensaje, agente);

    if (!global.parametros[agente].activo) {
        return;
    }

    if (mensajesPendientes[agente][numero]) {
        mensajesPendientes[agente][numero] += `\n${mensaje}`;
    } else {
        mensajesPendientes[agente][numero] = mensaje;
    }

    if (temporizadoresMensajes[agente][numero]) {
        clearTimeout(temporizadoresMensajes[agente][numero]);
    }

    const tiempoEsperaAleatorio = Math.floor(Math.random() * (15000 - 7000 + 1)) + 7000;

    temporizadoresMensajes[agente][numero] = setTimeout(async () => {
        await processQueuedMessage(numero, cliente, agente, seleccion);
    }, tiempoEsperaAleatorio);
}

async function processQueuedMessage(numero, cliente, agente, seleccion) {
    // Asegurar que los objetos existen
    if (!mensajesPendientes[agente][numero]) {

        console.log("El objeto no existe mensjes pendientes")
        mensajesPendientes[agente][numero] = {};
    }
    if (!temporizadoresMensajes[agente][numero]) {
         console.log("El objeto no existe temporizador")
        temporizadoresMensajes[agente][numero] = {};
    }

    const mensajeConcatenado = mensajesPendientes[agente][numero];

    console.log("llego hasta el quiry de concatenados")

    delete mensajesPendientes[agente][numero];
    delete temporizadoresMensajes[agente][numero];

    if (!mensajeConcatenado) {
        return;
    }

    if (!global.parametros[agente] || !global.parametros[agente][seleccion]) {
        console.log(numero, "Lo siento, tuve un problema de configuración.", cliente);
        return;
    }

    const contexto = global.parametros[agente][seleccion]["contexto"] || "responde: En este momento no estás disponible";

    let memoriaLista = obtenerMemoria(agente);

        // Si es undefined, lo inicializas como objeto vacío
        if (!memoriaLista) {
            memoriaLista = {};
        }

        console.log(`esto dice la memoria:`, memoriaLista);

        let memoria = "Usuario: inicia conversación.";

        if (memoriaLista[numero]) {
            memoria = memoriaLista[numero];
        }

        console.log(`así quedó la memoria: ${memoria}`);


    const mensajeShort = String(mensajeConcatenado).slice(0, 3000);
    const memoriaShort = String(memoria).slice(-4000);
    const contextoShort = String(contexto).slice(0, 15000);

    const key = global.parametros[agente][seleccion]["key"];

    if (!key) {
        console.error("Error: La API Key no fue proporcionada a listador().");
        //responder(numero, "Gracias por escribir, pronto te responderemos", cliente);
        return;
    }

    let respuesta;
    try {
        if (seleccion === "openai") {
            respuesta = await iaOpen(mensajeShort, memoriaShort, contextoShort, key);
        } else if (seleccion === "groq") {
            respuesta = await ia(mensajeShort, memoriaShort, contextoShort, key);
        } else if (seleccion === "gemini") {
            respuesta = await iaGemini(mensajeShort, memoriaShort, contextoShort, key);
        } 
        
        else {
            console.error(`Selección no válida: ${seleccion}`);
            return;
        }
        
    } catch (error) {
        console.error(`Error al llamar a la IA:`, error);
        responder(numero, "Gracias por escribir, pronto te responderemos", cliente);
        return;
    }

    const nuevaMemoriaEntrada = `${memoriaShort} Usuario: ${mensajeConcatenado}.  Asistente: ${respuesta}.`

    await guardar(numero, nuevaMemoriaEntrada, agente);

    responder(numero, respuesta, cliente);
}

module.exports = { listador, inicializarListador };