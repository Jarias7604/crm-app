# 📄 Manual de Usuario - CRM Enterprise (Admin)

Bienvenido al manual oficial de uso para el **CRM Enterprise**. Este documento describe todas las funcionalidades clave para que tu demo sea un éxito y para que el equipo pueda utilizar el software al 100%.

---

## 🚀 1. Dashboard (Cuadro de Mando)
El Dashboard es el corazón del sistema. Proporciona una vista rápida y visual de toda la operación.

- **KPI Cards**: Muestran el Pipeline Total (dinero en juego), Total de Leads, Ventas Ganadas y Tasa de Conversión.
- **Embudo de Ventas (Funnel)**: Representación visual del flujo de tus leads desde que entran hasta que se cierran.
- **Fuentes de Leads**: Gráfico de sectores que muestra de dónde vienen tus clientes (Redes Sociales, Web, Referidos, etc.).
- **Priorización Estratégica**: Una gráfica de barras que te permite ver cuántos leads "Altos" o "Urgentes" tienes. Si haces clic en una barra, el sistema te filtrará esos leads automáticamente.

---

## 👥 2. Gestión de Leads
En el menú **Leads** encontrarás toda la gestión comercial.

### Crear un Lead
- Haz clic en **+ Nuevo**.
- Completa la información. Si eres Admin, puedes asignar el lead a cualquier miembro de tu equipo.
- El lead aparecerá en la vista de cuadrícula o lista según tu preferencia.

### Detalle y Seguimiento (Muy importante para la Demo)
Al hacer clic en un lead, se abre un panel lateral:
- **Estado y Prioridad**: Puedes cambiarlos en tiempo real y se guardan automáticamente.
- **Notas de Seguimiento**: En la sección de "Próximo Seguimiento", puedes escribir qué hay que hacer, poner una fecha y un responsable. Al darle a **Guardar Cambios**, se registrará en el **Historial** de la parte inferior para que nunca se pierda lo que se habló con el cliente.
- **Documentos PDF**: Puedes subir propuestas o contratos en PDF. Una vez subidos, cualquier miembro con acceso podrá descargarlos o verlos.

---

## 📥 3. Importación Masiva (CSV)
Si tienes cientos de leads en Excel, puedes traerlos al CRM en segundos.

1.  **Descargar Plantilla**: Haz clic en el botón "Plantilla" para obtener el formato correcto.
2.  **Preparar datos**: Asegúrate de que las columnas coincidan.
3.  **Subir**: Haz clic en "Importar" y selecciona tu archivo. El sistema procesará las fechas automáticamente (soporta `/` y `-`).

---

## 📅 4. Calendario
En el menú **Calendar**, verás todas las tareas de seguimiento que programaste en el panel de Leads. Es la mejor forma de organizar el día a día.

---

## 🛠️ 5. Administración y Equipo
Solo los usuarios con rol **Super Admin** o **Company Admin** tienen acceso a estas opciones:
- **Equipo**: Ver todos los usuarios, cambiarles el rol (Admin o Agente) o eliminarlos si ya no forman parte del equipo.
- **Permisos**: Configuración granular de lo que cada rol puede hacer (Lectura, Escritura, Eliminación).

---

## ❓ Solución de Problemas Comunes

- **"Error al guardar notas"**: Si aparece un error de permisos rojo, ejecuta el script `FIX_FOLLOWUPS_MAESTRO.sql` en tu panel de Supabase tal como se indicó en la guía técnica.
- **"Los cambios no se ven"**: Refresca el navegador con **Ctrl + Shift + R** para limpiar el caché, especialmente después de actualizaciones del sistema.

---
*Este manual fue generado automáticamente para el CRM Enterprise v2.0.*
