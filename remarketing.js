// inicio.js
const fs = require('fs').promises;
const path = require('path');
const { getTotalClientes } = require('./clientes');
const logs = require('./logs'); 
const {responder} = require('./enviar');
const { obtenerClienteWhatsapp } = require('./app');
const { saveClientes } = require('./clientes');

let remarketingoPath;
let mensajeRemarketing = {
    "1": {},
    "2": {},
    "3": {},
    "4": {},
    "5": {}
};
let electronAppRef = null;
let intervalRemarketing = null;

/*
 * Inicializa el módulo de mensajes de remarketing.
 * Carga los datos existentes o crea un archivo nuevo si no existe.
 */
async function remarketingMensajes(app) {
    electronAppRef = app;
    remarketingoPath = path.join(electronAppRef.getPath('userData'), 'remarketing.json');

    try {
        const data = await fs.readFile(remarketingoPath, 'utf8');
        const loadedData = JSON.parse(data);
        
        // Asegura que la estructura por agentes exista.
        if (loadedData && typeof loadedData === 'object') {
            // Migra la estructura antigua si es necesario.
            if (!loadedData["1"] && !loadedData["2"] && !loadedData["3"] && !loadedData["4"] && !loadedData["5"]) {
                mensajeRemarketing = {
                    "1": loadedData,
                    "2": {},
                    "3": {},
                    "4": {},
                    "5": {}
                };
            } else {
                // Carga la estructura nueva.
                mensajeRemarketing = {
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
            mensajeRemarketing = {
                "1": {},
                "2": {},
                "3": {},
                "4": {},
                "5": {}
            };
            try {
                // Intenta crear el archivo vacío.
                await fs.writeFile(remarketingoPath, JSON.stringify(mensajeRemarketing, null, 2), 'utf8');
            } catch (writeError) {
                // Manejo de errores al crear el archivo.
            }
        } else {
            // En caso de otros errores, inicializa con una estructura vacía.
            mensajeRemarketing = {
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
async function saveMensajeRemarketing(messageData, agente = "1", activo, horario, rango) {
    if (!remarketingoPath) {
        if (!electronAppRef) {
            throw new Error('Módulo de mensajes de remarketing no inicializado.');
        }
        await remarketingMensajes(electronAppRef);
    }

    // Asegura que la estructura para este agente exista.
    if (!mensajeRemarketing[agente]) {
        mensajeRemarketing[agente] = {};
    }

    mensajeRemarketing[agente]["mensaje"] = messageData;
    mensajeRemarketing[agente]["activo"] = activo;
    mensajeRemarketing[agente]["horario"] = horario;
    mensajeRemarketing[agente]["rango"] = rango;

    try {
        await fs.writeFile(remarketingoPath, JSON.stringify(mensajeRemarketing, null, 2), 'utf8');
        return "Guardado ✅"
    } catch (error) {
        throw error;
    }
}

/*
 * Obtiene todos los mensajes de remarketing para un agente específico.
 */
async function getMensajeRemarketing(agente = "1") {
    // Verificar si el agente y el cliente existen
    if (!mensajeRemarketing[agente]) {
        return {"activo": false}; // o false, o undefined - lo que prefieras para indicar que no existe
    }

    return mensajeRemarketing[agente]
}

// Función para procesar remarketing de un agente específico
async function activarRemarketing(agente = "1", clienteWhatsapp = null) {
    try {
        // 1. Verificar si está activo
        const configRemarketing = await getMensajeRemarketing(agente);
        
        if (!configRemarketing.activo) {
            //await logs.guardar(`❌ Remarketing desactivado para agente ${agente}`);
            return;
        }

        // 2. Obtener cliente WhatsApp si no se proporcionó
        if (!clienteWhatsapp) {
            clienteWhatsapp = obtenerClienteWhatsapp(agente);
            if (!clienteWhatsapp) {
                //await logs.guardar(`❌ No hay cliente WhatsApp conectado para agente ${agente}`);
                return;
            }
        }

        // await logs.guardar(`✅ Remarketing activo para agente ${agente}`);

        // 3. Verificar si estamos dentro del horario permitido
        const ahora = new Date();
        const horaActual = ahora.toTimeString().split(' ')[0]; // formato HH:MM:SS
        
        const { inicio, fin } = configRemarketing.horario;
        
        if (!estaEnHorario(horaActual, inicio, fin)) {
           // await logs.guardar(`⏰ Fuera de horario de remarketing. Actual: ${horaActual}, Permitido: ${inicio} - ${fin}`);
            return;
        }

        // await logs.guardar(`⏰ Dentro del horario de remarketing: ${horaActual} para el agente ${agente}`);

        // 4. Obtener todos los clientes
        const todosLosClientes = await getTotalClientes(agente);
        
        if (!todosLosClientes) {
           // await logs.guardar(`📝 No hay clientes para el agente ${agente}`);
            return;
        }

        // 5. Filtrar clientes con etiqueta "Nuevo"
        const clientesNuevos = Object.entries(todosLosClientes).filter(([numero, cliente]) => 
            cliente.etiqueta === "Nuevo"
        );

       // await logs.guardar(`📊 Clientes con etiqueta "Nuevo": ${clientesNuevos.length}`);

        if (clientesNuevos.length === 0) {
            return;
        }

        // 6. Procesar cada cliente nuevo
        for (const [numero, cliente] of clientesNuevos) {
            try {
                const tiempoCliente = await parsearFechaCliente(cliente.tiempo);
                console.log(`Debug cliente ${numero}:`, {
                    fechaOriginal: cliente.tiempo,
                    fechaParseada: tiempoCliente,
                    fechaActual: new Date(),
                    esValida: !isNaN(tiempoCliente.getTime())
                });
                const tiempoActual = new Date();
                
                // Calcular diferencia en minutos
                const diferenciaMinutos = Math.floor((tiempoActual - tiempoCliente) / (1000 * 60));
                
                // await logs.guardar(`📱 Cliente ${numero}: registrado hace ${diferenciaMinutos} minutos`);

                if (diferenciaMinutos > 60 * 24) {

                    await saveClientes(
                        numero, 
                        agente, 
                        cliente.activo, 
                        cliente.nombre, 
                        "Contactado", // Nueva etiqueta
                        cliente.color, 
                        cliente.tiempo // Mantener el tiempo original
                    );
                    // await logs.guardar(`❌ Cliente ${numero} tiene más de 24 horas. No se procesará.`);
                    
                    // await logs.guardar(`✅ Cliente ${numero} actualizado a etiqueta "Contactado" PORQUE SE PASÓ DE 24 HR`);
                    continue; // Saltar al siguiente cliente
                }

                
                // 7. Verificar si ha pasado el tiempo de rango
                
                if (diferenciaMinutos >= configRemarketing.rango) {
                    // await logs.guardar(`🎯 Cliente ${numero} cumple con el rango de tiempo (${configRemarketing.rango} min). Procesando remarketing...`);
                    
                    let mensajeActualRemarketing = await getMensajeRemarketing(agente);

                    console.log("El mensaje de remarketing está activo")
                    const group = mensajeActualRemarketing.mensaje

                    const mediaFilesToSend = group.files ? group.files.map(file => ({
                        name: file.name,
                        path: file.path,
                        type: file.type
                    })) : [];

                    await responder(numero, group.text, clienteWhatsapp, mediaFilesToSend);

                    // 8. Actualizar cliente con nueva etiqueta
                    
                    await saveClientes(
                        numero, 
                        agente, 
                        cliente.activo, 
                        cliente.nombre, 
                        "Contactado", // Nueva etiqueta
                        cliente.color, 
                        cliente.tiempo // Mantener el tiempo original
                    );

                    // await logs.guardar(`✅ Cliente ${numero} actualizado a etiqueta "Contactado"`);

                } else {
                    const minutosRestantes = configRemarketing.rango - diferenciaMinutos;
                    // await logs.guardar(`⏳ Cliente ${numero}: faltan ${minutosRestantes} minutos para remarketing`);
                }
                
            } catch (error) {
                await logs.guardar(`❌ Error procesando cliente ${numero}: ${error.message}`);
            }
        }

    } catch (error) {
        await logs.guardar(`❌ Error general en remarketing agente ${agente}: ${error.message}`);
    }
}

function parsearFechaCliente(fechaString) {
    try {
        // El formato es: "11/8/2025, 15:31:01" (DD/MM/YYYY)
        const [fechaParte, horaParte] = fechaString.split(', ');
        const [dia, mes, año] = fechaParte.split('/'); // DÍA primero, MES segundo
        const [hora, minuto, segundo] = horaParte.split(':');
        
        // Crear fecha usando constructor explícito
        return new Date(
            parseInt(año), 
            parseInt(mes) - 1,  // mes - 1 porque JavaScript usa 0-11
            parseInt(dia), 
            parseInt(hora), 
            parseInt(minuto), 
            parseInt(segundo)
        );
        
    } catch (error) {
        console.error('Error parseando fecha:', fechaString, error);
        return new Date();
    }
}

// Función auxiliar para verificar si estamos dentro del horario
function estaEnHorario(horaActual, inicio, fin) {
    // Convertir a minutos desde medianoche para facilitar comparación
    const convertirAMinutos = (hora) => {
        const [h, m, s] = hora.split(':').map(Number);
        return h * 60 + m;
    };
    
    const minutosActuales = convertirAMinutos(horaActual);
    const minutosInicio = convertirAMinutos(inicio);
    const minutosFin = convertirAMinutos(fin);
    
    // Manejar caso donde el horario cruza medianoche (ej: 23:00 - 02:00)
    if (minutosInicio > minutosFin) {
        return minutosActuales >= minutosInicio || minutosActuales <= minutosFin;
    } else {
        return minutosActuales >= minutosInicio && minutosActuales <= minutosFin;
    }
}

// Función para procesar remarketing para todos los agentes cada 5 minutos
async function iniciarRemarketingAutomatico() {
    // Si ya hay un intervalo corriendo, lo detenemos
    if (intervalRemarketing) {
        clearInterval(intervalRemarketing);
    }
    
    // await logs.guardar(`🔄 Iniciando remarketing automático cada 5 minutos para agentes 1-5`);
    
    // Función que procesa todos los agentes
    const procesarTodosLosAgentes = async () => {
        // await logs.guardar(`🔄 Ejecutando ciclo de remarketing para todos los agentes`);

        // Iterar sobre los agentes del "1" al "5" como strings
        for (let i = 1; i <= 5; i++) {
            const agente = i.toString(); // Convertir a string
            
            try {
                // await logs.guardar(`🔄 Procesando remarketing para agente ${agente}`);
                await activarRemarketing(agente);
            } catch (error) {
                await logs.guardar(`❌ Error en remarketing para agente ${agente}: ${error.message}`);
            }
        }
        
        // await logs.guardar(`✅ Ciclo de remarketing completado para todos los agentes`);
    };
    
    // Ejecutar inmediatamente la primera vez
    await procesarTodosLosAgentes();
    
    // Configurar para que se ejecute cada 5 minutos
    intervalRemarketing = setInterval(async () => {
        try {
            await procesarTodosLosAgentes();
        } catch (error) {
            await logs.guardar(`❌ Error en ciclo automático de remarketing: ${error.message}`);
        }
    }, 5 * 60 * 1000); // 5 minutos en milisegundos

    // await logs.guardar(`✅ Remarketing automático configurado (cada 5 minutos)`);
}

// Guardar activo para un agente específico
async function guardarActivo(agente, activo) {
    // Asegura que la estructura para este agente exista
    if (!mensajeRemarketing[agente]) {
        mensajeRemarketing[agente] = {};
    }

    // Actualizar solo la propiedad activo
    mensajeRemarketing[agente]["activo"] = activo;
    
    try {
        await fs.writeFile(remarketingoPath, JSON.stringify(mensajeRemarketing, null, 2), 'utf8');
        // await logs.guardar(`✅ Estado de remarketing guardado para agente ${agente}: ${activo}`);
        return "Guardado ✅"
    } catch (error) {
        await logs.guardar(`❌ Error al guardar estado de remarketing para agente ${agente}: ${error.message}`);
        throw error;
    }
} 

module.exports = {
    remarketingMensajes,
    saveMensajeRemarketing,
    getMensajeRemarketing,
    guardarActivo,
    iniciarRemarketingAutomatico,
    activarRemarketing
};