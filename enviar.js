//enviar.js

const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

/**
 * Envía un mensaje de texto y/o archivos multimedia a un chat de WhatsApp.
 * @param {string} numero - El número de teléfono del destinatario (ej. "573001234567").
 * @param {string} respuesta - El mensaje de texto a enviar. Puede ser una cadena vacía si solo se envían archivos.
 * @param {Object} cliente - La instancia del cliente de Baileys.
 * @param {Array<Object>} [mediaFiles=[]] - Un array de objetos de archivo multimedia a enviar.
 * Cada objeto debe tener al menos `name` (nombre del archivo) y `path` (ruta absoluta del archivo).
 */
async function responder(numero, respuesta, cliente, mediaFiles = []) {
    let chatId;
    if (numero.includes('@s.whatsapp.net') || numero.includes('@lid')) {
        // ya está en formato JID válido (PN o LID)
        chatId = numero;
    } else {
        // es un número "puro", lo normalizamos a PN
        chatId = `${numero}@s.whatsapp.net`;
    }


    try {
 

        // Enviar archivos multimedia
        for (const file of mediaFiles) {
            try {
                // Verificar que el archivo existe
                if (!fs.existsSync(file.path)) {
                    continue;
                }

                // Leer el archivo
                const fileBuffer = fs.readFileSync(file.path);
                const mimeType = mime.lookup(file.path) || 'application/octet-stream';
                const fileName = file.name || path.basename(file.path);

                // Determinar el tipo de mensaje según el MIME type
                let messageContent = {};

                if (mimeType.startsWith('image/')) {
                    messageContent = {
                        image: fileBuffer
                    };
                } else if (mimeType.startsWith('video/') || mimeType === 'application/mp4' || /\.(mp4|avi|mov|mkv|webm|3gp)$/i.test(fileName)) {
                    // WhatsApp limita videos a ~16MB
                    const maxSize = 16 * 1024 * 1024; // 16MB
                    
                    if (fileBuffer.length > maxSize) {
                        // Si es muy grande, enviar como documento
                        messageContent = {
                            document: fileBuffer,
                            mimetype: 'video/mp4',
                            fileName: fileName
                        };
                    } else {
                        // Enviar como video
                        messageContent = {
                            video: fileBuffer,
                            
                            mimetype: 'video/mp4'
                        };
                    }
                } else if (mimeType.startsWith('audio/')) {
                    messageContent = {
                        audio: fileBuffer,
                        mimetype: mimeType,
                        fileName: fileName
                    };
                } else {
                    // Para documentos y otros tipos de archivos
                    messageContent = {
                        document: fileBuffer,
                        mimetype: mimeType,
                        fileName: fileName
                    };
                }

                await cliente.sendMessage(chatId, messageContent);
                
            } catch (mediaError) {
                // Error enviando archivo: Incluir el mensaje de error de mediaError para más detalles
                // await cliente.sendMessage(chatId, { text: `❌ Lo siento, no pude enviar el archivo: ${file.name}. Razón: ${mediaError.message || 'Error desconocido al procesar el archivo.'}` });
            }
        }


        // Enviar mensaje de texto despues, si existe
        if (respuesta && respuesta.trim() !== '') {
            await cliente.sendMessage(chatId, { text: respuesta });
            
        }

    } catch (err) {
        // Error general al responder
        // await cliente.sendMessage(chatId, { text: `❌ Hubo un problema al intentar enviar la respuesta. ${err}` });
    }
}

module.exports = { responder };