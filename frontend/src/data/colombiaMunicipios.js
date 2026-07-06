// Radiación solar (kWh/m²/día) a dos niveles: departamento y municipio.
// - `radiacion` a nivel de departamento = valor por defecto para sus municipios.
// - `radiacion` a nivel de municipio = sobreescribe el valor del departamento.
//
// NOTA: la pestaña "config" del Google Sheets conserva su propia tabla de
// radiación como referencia visual para el administrador, pero el valor real
// usado en el cálculo de dimensionamiento sale de este archivo (ver
// CotizadorSolar.jsx y backend/index.js).

const departamentos = [
  {
    nombre: "Antioquia",
    radiacion: 3.5,
    municipios: [
      { nombre: "Medellín", radiacion: 3.5 },
      { nombre: "Bello", radiacion: 3.5 },
      { nombre: "Itagüí", radiacion: 3.5 },
      { nombre: "Envigado", radiacion: 3.5 },
      { nombre: "Sabaneta", radiacion: 3.5 },
      { nombre: "La Estrella", radiacion: 3.5 },
      { nombre: "Caldas", radiacion: 3.5 },
      { nombre: "Copacabana", radiacion: 3.5 },
      { nombre: "Girardota", radiacion: 3.5 },
      { nombre: "Barbosa", radiacion: 3.5 },
      { nombre: "Rionegro", radiacion: 3.8 },
      { nombre: "Apartadó", radiacion: 4.2 },
      { nombre: "Turbo", radiacion: 4.3 },
      { nombre: "Caucasia", radiacion: 4.4 },
      { nombre: "Quibdó", radiacion: 3.2 },
      { nombre: "Andes", radiacion: 3.6 },
      { nombre: "Jericó", radiacion: 3.6 },
      { nombre: "Fredonia", radiacion: 3.6 },
      { nombre: "Amagá", radiacion: 3.5 },
      { nombre: "Támesis", radiacion: 3.6 }
    ]
  },
  {
    nombre: "Atlántico",
    radiacion: 4.8,
    municipios: [
      { nombre: "Barranquilla", radiacion: 4.8 },
      { nombre: "Soledad", radiacion: 4.8 },
      { nombre: "Malambo", radiacion: 4.7 },
      { nombre: "Sabanalarga", radiacion: 4.6 },
      { nombre: "Baranoa", radiacion: 4.6 },
      { nombre: "Puerto Colombia", radiacion: 4.8 },
      { nombre: "Galapa", radiacion: 4.7 }
    ]
  },
  {
    nombre: "Bogotá D.C.",
    radiacion: 3.0,
    municipios: [
      { nombre: "Bogotá", radiacion: 3.0 }
    ]
  },
  {
    nombre: "Bolívar",
    radiacion: 4.8,
    municipios: [
      { nombre: "Cartagena", radiacion: 4.8 },
      { nombre: "Magangué", radiacion: 4.6 },
      { nombre: "El Carmen de Bolívar", radiacion: 4.5 },
      { nombre: "Mompox", radiacion: 4.6 },
      { nombre: "Turbaco", radiacion: 4.7 }
    ]
  },
  {
    nombre: "Boyacá",
    radiacion: 3.5,
    municipios: [
      { nombre: "Tunja", radiacion: 3.5 },
      { nombre: "Duitama", radiacion: 3.6 },
      { nombre: "Sogamoso", radiacion: 3.7 },
      { nombre: "Chiquinquirá", radiacion: 3.5 },
      { nombre: "Paipa", radiacion: 3.6 },
      { nombre: "Puerto Boyacá", radiacion: 4.2 }
    ]
  },
  {
    nombre: "Caldas",
    radiacion: 3.6,
    municipios: [
      { nombre: "Manizales", radiacion: 3.4 },
      { nombre: "Villamaría", radiacion: 3.4 },
      { nombre: "Chinchiná", radiacion: 3.6 },
      { nombre: "La Dorada", radiacion: 4.2 },
      { nombre: "Riosucio", radiacion: 3.6 },
      { nombre: "Anserma", radiacion: 3.6 }
    ]
  },
  {
    nombre: "Caquetá",
    radiacion: 3.8,
    municipios: [
      { nombre: "Florencia", radiacion: 3.8 },
      { nombre: "San Vicente del Caguán", radiacion: 4.0 },
      { nombre: "Puerto Rico", radiacion: 3.9 }
    ]
  },
  {
    nombre: "Casanare",
    radiacion: 4.5,
    municipios: [
      { nombre: "Yopal", radiacion: 4.5 },
      { nombre: "Aguazul", radiacion: 4.5 },
      { nombre: "Villanueva", radiacion: 4.6 },
      { nombre: "Paz de Ariporo", radiacion: 4.6 },
      { nombre: "Trinidad", radiacion: 4.5 }
    ]
  },
  {
    nombre: "Cauca",
    radiacion: 3.6,
    municipios: [
      { nombre: "Popayán", radiacion: 3.6 },
      { nombre: "Santander de Quilichao", radiacion: 3.8 },
      { nombre: "Puerto Tejada", radiacion: 3.9 },
      { nombre: "Piendamó", radiacion: 3.6 },
      { nombre: "Patía", radiacion: 3.8 }
    ]
  },
  {
    nombre: "Cesar",
    radiacion: 4.5,
    municipios: [
      { nombre: "Valledupar", radiacion: 4.5 },
      { nombre: "Aguachica", radiacion: 4.3 },
      { nombre: "Bosconia", radiacion: 4.4 },
      { nombre: "La Jagua de Ibirico", radiacion: 4.6 },
      { nombre: "Codazzi", radiacion: 4.5 }
    ]
  },
  {
    nombre: "Chocó",
    radiacion: 3.2,
    municipios: [
      { nombre: "Quibdó", radiacion: 3.0 },
      { nombre: "Istmina", radiacion: 3.2 },
      { nombre: "Tadó", radiacion: 3.2 },
      { nombre: "Bahía Solano", radiacion: 3.5 },
      { nombre: "Nuquí", radiacion: 3.4 }
    ]
  },
  {
    nombre: "Córdoba",
    radiacion: 4.6,
    municipios: [
      { nombre: "Montería", radiacion: 4.6 },
      { nombre: "Cereté", radiacion: 4.6 },
      { nombre: "Lorica", radiacion: 4.5 },
      { nombre: "Sahagún", radiacion: 4.5 },
      { nombre: "Tierralta", radiacion: 4.4 },
      { nombre: "Montelíbano", radiacion: 4.5 }
    ]
  },
  {
    nombre: "Cundinamarca",
    radiacion: 3.5,
    municipios: [
      { nombre: "Soacha", radiacion: 3.2 },
      { nombre: "Fusagasugá", radiacion: 3.8 },
      { nombre: "Zipaquirá", radiacion: 3.3 },
      { nombre: "Facatativá", radiacion: 3.4 },
      { nombre: "Chía", radiacion: 3.2 },
      { nombre: "Mosquera", radiacion: 3.2 },
      { nombre: "Madrid", radiacion: 3.3 },
      { nombre: "Funza", radiacion: 3.2 },
      { nombre: "Girardot", radiacion: 4.5 },
      { nombre: "La Mesa", radiacion: 4.2 },
      { nombre: "Villeta", radiacion: 4.3 }
    ]
  },
  {
    nombre: "Guajira",
    radiacion: 5.5,
    municipios: [
      { nombre: "Riohacha", radiacion: 5.5 },
      { nombre: "Maicao", radiacion: 5.6 },
      { nombre: "Uribia", radiacion: 6.0 },
      { nombre: "Manaure", radiacion: 5.8 },
      { nombre: "San Juan del Cesar", radiacion: 5.0 },
      { nombre: "Dibulla", radiacion: 5.2 }
    ]
  },
  {
    nombre: "Huila",
    radiacion: 4.5,
    municipios: [
      { nombre: "Neiva", radiacion: 4.5 },
      { nombre: "Pitalito", radiacion: 4.2 },
      { nombre: "Garzón", radiacion: 4.4 },
      { nombre: "La Plata", radiacion: 4.0 },
      { nombre: "Campoalegre", radiacion: 4.5 },
      { nombre: "Rivera", radiacion: 4.5 }
    ]
  },
  {
    nombre: "Magdalena",
    radiacion: 4.8,
    municipios: [
      { nombre: "Santa Marta", radiacion: 4.8 },
      { nombre: "Ciénaga", radiacion: 4.8 },
      { nombre: "Fundación", radiacion: 4.6 },
      { nombre: "El Banco", radiacion: 4.5 },
      { nombre: "Plato", radiacion: 4.6 },
      { nombre: "Aracataca", radiacion: 4.7 }
    ]
  },
  {
    nombre: "Meta",
    radiacion: 4.2,
    municipios: [
      { nombre: "Villavicencio", radiacion: 4.2 },
      { nombre: "Acacías", radiacion: 4.3 },
      { nombre: "Granada", radiacion: 4.4 },
      { nombre: "San Martín", radiacion: 4.5 },
      { nombre: "Puerto López", radiacion: 4.6 },
      { nombre: "Puerto Gaitán", radiacion: 4.8 }
    ]
  },
  {
    nombre: "Nariño",
    radiacion: 3.4,
    municipios: [
      { nombre: "Pasto", radiacion: 3.2 },
      { nombre: "Tumaco", radiacion: 4.2 },
      { nombre: "Ipiales", radiacion: 3.4 },
      { nombre: "Túquerres", radiacion: 3.3 },
      { nombre: "La Unión", radiacion: 3.8 },
      { nombre: "Samaniego", radiacion: 3.6 }
    ]
  },
  {
    nombre: "Norte de Santander",
    radiacion: 4.2,
    municipios: [
      { nombre: "Cúcuta", radiacion: 4.2 },
      { nombre: "Ocaña", radiacion: 4.0 },
      { nombre: "Pamplona", radiacion: 3.6 },
      { nombre: "Villa del Rosario", radiacion: 4.2 },
      { nombre: "Los Patios", radiacion: 4.2 },
      { nombre: "Tibú", radiacion: 4.5 }
    ]
  },
  {
    nombre: "Putumayo",
    radiacion: 3.8,
    municipios: [
      { nombre: "Mocoa", radiacion: 3.6 },
      { nombre: "Puerto Asís", radiacion: 4.0 },
      { nombre: "Orito", radiacion: 3.9 },
      { nombre: "Valle del Guamuez", radiacion: 4.0 }
    ]
  },
  {
    nombre: "Quindío",
    radiacion: 3.8,
    municipios: [
      { nombre: "Armenia", radiacion: 3.8 },
      { nombre: "Calarcá", radiacion: 3.7 },
      { nombre: "Montenegro", radiacion: 3.9 },
      { nombre: "Quimbaya", radiacion: 3.9 },
      { nombre: "La Tebaida", radiacion: 4.0 },
      { nombre: "Circasia", radiacion: 3.7 }
    ]
  },
  {
    nombre: "Risaralda",
    radiacion: 3.8,
    municipios: [
      { nombre: "Pereira", radiacion: 3.8 },
      { nombre: "Dosquebradas", radiacion: 3.8 },
      { nombre: "Santa Rosa de Cabal", radiacion: 3.7 },
      { nombre: "La Virginia", radiacion: 4.0 },
      { nombre: "Quinchía", radiacion: 3.7 },
      { nombre: "Marsella", radiacion: 3.8 }
    ]
  },
  {
    nombre: "Santander",
    radiacion: 4.0,
    municipios: [
      { nombre: "Bucaramanga", radiacion: 4.0 },
      { nombre: "Floridablanca", radiacion: 4.0 },
      { nombre: "Girón", radiacion: 4.1 },
      { nombre: "Piedecuesta", radiacion: 4.1 },
      { nombre: "Barrancabermeja", radiacion: 4.5 },
      { nombre: "San Gil", radiacion: 4.2 },
      { nombre: "Socorro", radiacion: 4.0 },
      { nombre: "Málaga", radiacion: 3.8 }
    ]
  },
  {
    nombre: "Sucre",
    radiacion: 4.8,
    municipios: [
      { nombre: "Sincelejo", radiacion: 4.8 },
      { nombre: "Corozal", radiacion: 4.7 },
      { nombre: "Sampués", radiacion: 4.7 },
      { nombre: "San Marcos", radiacion: 4.6 },
      { nombre: "Tolú", radiacion: 4.8 },
      { nombre: "Coveñas", radiacion: 4.9 }
    ]
  },
  {
    nombre: "Tolima",
    radiacion: 4.2,
    municipios: [
      { nombre: "Ibagué", radiacion: 4.2 },
      { nombre: "Espinal", radiacion: 4.8 },
      { nombre: "Melgar", radiacion: 5.0 },
      { nombre: "Honda", radiacion: 4.8 },
      { nombre: "Chaparral", radiacion: 4.0 },
      { nombre: "Líbano", radiacion: 3.8 },
      { nombre: "Mariquita", radiacion: 4.5 }
    ]
  },
  {
    nombre: "Valle del Cauca",
    radiacion: 4.0,
    municipios: [
      { nombre: "Cali", radiacion: 4.0 },
      { nombre: "Buenaventura", radiacion: 3.8 },
      { nombre: "Palmira", radiacion: 4.2 },
      { nombre: "Tuluá", radiacion: 4.0 },
      { nombre: "Buga", radiacion: 4.1 },
      { nombre: "Cartago", radiacion: 4.0 },
      { nombre: "Yumbo", radiacion: 4.0 },
      { nombre: "Jamundí", radiacion: 4.1 },
      { nombre: "Zarzal", radiacion: 4.2 }
    ]
  },
  {
    nombre: "Arauca",
    radiacion: 4.8,
    municipios: [
      { nombre: "Arauca", radiacion: 4.8 },
      { nombre: "Saravena", radiacion: 4.7 },
      { nombre: "Tame", radiacion: 4.8 },
      { nombre: "Arauquita", radiacion: 4.7 }
    ]
  },
  {
    nombre: "Amazonas",
    radiacion: 3.8,
    municipios: [
      { nombre: "Leticia", radiacion: 3.8 },
      { nombre: "Puerto Nariño", radiacion: 3.8 }
    ]
  },
  {
    nombre: "Guainía",
    radiacion: 4.0,
    municipios: [
      { nombre: "Inírida", radiacion: 4.0 }
    ]
  },
  {
    nombre: "Guaviare",
    radiacion: 4.0,
    municipios: [
      { nombre: "San José del Guaviare", radiacion: 4.0 },
      { nombre: "El Retorno", radiacion: 4.0 }
    ]
  },
  {
    nombre: "Vaupés",
    radiacion: 3.8,
    municipios: [
      { nombre: "Mitú", radiacion: 3.8 }
    ]
  },
  {
    nombre: "Vichada",
    radiacion: 4.5,
    municipios: [
      { nombre: "Puerto Carreño", radiacion: 4.5 },
      { nombre: "La Primavera", radiacion: 4.5 }
    ]
  },
  {
    nombre: "San Andrés y Providencia",
    radiacion: 5.0,
    municipios: [
      { nombre: "San Andrés", radiacion: 5.0 },
      { nombre: "Providencia", radiacion: 5.0 }
    ]
  }
];

export default departamentos;
