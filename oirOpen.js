const OpenAI = require('openai');
const fs = require('fs'); // <--- ¡CAMBIO A require('fs') completo, no solo .promises!
const fsPromises = require('fs').promises; // Usaremos fs.promises para writeFile y unlink
const os = require('os');
const path = require('path');


async function transcribirOpen(audioBuffer, mimetype, key) {

    let openAIClient = null;

    if (!key) {
        console.error("[OIR.JS] ERROR: La Key de OpenAI no fue proporcionada para inicializar el módulo Oir.");
        throw new Error("La API Key de OpenAI no está configurada para el módulo Oir.");
    }
    openAIClient = new OpenAI({
        apiKey: key
    });
    console.log("[OIR.JS] Módulo Oir inicializado con OpenAI.");


    if (!openAIClient) {
        console.error("[OIR.JS] ERROR: El cliente OpenAI no está inicializado para transcribir.");
        throw new Error("El módulo Oir no ha sido inicializado. Llama a inicializarOir() primero.");
    }

    if (!audioBuffer || !(audioBuffer instanceof Buffer)) {
        console.error("[OIR.JS] ERROR: Se requiere un Buffer de audio válido para transcribir.");
        throw new Error("Se requiere un Buffer de audio válido.");
    }
    if (!mimetype) {
        console.error("[OIR.JS] ERROR: Se requiere el tipo MIME del audio para transcribir.");
        throw new Error("Se requiere el tipo MIME del audio.");
    }

    const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB para nivel gratuito
    if (audioBuffer.length > MAX_FILE_SIZE_BYTES) {
        const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
        console.warn(`[OIR.JS] ADVERTENCIA: Archivo de audio excede el límite de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB. Tamaño actual: ${fileSizeMB}MB.`);
        throw new Error(`Archivo de audio demasiado grande (${fileSizeMB}MB) para oir. Límite: ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB.`);
    }

    let cleanedMimeType = mimetype.split(';')[0].trim();

    const supportedMimeTypes = ['audio/flac', 'audio/mp3', 'audio/mp4', 'audio/mpeg', 'audio/mpga', 'audio/m4a', 'audio/ogg', 'audio/wav', 'audio/webm'];
    if (!supportedMimeTypes.includes(cleanedMimeType)) {
        console.error(`[OIR.JS] ERROR: Tipo de archivo de audio no soportado por OpenAI después de la limpieza: ${cleanedMimeType}. Original: ${mimetype}.`);
        throw new Error(`Tipo de archivo de audio no soportado por OpenAI: ${cleanedMimeType}. Tipos soportados: ${supportedMimeTypes.join(', ')}`);
    }

    const extension = cleanedMimeType.split('/')[1];
    const tempFileName = `audio_${Date.now()}.${extension}`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    let fileStream = null; // Declaramos el stream fuera del try para poder cerrarlo en finally

    try {
        await fsPromises.writeFile(tempFilePath, audioBuffer); // Usamos fsPromises para writeFile
        console.log(`[OIR.JS] INFO: Audio temporal guardado en: ${tempFilePath}`);

        // --- CAMBIO CRÍTICO AQUÍ: Usamos fs.createReadStream para pasar un ReadableStream ---
        fileStream = fs.createReadStream(tempFilePath); // Usamos fs regular para createReadStream

        const transcription = await openAIClient.audio.transcriptions.create({
            file: fileStream, // <--- PASAMOS EL READABLESTREAM AQUÍ
            model: "whisper-1",
            prompt: "Transcribe el audio al español.",
            response_format: "text",
            language: "es",
            temperature: 0.0,
        });

        console.log("[OIR.JS] INFO: Transcripción de audio exitosa.");
        return transcription;
    } catch (error) {
        console.error("[OIR.JS] ERROR AL TRANSCRIBIR AUDIO: ");
        if (error.response) {
            console.error("   Código de estado HTTP:", error.response.status);
            console.error("   Datos de respuesta:", JSON.stringify(error.response.data, null, 2));
            console.error("   Headers de respuesta:", error.response.headers);
        } else if (error.message) {
            console.error("   Mensaje de error:", error.message);
        } else {
            console.error("   Error desconocido:", error);
        }
        throw error;
    } finally {
        // Asegúrate de cerrar el stream si se abrió
        if (fileStream) {
            fileStream.destroy(); // Cierra el stream para liberar el archivo
            console.log(`[OIR.JS] INFO: ReadableStream de ${tempFilePath} cerrado.`);
        }
        // Asegúrate de eliminar el archivo temporal
        try {
            await fsPromises.unlink(tempFilePath); // Usamos fsPromises para unlink
            console.log(`[OIR.JS] INFO: Archivo temporal ${tempFilePath} eliminado.`);
        } catch (unlinkError) {
            console.error(`[OIR.JS] ERROR: No se pudo eliminar el archivo temporal ${tempFilePath}:`, unlinkError);
        }
    }
}

module.exports = { transcribirOpen };