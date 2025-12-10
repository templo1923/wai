// oirGemini.js (Versión recomendada)

// Importa el paquete de Google
const { GoogleGenerativeAI } = require("@google/generative-ai");

// ¡Ya no necesitamos fs, os, ni path!

async function transcribirGemini(audioBuffer, mimetype, key) {

    let genAI = null;

    if (!key) {
        console.error("[OIR.JS] ERROR: La Key de Gemini no fue proporcionada.");
        throw new Error("La API Key de Gemini no está configurada.");
    }
    genAI = new GoogleGenerativeAI(key);
    console.log("[OIR.JS] Módulo Oir inicializado con Gemini.");

    if (!audioBuffer || !(audioBuffer instanceof Buffer)) {
        console.error("[OIR.JS] ERROR: Se requiere un Buffer de audio válido.");
        throw new Error("Se requiere un Buffer de audio válido.");
    }
    if (!mimetype) {
        console.error("[OIR.JS] ERROR: Se requiere el tipo MIME del audio.");
        throw new Error("Se requiere el tipo MIME del audio.");
    }

    let cleanedMimeType = mimetype.split(';')[0].trim();

    const supportedMimeTypes = [
        'audio/wav', 'audio/mp3', 'audio/aiff',
        'audio/aac', 'audio/ogg', 'audio/flac'
    ];

    if (!supportedMimeTypes.includes(cleanedMimeType)) {
        console.error(`[OIR.JS] ERROR: Tipo de archivo no soportado: ${cleanedMimeType}.`);
        throw new Error(`Tipo de archivo de audio no soportado: ${cleanedMimeType}.`);
    }

    // --- INICIA EL CAMBIO PRINCIPAL ---
    try {
        console.log(`[OIR.JS] INFO: Procesando audio ${cleanedMimeType} en memoria...`);

        // 1. Convertir el buffer a Base64 (esto es lo que espera la API "inline")
        const base64Audio = audioBuffer.toString('base64');

        // 2. Usar el modelo generativo
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }); // gemini-1.5-flash es más nuevo

        const prompt = "Transcribe este audio. El idioma es español. Responde única y exclusivamente con la transcripción del texto.";

        // 3. Enviar los datos "inline" en lugar de "fileData"
        const result = await model.generateContent([
            {
                inlineData: {
                    mimeType: cleanedMimeType,
                    data: base64Audio
                }
            },
            { text: prompt }
        ]);

        const response = result.response;
        const transcription = response.text();
        // --- FIN DEL CAMBIO PRINCIPAL ---

        console.log("[OIR.JS] INFO: Transcripción de audio exitosa.");
        return transcription;

    } catch (error) {
        console.error("[OIR.JS] ERROR AL TRANSCRIBIR AUDIO (GEMINI): ");
        if (error.response && error.response.promptFeedback) {
            console.error("  Feedback de la API:", JSON.stringify(error.response.promptFeedback, null, 2));
        } else if (error.message) {
            console.error("  Mensaje de error:", error.message);
        } else {
            console.error("  Error desconocido:", error);
        }
        throw error;
    }
    // Ya no necesitamos el bloque 'finally' para borrar archivos
}

module.exports = { transcribirGemini };