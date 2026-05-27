# Manual AppSheet · Control de Herramientas BMW Lindavista

> Guía paso a paso para construir la app sobre `BD_HERRAMIENTAS_v2`.
> Nivel: ejecutivo · Links a docs oficiales en cada sección.

---

## 0. Pre-requisitos

| Item | Cómo |
|---|---|
| Cuenta Google Workspace | Usar la del dominio BMW |
| Archivo subido a Drive | `BD_HERRAMIENTAS_v2.xlsx` → abrir como Google Sheets |
| Acceso AppSheet | https://www.appsheet.com → Sign in with Google |

📚 [Empezar con AppSheet](https://support.google.com/appsheet/answer/10104995)

---

## 1. Crear la app (5 min)

1. AppSheet → **Create** → **App** → **Start with existing data** → **Google Sheets**
2. Selecciona `BD_HERRAMIENTAS_v2` → AppSheet detecta automáticamente las hojas
3. Acepta agregar las 6 hojas como tablas: `FAMILIAS`, `HERRAMIENTAS`, `MOVIMIENTOS`, `USUARIOS`, `DASHBOARD_KPI`, `LEGACY_RESPALDO`
4. App name: **`Control Herramientas BMW`**

📚 [Add data sources](https://support.google.com/appsheet/answer/10106762)

---

## 2. Configurar tablas (Data → Tables)

### `HERRAMIENTAS` — tabla principal

| Setting | Valor |
|---|---|
| Are updates allowed? | **Updates, Adds, Deletes** |
| Key | `ID_HERRAMIENTA` |
| Label | `NUM_PARTE_PIEZA` (lo que ve el técnico) |

### `MOVIMIENTOS` — capturas

| Setting | Valor |
|---|---|
| Are updates allowed? | **Updates, Adds** (no deletes para auditoría) |
| Key | `ID_MOV` |
| Label | `ID_MOV` |

### `FAMILIAS` / `USUARIOS`

| Setting | Valor |
|---|---|
| Are updates allowed? | **Updates, Adds** |
| Key | `ID_FAMILIA` / `ID_USUARIO` |
| Label | `NUM_PARTE_FAMILIA` / `NOMBRE` |

### `LEGACY_RESPALDO`

| Setting | Valor |
|---|---|
| Are updates allowed? | **Read-Only** |

📚 [Table settings](https://support.google.com/appsheet/answer/10106435)

---

## 3. Configurar columnas (Data → Columns)

### `HERRAMIENTAS` — ajustes por columna

| Columna | Type | Show? | Editable? | Required? | Notas |
|---|---|---|---|---|---|
| `ID_HERRAMIENTA` | Number | ✅ | ❌ | ✅ | Key |
| `ID_FAMILIA` | Ref → FAMILIAS | ✅ | ✅ | ❌ | Crea relación 1:N |
| `NUM_PARTE_FAMILIA` | Text | ✅ | ❌ | ❌ | Auto desde Ref |
| `NUM_PARTE_PIEZA` | Text | ✅ | ✅ | ❌ | |
| `TIPO` | Enum | ✅ | ✅ | ✅ | Valores: FAMILIA_COMPLETA, PIEZA_INDIVIDUAL, GENERICO |
| `DESCRIPCION` | LongText | ✅ | ✅ | ❌ | |
| `GRUPO_CONTABLE` | Text | ✅ | ✅ | ❌ | |
| `UBICACION` | Enum | ✅ | ✅ | ✅ | Auto-popula con valores existentes |
| `CANT_TOTAL` | Number | ✅ | ✅ | ✅ | |
| `CANT_DISPONIBLE` | Number | ✅ | ❌ | ❌ | App Formula (ver §4) |
| `ESTATUS` | Enum | ✅ | ❌ | ❌ | App Formula |
| `FOTO_URL` | Image | ✅ | ✅ | ❌ | Cámara o galería |
| `QR_UBICACION` | Image | ✅ | ❌ | ❌ | Generado por Apps Script |
| `NOTAS` | LongText | ✅ | ✅ | ❌ | |
| `FECHA_ALTA` | Date | ❌ | ❌ | ❌ | Histórico |

### `MOVIMIENTOS` — ajustes por columna

| Columna | Type | Initial Value | Editable? | Notas |
|---|---|---|---|---|
| `ID_MOV` | Text | `CONCATENATE("MOV-", TEXT(NOW(),"YYYYMMDD"), "-", UNIQUEID())` | ❌ | Key auto |
| `FECHA_PRESTAMO` | DateTime | `NOW()` | ❌ | |
| `ID_HERRAMIENTA` | Ref → HERRAMIENTAS | — | ✅ | Required |
| `NUM_PARTE_BUSQUEDA` | Text | — | ✅ | Para búsqueda rápida |
| `SOLICITANTE_TIPO` | Enum | `"TECNICO"` | ✅ | Required |
| `SOLICITANTE_NOMBRE` | Ref → USUARIOS | — | ✅ | Show If TIPO ≠ OTRO (ver §4) |
| `NOMBRE_EXTERNO` | Text | — | ✅ | Show If TIPO = OTRO |
| `FECHA_DEV_ESPERADA` | Date | `TODAY()+1` | ✅ | |
| `FECHA_DEV_REAL` | DateTime | — | ❌ | Se llena por acción DEVOLVER |
| `ESTADO_ACTUAL` | Enum | `"PRESTADO"` | ❌ | |
| `OBSERVACIONES` | LongText | — | ✅ | |
| `FOTO_ENTREGA` | Image | — | ✅ | |
| `FIRMA_URL` | Drawing | — | ✅ | Required si TIPO = OTRO |
| `USUARIO_REGISTRO` | Email | `USEREMAIL()` | ❌ | Auditoría |

📚 [Column types](https://support.google.com/appsheet/answer/10108043)

---

## 4. Expresiones críticas (copy-paste)

### App Formula: `HERRAMIENTAS[CANT_DISPONIBLE]`
```
[CANT_TOTAL] - COUNT(
  SELECT(
    MOVIMIENTOS[ID_MOV],
    AND([ID_HERRAMIENTA] = [_THISROW].[ID_HERRAMIENTA],
        [ESTADO_ACTUAL] = "PRESTADO")
  )
)
```

### App Formula: `HERRAMIENTAS[ESTATUS]`
```
IFS(
  [CANT_DISPONIBLE] <= 0, "AGOTADO",
  [CANT_DISPONIBLE] < [CANT_TOTAL], "PARCIAL",
  TRUE, "DISPONIBLE"
)
```

### Show_If: `MOVIMIENTOS[SOLICITANTE_NOMBRE]`
```
[SOLICITANTE_TIPO] <> "OTRO"
```

### Show_If: `MOVIMIENTOS[NOMBRE_EXTERNO]`
```
[SOLICITANTE_TIPO] = "OTRO"
```

### Required_If: `MOVIMIENTOS[FIRMA_URL]`
```
OR([SOLICITANTE_TIPO] = "OTRO", [SOLICITANTE_TIPO] = "CONTROL")
```

### Valid_If en `MOVIMIENTOS[ID_HERRAMIENTA]` (no permitir prestar sin stock)
```
LOOKUP([_THIS], "HERRAMIENTAS", "ID_HERRAMIENTA", "CANT_DISPONIBLE") > 0
```

### Initial Value: `MOVIMIENTOS[SOLICITANTE_NOMBRE]` (auto-detectar técnico actual)
```
ANY(SELECT(USUARIOS[ID_USUARIO], [EMAIL] = USEREMAIL()))
```

📚 [Expressions reference](https://support.google.com/appsheet/answer/10107647)

---

## 5. Vistas (UX → Views)

### 5.1 `HOME` (Dashboard view)

| Setting | Valor |
|---|---|
| View type | **Dashboard** |
| Position | Center (primary) |
| Icon | `home` |

Compone 3 sub-vistas:
- **KPIs** (vista tipo "card" sobre tabla virtual)
- **Acciones rápidas** (3 botones: Escanear / Buscar / Mis Préstamos)
- **Alertas** (lista de Vencidos filtrada)

### 5.2 `INVENTARIO` (Deck view)

| Setting | Valor |
|---|---|
| View type | **Deck** |
| For this data | `HERRAMIENTAS` |
| Sort by | `ID_HERRAMIENTA` (asc) |
| Group by | `UBICACION` |
| Main image | `FOTO_URL` |
| Primary header | `CONCATENATE("#", [ID_HERRAMIENTA], " · ", [NUM_PARTE_PIEZA])` |
| Secondary header | `[DESCRIPCION]` |
| Summary column | `ESTATUS` |
| Quick edit columns | (ninguna en deck) |

### 5.3 `BUSCAR_ID` (Form view simplificada)

Solo un campo: `ID_HERRAMIENTA` (Number). Action → abrir Detail con ese ID.

Búsqueda predictiva nativa: el técnico teclea "27" y AppSheet sugiere 270, 273, etc.

### 5.4 `DETALLE_HERRAMIENTA` (Detail view)

| Setting | Valor |
|---|---|
| View type | **Detail** |
| Header style | **Hero** (foto grande arriba) |
| Show actions at top | ✅ |
| Actions | PRESTAR, DEVOLVER, EDITAR |

### 5.5 `NUEVO_PRESTAMO` (Form view)

| Setting | Valor |
|---|---|
| View type | **Form** |
| For this data | `MOVIMIENTOS` |
| Page style | **Wizard** (campo por pantalla, más fácil en móvil) |
| Show in nav bar | ❌ (se accede solo vía acción PRESTAR) |

### 5.6 `MIS_PRESTAMOS` (Table view)

| Setting | Valor |
|---|---|
| View type | **Table** |
| For this data | `MOVIMIENTOS` |
| Filter | `AND([USUARIO_REGISTRO] = USEREMAIL(), [ESTADO_ACTUAL] = "PRESTADO")` |
| Sort by | `FECHA_PRESTAMO` (desc) |

### 5.7 `VENCIDOS` (Table view — solo Manager)

| Setting | Valor |
|---|---|
| Filter | `AND([ESTADO_ACTUAL] = "PRESTADO", [FECHA_DEV_ESPERADA] < TODAY())` |
| Show If | `USEREMAIL() = "manager@bmwlindavista.com"` |
| Row color | Rojo |

### 5.8 `FAMILIAS_BMW` (Deck view)

| Setting | Valor |
|---|---|
| For this data | `FAMILIAS` |
| Primary header | `[NUM_PARTE_FAMILIA]` |
| Drill-down | Lista de HERRAMIENTAS hijas (Ref reverso) |

📚 [View types](https://support.google.com/appsheet/answer/10108199)

---

## 6. Acciones (Behavior → Actions)

### Acción `PRESTAR` (sobre HERRAMIENTAS)

| Setting | Valor |
|---|---|
| Action name | `PRESTAR` |
| For a record of this table | `HERRAMIENTAS` |
| Do this | **Data: add a new row to another table using values from this row** |
| Target table | `MOVIMIENTOS` |
| Prominence | **Display prominently** |
| Icon | `arrow-up` |
| Only if condition | `[CANT_DISPONIBLE] > 0` |
| Set columns | `ID_HERRAMIENTA = [ID_HERRAMIENTA]` y `NUM_PARTE_BUSQUEDA = [NUM_PARTE_PIEZA]` |

### Acción `DEVOLVER` (sobre MOVIMIENTOS)

| Setting | Valor |
|---|---|
| Do this | **Data: set the values of some columns** |
| Set these columns | `FECHA_DEV_REAL = NOW()`, `ESTADO_ACTUAL = "DEVUELTO"` |
| Only if condition | `[ESTADO_ACTUAL] = "PRESTADO"` |
| Confirmation prompt | "¿Confirmar devolución?" |

### Acción `MARCAR_VENCIDO` (sistema, bot diaria)

| Setting | Valor |
|---|---|
| Set columns | `ESTADO_ACTUAL = "VENCIDO"` |
| Condition | `AND([ESTADO_ACTUAL] = "PRESTADO", [FECHA_DEV_ESPERADA] < TODAY())` |

📚 [Actions overview](https://support.google.com/appsheet/answer/10107968)

---

## 7. Bots (Automation)

### Bot 1: Marcar vencidos (Daily 7AM)

| Setting | Valor |
|---|---|
| Event type | **Schedule** |
| Frequency | Daily 07:00 |
| Process | Run action `MARCAR_VENCIDO` on all MOVIMIENTOS where condition matches |

### Bot 2: Resumen ejecutivo (Daily 6PM)

| Setting | Valor |
|---|---|
| Event type | **Schedule** |
| Process step | **Send email** |
| To | `[manager-email]` |
| Subject | `"Resumen del día - Préstamos BMW"` |
| Body template | (ver §8) |

### Bot 3: Alerta solicitante OTRO (OnChange)

| Setting | Valor |
|---|---|
| Event type | **Data change** → Adds in MOVIMIENTOS |
| Condition | `[SOLICITANTE_TIPO] = "OTRO"` |
| Process step | Send push notification al Manager |

### Bot 4: Stock crítico (OnChange)

| Setting | Valor |
|---|---|
| Event type | **Data change** → Updates in HERRAMIENTAS |
| Condition | `AND([_THISROW_BEFORE].[CANT_DISPONIBLE] > 0, [_THISROW_AFTER].[CANT_DISPONIBLE] = 0)` |
| Process step | Push al Manager: "AGOTADA: #[ID] [DESCRIPCION]" |

### Bot 5: Recordatorio vencidos (Daily 8AM)

| Setting | Valor |
|---|---|
| Event type | **Schedule** Daily 08:00 |
| For each | `MOVIMIENTOS` where `[ESTADO_ACTUAL] = "VENCIDO"` |
| Process step | Email al técnico con detalle de la herramienta |

📚 [Automation bots](https://support.google.com/appsheet/answer/11473388)

---

## 8. Plantilla email resumen diario

```
Asunto: Resumen del día — Préstamos BMW Lindavista <<TEXT(TODAY(),"DD/MM/YYYY")>>

Hola Manager,

Resumen operativo de hoy:

📊 KPIs:
• Préstamos nuevos: <<COUNT(SELECT(MOVIMIENTOS[ID_MOV], [FECHA_PRESTAMO] >= TODAY()))>>
• Devoluciones: <<COUNT(SELECT(MOVIMIENTOS[ID_MOV], AND([FECHA_DEV_REAL] >= TODAY(), [ESTADO_ACTUAL] = "DEVUELTO")))>>
• Pendientes activos: <<COUNT(SELECT(MOVIMIENTOS[ID_MOV], [ESTADO_ACTUAL] = "PRESTADO"))>>
• Vencidos: <<COUNT(SELECT(MOVIMIENTOS[ID_MOV], [ESTADO_ACTUAL] = "VENCIDO"))>>

⚠️ Vencidos al cierre:
<<Start: SELECT(MOVIMIENTOS[ID_MOV], [ESTADO_ACTUAL] = "VENCIDO")>>
- #<<[ID_HERRAMIENTA]>> · <<[NUM_PARTE_BUSQUEDA]>> — <<[SOLICITANTE_NOMBRE]>> (vencida <<[FECHA_DEV_ESPERADA]>>)
<<End>>

Abrir app: https://www.appsheet.com/start/[APP_ID]
```

📚 [Email template syntax](https://support.google.com/appsheet/answer/10106918)

---

## 9. Roles y permisos (Security → Roles)

| Rol | Filtro de datos | Vistas visibles |
|---|---|---|
| **Manager** | Todo | Todas + VENCIDOS + LEGACY |
| **Tecnico** | `MOVIMIENTOS`: solo donde `[USUARIO_REGISTRO] = USEREMAIL()` | HOME, INVENTARIO, BUSCAR, MIS_PRESTAMOS |
| **Asesor** | Igual que técnico | Igual |
| **Control** | Todo en lectura | Todas read-only |

### Setting clave
Security → **Require user sign-in: ON**
Security → **User settings: Use email**

📚 [Security and roles](https://support.google.com/appsheet/answer/10101952)

---

## 10. Configuración offline

Settings → **Offline/Sync**:
- ✅ The app can start when offline
- ✅ Sync on start
- Delay sync = 0
- Sync after changes = ON

📚 [Offline use](https://support.google.com/appsheet/answer/10107297)

---

## 11. Branding visual

UX → **Brand**:
- App color: `#1F4E79` (azul BMW corporativo)
- Background: `Light`
- Header & footer: Show
- Launch image: logo BMW Lindavista
- App icon: ícono de llave inglesa azul

UX → **Format Rules** (formato condicional):
- Si `ESTATUS = "AGOTADO"` → texto rojo + ícono `alert-circle`
- Si `ESTATUS = "DISPONIBLE"` → texto verde + ícono `check`
- Si `ESTADO_ACTUAL = "VENCIDO"` → fondo rojo claro

📚 [Format rules](https://support.google.com/appsheet/answer/10108186)

---

## 12. Testing checklist (antes del piloto)

- [ ] Crear préstamo escaneando ubicación → buscar #273 → confirmar
- [ ] CANT_DISPONIBLE bajó en 1 en HERRAMIENTAS
- [ ] Devolver → CANT_DISPONIBLE volvió a su valor
- [ ] Crear préstamo con SOLICITANTE_TIPO = OTRO → exige firma
- [ ] Forzar fecha pasada → bot marca VENCIDO al día siguiente
- [ ] Email diario llega al Manager a las 6PM
- [ ] Modo avión → registrar préstamo → reconectar → sincroniza
- [ ] Técnico solo ve sus propios préstamos
- [ ] Manager ve todos los préstamos + VENCIDOS

---

## 13. Límites y workarounds AppSheet

| Límite | Valor | Workaround |
|---|---|---|
| Filas por tabla (perf) | ~200k | Archivar MOVIMIENTOS por año |
| Sync time | 3–8 seg online | Habilitar offline + delay 0 |
| Bots por app (free) | 2 | Plan Core $5/u/mes para ilimitados |
| Imágenes en row | 10 MB | Comprimir antes de subir |
| Usuarios gratis | 10 | Plan Core para más |
| Apps Script trigger desde AppSheet | Sí, vía webhook | Útil para QR generation |

📚 [Limits and pricing](https://about.appsheet.com/pricing/)

---

## 14. Siguiente paso

Punto 3 del proyecto: **Apps Script** para generar QR de ubicaciones + validaciones server-side + reportes auditoría.
