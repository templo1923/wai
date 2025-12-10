// imagen.js (VERSIÓN DEFINITIVA CORREGIDA)
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs').promises;
const PQueue = require('p-queue').default;
const { filtros } = require('./filtros');
const { responder } = require('./enviar');
const {getMensajeImagen} = require('./imagenMensajes')

const queue = new PQueue({ concurrency: 3 });

let initializationPromise = null;
let workers = [];

async function inicializarWorkers() {
    console.log('🔄 Inicializando workers de OCR (API Moderna)...');
    const workerPromises = [];

    // --- INICIO DE LA SOLUCIÓN DEFINITIVA ---
    for (let i = 0; i < 3; i++) {
        // En la API moderna, se pasan los idiomas directamente a `createWorker`.
        // La librería maneja la carga e inicialización internamente.
        // No se debe llamar a .loadLanguage() o .initialize() por separado.
        workerPromises.push(
            Tesseract.createWorker('spa+eng')
                .then(worker => {
                    console.log(`✅ Worker ${i} listo.`);
                    return worker;
                })
        );
    }
    // --- FIN DE LA SOLUCIÓN DEFINITIVA ---
    
    try {
        // Esperamos a que todas las promesas de creación se completen
        workers = await Promise.all(workerPromises);
        console.log('✅✅✅ Todos los workers de OCR están inicializados y listos.');
    } catch (error) {
        console.error('❌❌❌ Falló la inicialización de los workers de OCR:', error);
        // Es crucial que la aplicación sepa que este módulo falló.
        throw error;
    }
}

// Lanzamos la inicialización y guardamos la promesa para esperarla más tarde
initializationPromise = inicializarWorkers();

let currentWorker = 0;
function getNextWorker() {
    if (workers.length === 0) {
        throw new Error("Los workers de OCR no están disponibles. La inicialización pudo haber fallado.");
    }
    const worker = workers[currentWorker];
    currentWorker = (currentWorker + 1) % workers.length;
    return worker;
}

async function procesarImagen(rutaImagen, agente = "1", numero, clienteWhatsapp) {

    const mensajeImagen = await getMensajeImagen(agente)
    const activo = mensajeImagen?.activo || false

    if(!activo){
        return
    }

    return queue.add(async () => {
        try {
            await initializationPromise;

            console.log(`📸 Procesando imagen: ${rutaImagen}`);
            
            const imagenOptimizada = await sharp(rutaImagen)
                .resize(1500, 1500, { fit: 'inside', withoutEnlargement: true })
                .grayscale()
                .normalize()
                .toBuffer();
            
            console.log('✅ Imagen optimizada');
            
            const worker = getNextWorker();
            const { data: { text, confidence } } = await worker.recognize(imagenOptimizada);
            
            console.log('📝 TEXTO DETECTADO:', text);
            console.log(`Confianza: ${confidence}%`);
            
            await fs.unlink(rutaImagen);
            console.log('🗑️ Imagen borrada');

            // --- INICIO DE LA LÓGICA DE FILTRADO ---

            const filtrosAgente = filtros.obtener(agente);
            const textoMinusculas = text.toLowerCase();
            
            // Esta lista almacenará los nombres de los filtros que NO se cumplieron.
            const filtrosNoSuperados = [];

            // 1. Lógica AND: Iteramos sobre cada filtro OBLIGATORIO.
            for (const [nombreFiltro, listaPalabras] of Object.entries(filtrosAgente)) {
                
                // Ignorar si el filtro no es un array o está vacío
                if (!Array.isArray(listaPalabras) || listaPalabras.length === 0) {
                    continue;
                }

                let encontradoEnFiltroActual = false;

                // 2. Lógica OR: Buscamos si CUALQUIERA de las palabras de la lista está en el texto.
                for (const palabra of listaPalabras) {
                    if (textoMinusculas.includes(palabra.toLowerCase())) {
                        encontradoEnFiltroActual = true; // ¡Coincidencia! Este filtro se cumple.
                        console.log(`✅ Coincidencia encontrada para el filtro '${nombreFiltro}': '${palabra}'`);
                        break; // Salimos de este bucle interno, ya no necesitamos buscar más palabras para este filtro.
                    }
                }

                // 3. Verificación: Si después de buscar en todas las palabras de este filtro
                // no encontramos ninguna coincidencia, entonces este filtro NO se cumplió.
                if (!encontradoEnFiltroActual) {
                    console.log(`❌ No se encontró ninguna coincidencia para el filtro obligatorio: '${nombreFiltro}', del agente '${agente}'`);
                    filtrosNoSuperados.push(nombreFiltro); // Lo añadimos a la lista de filtros fallidos.
                }
            }

            // 4. Decisión Final: Comprobamos si la lista de filtros fallidos está vacía.
            if (filtrosNoSuperados.length === 0) {
                // aqui hay que añadir toda la logica para enviar el mensaje, por ejemplo si tiene imagenes, etc
                console.log('✅✅ La imagen pasó todos los filtros obligatorios.');
                //await responder(numero, "✅ Imagen aprobada y procesada.", clienteWhatsapp);
                
                //mensaje de cuando se aprueba
                console.log("El mensaje está activo")
                const group = mensajeImagen.mensaje.aprobado                  
                            
                const mediaFilesToSend = group.files ? group.files.map(file => ({
                         name: file.name,
                         path: file.path,
                         type: file.type
                })) : [];

                const delay = Math.floor(Math.random() * (15500 - 7000 + 1)) + 7000;
                console.log(`Esperando ${delay} ms antes de enviar el mensaje...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                

                await responder(numero, group.text, clienteWhatsapp, mediaFilesToSend);

                
                            
                return "✅ Imagen aprobada y procesada.";                              
            } 
            else {
                // Si la lista tiene elementos, la imagen es rechazada.
                console.log(`⚠️ La imagen no pasó los filtros`);
                const mensajeError = `⚠️ Imagen rechazada. Faltaron coincidencias para los filtros` ;
                //await responder(numero, mensajeError, clienteWhatsapp);
                const group = mensajeImagen.mensaje.rechazado      
                const mediaFilesToSend = group.files ? group.files.map(file => ({
                         name: file.name,
                         path: file.path,
                         type: file.type
                })) : [];

                await responder(numero, group.text, clienteWhatsapp, mediaFilesToSend);                                           
                return "⚠️ Imagen rechazada. Faltaron coincidencias para los filtros";                              
            } 
            
            // --- FIN DE LA NUEVA LÓGICA DE FILTRADO ---
            
        } catch (error) {
            console.error('❌ Error procesando imagen:', error);
            try {
                await fs.unlink(rutaImagen);
            } catch (e) {
                // Ignorar error si el archivo ya no existe
            }
        }
    });
}

async function cerrarOCR() {
    if (initializationPromise) {
        await initializationPromise.catch(() => {}); // Esperar a que termine, ignorando errores
    }
    
    for (const worker of workers) {
        await worker.terminate();
    }
    workers = [];
    console.log('✅ Workers de OCR cerrados');
}

module.exports = {
    procesarImagen,
    cerrarOCR
};