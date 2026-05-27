BD-HERRAMIENTAS
> Sistema digital de control de herramientas — BMW Lindavista, Área Postventa
[![Status](https://img.shields.io/badge/status-en%20desarrollo-yellow)]()
[![Platform](https://img.shields.io/badge/platform-Google%20Workspace-blue)]()
[![Tech](https://img.shields.io/badge/stack-Sheets%20%2B%20AppSheet%20%2B%20Looker-green)]()
---
🎯 Propósito
Migración del control de herramientas del área de postventa: de Google Forms estático a una aplicación móvil AppSheet con backend Google Sheets normalizado, escaneo QR de ubicaciones, modo offline, alertas automáticas y trazabilidad completa.
🏗️ Arquitectura
```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  APPSHEET    │────▶│  GOOGLE SHEETS  │────▶│ LOOKER STUDIO│
│  (Mobile UI) │◀────│  (Backend BD)   │     │  (Dashboard) │
└──────────────┘     └─────────────────┘     └──────────────┘
       │                      ▲
       │                      │
       ▼                      │
┌──────────────┐     ┌─────────────────┐
│  Escaneo QR  │     │   APPS SCRIPT   │
│  Push Notif  │     │   (Code.gs)     │
│  Firma       │     │                 │
└──────────────┘     └─────────────────┘
```
📂 Estructura del repositorio
```
BD-HERRAMIENTAS/
├── README.md                          ← Este archivo
├── .gitignore                         ← Archivos sensibles excluidos
├── apps_script/
│   └── Code.gs                        ← Backend de automatización
├── docs/
│   ├── Plan_Control_Herramientas.docx  ← Plan estratégico
│   ├── Manual_AppSheet.docx            ← Construcción de la app
│   ├── Manual_AppSheet.md              ← Versión markdown
│   ├── Manual_Apps_Script_y_GitHub.docx
│   └── QR_Ubicaciones.pdf              ← QRs imprimibles
└── esquema/
    └── BD_HERRAMIENTAS_v2_PLANTILLA.xlsx  ← Esquema sin datos
```
🗃️ Modelo de datos
Tabla `FAMILIAS`
Catálogo de familias BMW (Núm. Parte grande, ej. `83300496223`).
Tabla `HERRAMIENTAS` (maestro)
875 herramientas con ID 1–875, fórmulas de disponibilidad calculadas.
Tipo	Cantidad	Descripción
`FAMILIA_COMPLETA`	242	Solo número de familia
`PIEZA_INDIVIDUAL`	589	Piezas individuales
`GENERICO`	44	Consumibles homologados
Tabla `MOVIMIENTOS`
Préstamos y devoluciones con auditoría completa, firma digital, foto de entrega.
Tabla `USUARIOS`
Catálogo de técnicos, asesores y personal de control.
🛠️ Stack tecnológico
Capa	Tecnología	Función
Presentación	AppSheet	UI móvil (Android/iOS/Web)
Datos	Google Sheets	Backend normalizado
Lógica	Apps Script	Triggers, validaciones, QR generation
Analítica	Looker Studio	Dashboard de gestión
Versionado	GitHub	Control de código y documentación
⚙️ Configuración inicial
1. Backend de datos
```
1. Subir BD_HERRAMIENTAS_v2_PLANTILLA.xlsx a Google Drive
2. Abrir con Google Sheets (conversión automática)
3. Importar datos reales en hoja HERRAMIENTAS
```
2. Apps Script
```
1. Google Sheet → Extensiones → Apps Script
2. Pegar contenido de apps_script/Code.gs
3. Editar sección CONFIG (EMAIL_MANAGER)
4. Ejecutar instalarTriggers() una vez
```
3. AppSheet
```
1. appsheet.com → Create → App → from Google Sheets
2. Seguir docs/Manual_AppSheet.docx
3. Configurar bots de automatización (sección 7)
```
4. Looker Studio
```
1. Conectar dashboard existente al nuevo esquema
2. Validar KPIs (sección 9 del Plan)
```
📊 KPIs principales
Préstamos activos en tiempo real
Herramientas vencidas (no devueltas a tiempo)
Top técnicos por uso
Disponibilidad por ubicación
Tiempo promedio de préstamo
Histórico mensual
🤖 Automatizaciones
Bot	Frecuencia	Acción
`marcarVencidos`	Diario 07:00	Marca PRESTADO vencidos como VENCIDO
`validarIntegridadDatos`	Lunes 06:00	Audita BD semanal
`reporteAuditoriaMensual`	Día 1 mes 09:00	Email con CSV del mes anterior
AppSheet bot resumen	Diario 18:00	Email ejecutivo al Manager
AppSheet bot OTRO	OnChange	Push cuando solicitante externo
AppSheet bot stock	OnChange	Alerta de agotamiento
🔐 Seguridad
Repo privado (acceso solo a personal autorizado)
Datos productivos NO se commitean (ver `.gitignore`)
Credenciales y emails en placeholders
Acceso a la app por Google SSO con dominio BMW
📞 Equipo operativo
Asesores: Quetzal, Oscar, Andres, Javier
Técnicos: Hugo, Denilson, Angel, Oswaldo, Cristhian, Juvenal, Manuel, Carlos, Toño
📝 Cambios recientes
2026-05-27 — Estructura inicial del repo
2026-05-27 — Apps Script v1.0 con 6 funciones core
2026-05-27 — Plantilla XLSX normalizada (3 tablas)
2026-05-27 — Documentación técnica completa
📄 Licencia
Uso interno BMW Lindavista. Todos los derechos reservados.
---
Mantenido por: Área Manager · Postventa BMW Lindavista
