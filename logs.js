const fs = require('fs').promises;
const path = require('path');

let electronAppRef = null;

const logs = {
    inicializar(electronApp) {
        electronAppRef = electronApp;
    },

    async guardar(mensaje) {
        if (!electronAppRef) return;
        
        const rutaLogs = path.join(electronAppRef.getPath('userData'), 'logs.json');
        
        const log = {
            timestamp: new Date().toLocaleString('es-CO'),
            message: mensaje
        };
        
        try {
            let logs = [];
            try {
                const data = await fs.readFile(rutaLogs, 'utf8');
                logs = JSON.parse(data);
            } catch (error) {
                // Archivo no existe
            }
            
            logs.push(log);
            await fs.writeFile(rutaLogs, JSON.stringify(logs, null, 2));
        } catch (error) {
            console.error('Error guardando log:', error);
        }
    },

    async obtener() {
        if (!electronAppRef) return [];
        
        const rutaLogs = path.join(electronAppRef.getPath('userData'), 'logs.json');
        
        try {
            const data = await fs.readFile(rutaLogs, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }
};

module.exports = logs;