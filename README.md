# 📘 Cotizador Solar - Solartech Energy

Este proyecto es una aplicación web para cotizar proyectos de energía solar con una interfaz amigable, generación automática de propuestas en PDF y envío de correos. Está dividido en dos partes: **frontend (React)** y **backend (Node.js + Express)**.

---

## 🗂 Estructura del proyecto
```
cotizador-solar/
├── backend/
│   ├── index.js              # Servidor Express y generación de PDFs
│   ├── package.json          # Scripts y dependencias del backend
│   ├── .env                  # Variables de entorno
│   └── public/               # PDFs generados
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Formulario y lógica del cotizador
│   │   └── index.js          # Punto de entrada de React
│   ├── public/
│   ├── package.json
│   └── .env
└── README.md
```

---

## ⚙️ Instalación y ejecución

### 1. Clonar el proyecto (o navegar a tu carpeta creada)
```bash
cd cotizador-solar
```

### 2. Instalar y correr el backend
```bash
cd backend
npm install
npm run start  # o npm run dev si usas nodemon
```

### 3. Instalar y correr el frontend
```bash
cd ../frontend
npx create-react-app .
npm install
npm start
```

La app estará disponible en `http://localhost:3000` y el servidor en `http://localhost:4000`.

---

## 📤 .env (Frontend)
Crea un archivo `.env` en `frontend/` con:
```
REACT_APP_API_URL=http://localhost:4000
```

## 📤 .env (Backend)
Puedes agregar claves como:
```
PORT=4000
```

---

## 🛠 Tecnologías usadas
- React (Frontend)
- Tailwind CSS (opcional para estilos)
- Express.js (Backend)
- pdf-lib (PDF)
- uuid (nombres únicos de archivos)
- body-parser & cors

---


Creado por **Ferragro S.A.S** ⚡
