// filtros.js 
const path = require('path');
const fs = require('fs');

let rutaDB = null


function inicializarFiltros (electronAppRef) {
    rutaDB = path.join(electronAppRef.getPath('userData'), 'filtros.json');
    // Crear archivo si no existe
    if (!fs.existsSync(rutaDB)) {
        fs.writeFileSync(rutaDB, JSON.stringify({}, null, 2));
    }

}





const filtros = {
    leer(agente = "1") {
        try {
            const allData = JSON.parse(fs.readFileSync(rutaDB, 'utf-8'));
            return allData[agente] || {};
        } catch (error) {
            // Si el archivo está corrupto, recrearlo
            fs.writeFileSync(rutaDB, JSON.stringify({}, null, 2));
            return {};
        }
    },
    
    guardar(datos, agente = "1") {
        let allData;
        try {
            allData = JSON.parse(fs.readFileSync(rutaDB, 'utf-8'));
        } catch (error) {
            allData = {};
        }
        
        // Asegurar que datos[filtro] siempre sea array si no existe
        allData[agente] = datos;
        
        try {
            fs.writeFileSync(rutaDB, JSON.stringify(allData, null, 2));
            return datos;
        } catch (error) {
            throw new Error('No se pudo guardar el archivo');
        }
    },

    obtener(agente = "1") {
        return this.leer(agente);
    },
    
    establecer(filtro, valor, agente = "1") {
        const datos = this.leer(agente);
        
        // Si valor debe ser array y no lo es
        if (!Array.isArray(valor)) {
            throw new Error('El valor debe ser un array');
        }
        
        datos[filtro] = valor;
        return this.guardar(datos, agente);
    }
};

module.exports = {filtros,
    inicializarFiltros}