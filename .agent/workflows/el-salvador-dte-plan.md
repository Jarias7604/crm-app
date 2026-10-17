# Workflow: Onboarding Autónomo Express de Facturación Electrónica (DTE) - El Salvador
## Arias CRM — Módulo de Facturación Electrónica Multi-Empresa

---

## 1. Visión y Propuesta de Valor
Convertir un proceso tradicionalmente tedioso y burocrático (que a las empresas les toma semanas o meses con consultores externos) en un **asistente de autoservicio guiado de menos de 30 minutos** dentro de Arias CRM.

Cualquier empresa o administrador en El Salvador podrá:
1. Conectar su negocio con el **Ministerio de Hacienda (MH)** en 4 pasos sencillos.
2. Ejecutar automáticamente el **set de pruebas mínimas de acreditación** con 1 solo clic.
3. Emitir **Facturas de Consumidor Final (01)** y **Comprobantes de Crédito Fiscal (03)** en segundos, con firma digital JWS, Sello de Recepción oficial, generación de PDF con Código QR oficial del MH y despacho automático por WhatsApp y Correo Electrónico.

---

## 2. Arquitectura de Integración

```
+-----------------------------------------------------------------------------------+
|                              ARIAS CRM (Frontend React)                           |
|  - Wizard de Vinculación en 4 Pasos (Videos explicativos breves + Tooltips)       |
|  - Facturador Rápido: Consumidor Final (01) / Crédito Fiscal (03)                 |
|  - Switch de Estado: Modo Pruebas (00) / Modo Producción (01)                     |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼ HTTPS
+-----------------------------------------------------------------------------------+
|                        SUPABASE EDGE FUNCTIONS (Backend Seguro)                  |
|                                                                                   |
|  1. `dte-firmador`:                                                               |
|     - Firma el JSON del DTE con la llave privada del contribuyente                |
|     - Algoritmo RSASSA-PKCS1-v1_5 con SHA-512 (Estándar JWS RFC 7515)             |
|     - Llaves privadas protegidas en Supabase Vault (no expuestas al cliente)      |
|                                                                                   |
|  2. `dte-hacienda-gateway`:                                                       |
|     - Autenticación periódica (/seguridad/auth) y caché de token Bearer (24h)     |
|     - Transmisión del JWS (/fesv/recepciondte)                                    |
|     - Recepción del `selloRecibido` y auditoría fiscal                            |
|     - Manejo de contingencia (almacenamiento en cola si Hacienda está caída)      |
+-----------------------------------------------------------------------------------+
                    │                                            │
                    ▼                                            ▼
+---------------------------------------+    +--------------------------------------+
|    SUPABASE DATABASE (PostgreSQL)     |    |       MINISTERIO DE HACIENDA         |
|  - `dte_configuracion` (Credenciales) |    |  - Ambiente Pruebas: sandbox (00)    |
|  - `dte_documentos` (JSONs, Sellos)   |    |  - Ambiente Producción: live (01)    |
|  - `dte_catalogos_mh` (Actividades,   |    |  - Portal de Consulta Pública (QR)   |
|     Departamentos, Municipios)        |    +--------------------------------------+
+---------------------------------------+
```

---

## 3. El Wizard Autónomo Express: "Conecta con Hacienda en 30 Minutos"

El asistente interactivo guía al usuario paso a paso con validaciones en tiempo real:

```
[ Paso 1: Perfil Fiscal ] ➔ [ Paso 2: Certificado Digital ] ➔ [ Paso 3: Conexión API ] ➔ [ Paso 4: Pruebas Automáticas ] ➔ ¡Emisión Activa!
```

### Paso 1: Perfil Fiscal Inteligente (5 minutos)
- **Campos del Contribuyente:**
  - NIT (formato con guiones o 14 dígitos).
  - NRC (Número de Registro de Contribuyente).
  - Nombre Comercial y Razón Social.
  - **Actividad Económica:** Buscador con autocompletado del Catálogo Oficial del MH (ej. escribe *"software"* y autoselecciona *"62010 - Programación informática"*).
  - **Ubicación Oficial:** Selectores en cascada según Catálogos 11 y 12 del MH (Departamento ➔ Municipio / Distrito ➔ Dirección complementaria).
  - Teléfono y Correo de emisión.
- **Recursos de apoyo:** Video de 1 minuto explicando cómo obtener estos datos exactos de su tarjeta de IVA.

### Paso 2: Certificado Digital de Firma (5 minutos)
- El usuario arrastra su archivo de certificado digital (`.crt`, `.p12` o `.key`) y digita su contraseña de firma.
- **Seguridad:**
  - Archivo cifrado con **AES-256** en Supabase Vault.
  - La clave privada jamás se expone al cliente web ni a logs.
- **Validación Instantánea:** El sistema verifica en memoria que la contraseña corresponda al certificado antes de guardarlo.
- **Recursos de apoyo:** Micro-tutorial: *"Cómo descargar tu certificado de firma gratuito desde el portal del Ministerio de Hacienda"*.

### Paso 3: Credenciales de API de Hacienda (5 minutos)
- Campos:
  - **Ambiente:** `Pruebas (00)` / `Producción (01)`.
  - **Usuario API** (NIT o usuario asignado por el MH).
  - **Clave API del MH** (Password de transmisión).
- **Botón "Probar Conexión con Hacienda":**
  - Ejecuta una autenticación real contra `/seguridad/auth` de Hacienda.
  - En 2 segundos valida y confirma con un badge verde si la conexión fue exitosa.
  - Si hay error de credenciales, lo explica claramente al usuario.

### Paso 4: Simulador Automatizado de Pruebas (10 minutos)
Para pasar a producción, el MH exige que todo contribuyente transmita exitosamente un paquete de pruebas mínimas en su sandbox.
- **Innovación en Arias CRM:**
  - Botón: **"Ejecutar Set de Pruebas de Hacienda con 1 Clic"**.
  - El sistema crea y transmite automáticamente los casos requeridos:
    1. Factura Consumidor Final (01) con ventas gravadas.
    2. Factura con descuento y ventas exentas.
    3. Comprobante de Crédito Fiscal (03) con retención de IVA (1%).
    4. Nota de Crédito (05) vinculada a una factura previa.
    5. Factura de Sujeto Excluido (14).
  - Muestra una barra de progreso interactiva (`15/15 DTEs procesados con Sello de Recepción`).
  - Genera el reporte oficial de pruebas listo para subir a Hacienda y solicitar el pase a producción.

### Paso 5: Activación de Producción
- Una vez Hacienda autoriza a la empresa, el usuario solo activa el switch a **Producción (01)** y queda emitiendo de inmediato.

---

## 4. Emisión Diaria en 2 Clics

### Factura de Consumidor Final (Tipo 01)
- Venta a personas naturales o clientes al detalle.
- Montos menores a $1,142.86 USD: no requiere DUI/NIT obligatorio (permite cliente mostrador).
- Montos superiores a $1,142.86 USD: validación obligatoria de DUI o NIT.
- Timbrado instantáneo en menos de 2 segundos.

### Comprobante de Crédito Fiscal - CCF (Tipo 03)
- Venta entre empresas / contribuyentes de IVA.
- Requiere NIT y NRC del cliente.
- Desglose automático: Subtotal + IVA 13% + Retención de IVA 1% (Grandes Contribuyentes).

### Entregables Automáticos al Cliente
1. **Representación Gráfica (PDF):**
   - Diseño corporativo premium con logo de la empresa.
   - Código de Generación (UUID), Número de Control y Sello de Recepción.
   - **Código QR oficial:** Abre la consulta pública en `admin.factura.gob.sv`.
2. **Archivo JSON Oficial:** Formato firmado JWS exigido por la ley.
3. **Despacho Multicanal:**
   - Envío directo a WhatsApp con PDF y enlaces.
   - Envío automático por Correo Electrónico con JSON y PDF adjuntos.

---

## 5. Modo de Contingencia (Cumplimiento Legal)
Si los servidores de Hacienda no responden o se pierde la conexión a internet:
- El CRM emite en `tipoOperacion = 2` (Contingencia).
- El cliente recibe su comprobante provisional con Código de Generación.
- Una cola programada en Supabase retransmite automáticamente los DTEs pendientes una vez restablecido el servicio de Hacienda (dentro de las 24-48 horas permitidas por ley).

---

## 6. Esquema de Base de Datos (Supabase)

```sql
-- Configuración por empresa
CREATE TABLE IF NOT EXISTS dte_configuracion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
    ambiente VARCHAR(2) NOT NULL DEFAULT '00', -- '00': Pruebas, '01': Producción
    nit VARCHAR(17) NOT NULL,
    nrc VARCHAR(10) NOT NULL,
    nombre_comercial TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    cod_actividad VARCHAR(10) NOT NULL,
    desc_actividad TEXT NOT NULL,
    depto_codigo VARCHAR(2) NOT NULL,
    municipio_codigo VARCHAR(2) NOT NULL,
    direccion_complemento TEXT NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    correo_emisor VARCHAR(100) NOT NULL,
    tipo_establecimiento VARCHAR(2) DEFAULT '02',
    
    mh_user VARCHAR(50),
    mh_password_encrypted TEXT,
    certificado_storage_path TEXT,
    clave_certificado_encrypted TEXT,
    
    estado_acreditacion VARCHAR(20) DEFAULT 'pendiente',
    correlativo_factura BIGINT DEFAULT 1,
    correlativo_ccf BIGINT DEFAULT 1,
    correlativo_nota_credito BIGINT DEFAULT 1,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de DTEs emitidos
CREATE TABLE IF NOT EXISTS dte_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    factura_id UUID REFERENCES facturas(id) ON DELETE SET NULL,
    
    tipo_dte VARCHAR(2) NOT NULL,
    codigo_generacion UUID NOT NULL UNIQUE,
    numero_control VARCHAR(35) NOT NULL,
    sello_recepcion VARCHAR(50),
    fecha_emision DATE NOT NULL,
    hora_emision TIME NOT NULL,
    
    estado VARCHAR(20) NOT NULL, -- 'GENERADO', 'FIRMADO', 'RECIBIDO', 'RECHAZADO', 'CONTINGENCIA'
    mensaje_hacienda TEXT,
    
    dte_json JSONB NOT NULL,
    jws_firmado TEXT,
    pdf_url TEXT,
    
    receptor_tipo_doc VARCHAR(2),
    receptor_num_doc VARCHAR(20),
    receptor_nrc VARCHAR(10),
    receptor_nombre TEXT NOT NULL,
    receptor_correo TEXT,
    
    total_gravada NUMERIC(12,2) DEFAULT 0,
    total_iva NUMERIC(12,2) DEFAULT 0,
    total_retencion NUMERIC(12,2) DEFAULT 0,
    monto_total NUMERIC(12,2) NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Fases de Ejecución

1. **Fase 1: Motor Criptográfico (Edge Function `dte-firmador`)**
   - Implementar la firma de payloads JSON con algoritmo RSASSA-PKCS1-v1_5 / SHA-512 (estándar JWS).
2. **Fase 2: Conector API Hacienda (Edge Function `dte-hacienda-gateway`)**
   - Endpoints de autenticación (`/seguridad/auth`) y recepción (`/fesv/recepciondte`).
3. **Fase 3: Asistente UI de 4 Pasos (Wizard Express)**
   - Formulario guiado, videos embebidos de 1 minuto y botón de test de conexión en vivo.
4. **Fase 4: Generador de Pruebas Automático (Sandbox)**
   - Ejecución del set de pruebas mínimas con 1 clic y generación de reporte de acreditación.
5. **Fase 5: Facturador Rápido y Representación Gráfica (PDF + QR + WhatsApp)**
   - Emisión cotidiana en menos de 2 clics para el usuario final.
