'use strict';
// Verifica finanzas.js contra las cifras de los libros de Excel y que la copia
// del frontend sea idéntica. Uso: node scripts/verificar-finanzas.js
const fs = require('fs');
const path = require('path');
const { analizarRecursosPropios, calcularPPA } = require('../finanzas');

let fallas = 0;
const cerca = (nombre, real, esperado, tolRel = 1e-6) => {
  const ok = Math.abs(real - esperado) <= Math.max(1, Math.abs(esperado) * tolRel);
  if (!ok) fallas++;
  console.log(`${ok ? '✓' : '✗'} ${nombre}: ${Number(real).toLocaleString('es-CO')} (esperado ${Number(esperado).toLocaleString('es-CO')})`);
};

// 1. Cotizador WEB — hoja Tabla PPA y DATOS ENTRADA (caso Isla Múcura)
const kwp = 93.62;
const ppa = calcularPPA({
  kwp, potenciaAC: kwp / 1.3, npaneles: 151, potenciaPanel: 620,
  generacionAnual: kwp * 3.5 * 365, tarifa: 900, costoProyecto: 421290000,
}, { uvt: 42412 });
console.log('\nPPA (Cotizador WEB)');
cerca('Tarifa PPA año 1', ppa.tarifaPPA1, 585);
cerca('Ahorro primer mes', ppa.ahorroMensual1, 3139488.19);
cerca('Ahorro acumulado 5 años', ppa.acumulado5, 205770349);
cerca('Ahorro acumulado 10 años', ppa.acumulado10, 461084890);
cerca('Ahorro acumulado 15 años', ppa.acumulado15, 777613155);
cerca('Ahorro acumulado 25 años', ppa.acumulado25, 3284156821);
cerca('Costo interno', ppa.interno.costoInterno, 162345597);
cerca('Capex con margen', ppa.interno.capex, 190994820);
cerca('TIR Solartech 15 años (%)', ppa.interno.tirPlazo * 100, 37.10, 1e-3);
cerca('TIR Solartech 10 años (%)', ppa.interno.tir10 * 100, 35.07, 1e-3);

// 2. Análisis Financiero — hoja RECURSOS PROPIOS (124,8 kWp; el libro toma la base con IVA)
const rp = analizarRecursosPropios({
  costoProyecto: 332704320, costoProyectoMasIva: 349339536,
  ahorroAnual: 137184952, mantenimientoAnual: 3327043.2, esEmpresa: true,
}, { baseConIva: true });
console.log('\nRecursos propios (Análisis Financiero)');
// El libro deprecia 33,33 % × 3 (99,99 %); aquí es un tercio exacto: ~$12.000 de diferencia.
cerca('Acumulado 10 años', rp.anios[9].acumulado, 875485133, 2e-5);
cerca('VPN 25 años', rp.vpn25, 736068167, 2e-5);
cerca('TIR 25 años (%)', rp.tir25 * 100, 38.80, 1e-3);
cerca('Retorno después de impuestos (años)', rp.retornoAnios, 2.21, 1e-2);

// 3. La copia del frontend debe ser idéntica
const a = fs.readFileSync(path.join(__dirname, '..', 'finanzas.js'), 'utf8').replace(/\r\n/g, '\n');
const bRuta = path.join(__dirname, '..', '..', 'frontend', 'src', 'finanzas.js');
const b = fs.existsSync(bRuta) ? fs.readFileSync(bRuta, 'utf8').replace(/\r\n/g, '\n') : '';
const iguales = a === b;
if (!iguales) fallas++;
console.log(`\n${iguales ? '✓' : '✗'} frontend/src/finanzas.js ${iguales ? 'es idéntico' : 'difiere: cópialo desde backend/finanzas.js'}`);

console.log(fallas ? `\n${fallas} verificación(es) fallaron` : '\nTodo cuadra con los libros');
process.exit(fallas ? 1 : 0);
