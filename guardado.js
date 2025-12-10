const fs = require('fs').promises;
const path = require('path');

let memoriaPath;
let memoria = {};
let electronAppRef = null

async function inicializarGuardado(electronApp) {
    electronAppRef = electronApp
    memoriaPath = path.join(electronApp.getPath('userData'), 'memoria.json');
    console.log(`Ruta de memoria configurada a: ${memoriaPath}`);

    try {
        const data = await fs.readFile(memoriaPath, 'utf8');
        memoria = JSON.parse(data);
        console.log('Memoria cargada exitosamente.');
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('Archivo memoria.json no encontrado, inicializando memoria vacía.');
            memoria = {};
        } else {
            console.error('Error al cargar memoria.json:', error);
            memoria = {};
        }
    }
}

async function guardar(numero, texto, agente) {
    if (!memoriaPath) {
        console.warn('inicializarGuardado no llamado previamente en guardar. Llamando ahora...');
        await inicializarGuardado(electronAppRef);
        if (!memoriaPath) {
            console.error('Error crítico: No se pudo inicializar memoriaPath.');
            return;
        }
    }

    // ✅ Asegurar que memoria[agente] existe
    if (!memoria[agente]) {
        memoria[agente] = {};
    }

    memoria[agente][numero] = texto;

    try {
        await fs.writeFile(memoriaPath, JSON.stringify(memoria, null, 2), 'utf8');
        console.log(`Memoria guardada para el número ${numero}.`);
    } catch (error) {
        console.error('Error al guardar memoria.json:', error);
    }
}



function obtenerMemoria(agente) {
    return memoria[agente] || {};
}


module.exports = { inicializarGuardado, guardar, obtenerMemoria };
