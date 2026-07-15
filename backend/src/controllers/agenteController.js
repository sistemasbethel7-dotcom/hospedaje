import { obtenerConfig, actualizarConfig, VOCES_VALIDAS } from "../services/agenteConfigService.js";

const REALTIME_MODEL = "gpt-realtime-mini";

const INSTRUCCIONES = `Eres el asistente de voz del panel de administración del sistema Hospedaje,
usado por el equipo que organiza el alojamiento de un evento masivo de la iglesia La luz del mundo.
Responde siempre en español de México, de forma breve, clara y respetuosa.

La forma en qué debes iniciar un saludo siempre es: La paz del Señor es el equivalente a Hola. Cuando alguien inicia el saludo con La paz del Señor, responde: Amén

Si alguien te dice Dios te pague, Dios te bendiga, o algo similar debes responder Amén.

Qué es este sistema: Hospedaje es la plataforma que usa el equipo de este evento para distribuir a
las personas que llegan entre las casas de anfitriones voluntarios. Cada "hogar" es una casa
registrada con su capacidad y ocupación actual (cuántas personas tiene alojadas ahora mismo).

Páginas del panel de administración (donde tú vives) y para qué sirve cada una:
- Dashboard (dashboard.html): KPIs y gráficas del evento activo.
- Hogares (hogares.html): listado completo de hogares, con búsqueda y edición/eliminación de casas.
- Mapa (mapa.html): ubicación de cada hogar en un mapa, coloreado por disponibilidad.
- Eventos (eventos.html): lista de eventos, crearlos, finalizarlos o reabrirlos.
- Crear evento (evento-nuevo.html): formulario para dar de alta un evento nuevo.
- Catálogos (catalogos.html): listas configurables de servicios, vulnerabilidades y perfil recomendado.
- Usuarios (usuarios.html): gestión de cuentas del equipo (crear, cambiar rol, activar/desactivar).
- Agente (agente.html): configuración de este mismo agente de voz (encenderlo/apagarlo, voz, acento).

Roles: admin tiene acceso a las 8 páginas. supervisor solo puede entrar a Dashboard, Hogares, Mapa
y Eventos (sin crear eventos), y no ve Catálogos, Usuarios ni Agente. La edición y eliminación de
hogares, aunque se vea en la sección Hogares, también es solo para admin.

Reglas de uso de herramientas:
- Si el usuario pide ir a una sección o navegar ("llévame a usuarios", "ábreme el mapa"), usa
  "navegar_a_pagina" directamente, sin preguntar antes.
- Si el usuario pregunta en qué parte del sistema puede hacer algo ("¿dónde edito una casa?"),
  respóndele con la guía de páginas de arriba y ofrécele llevarlo ahí con "navegar_a_pagina" si
  quiere.
- Si el usuario pide ver o que le muestres información de un hogar específico ("muéstrame la casa
  con mayor capacidad"), usa "abrir_hogar" — esto lo muestra en tu propio panel flotante, SIN
  cambiar de página. Nunca navegues a otra página solo para mostrar un hogar, a menos que el
  usuario lo pida explícitamente.
- En "buscar_hogares", el conteo real de resultados es "total_encontrados"; el arreglo "hogares"
  solo trae hasta 8 como muestra. Si preguntan cuántas casas hay (en total o en una calle/colonia),
  contesta con "total_encontrados", nunca cuentes el arreglo de muestra.
- "disponibilidad_por_calle" agrupa por el nombre de calle detectado de forma aproximada (a partir
  del campo de dirección, que junta calle y número en un solo texto) — preséntalo como una
  aproximación, no como un dato exacto.

Solo puedes CONSULTAR información y navegar por el sistema. Nunca puedes crear, editar ni eliminar
nada, y nunca debes inventar datos: si una herramienta no encuentra información, dilo con
naturalidad en vez de suponer.`;

const PAGINAS_ADMIN = ['dashboard', 'hogares', 'mapa', 'eventos', 'evento_nuevo', 'catalogos', 'usuarios', 'agente'];
const PAGINAS_SUPERVISOR = ['dashboard', 'hogares', 'mapa', 'eventos'];

function buildTools(role) {
    const paginas = role === 'admin' ? PAGINAS_ADMIN : PAGINAS_SUPERVISOR;

    return [
        {
            type: "function",
            name: "buscar_hogares",
            description: "Busca hogares registrados en el evento activo, filtrando por dueño, calle, colonia o disponibilidad.",
            parameters: {
                type: "object",
                properties: {
                    dueno: { type: "string", description: "Nombre completo o parcial del dueño de la casa" },
                    calle: { type: "string", description: "Calle o parte de la dirección" },
                    colonia: { type: "string", description: "Colonia o parte de ella" },
                    solo_disponibles: { type: "boolean", description: "true para mostrar solo hogares con lugares disponibles" },
                },
            },
        },
        {
            type: "function",
            name: "metricas_evento",
            description:
                "Obtiene los totales del evento activo: hogares registrados, capacidad total, ocupación actual y lugares disponibles.",
            parameters: { type: "object", properties: {} },
        },
        {
            type: "function",
            name: "disponibilidad_por_calle",
            description:
                "Agrupa los hogares del evento activo por nombre de calle (de forma aproximada) y regresa las calles con más lugares disponibles, ordenadas de mayor a menor.",
            parameters: { type: "object", properties: {} },
        },
        {
            type: "function",
            name: "abrir_hogar",
            description: "Muestra el detalle de un hogar en el panel flotante del propio agente, sin cambiar de página.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "integer", description: "ID numérico del hogar a mostrar" },
                },
                required: ["id"],
            },
        },
        {
            type: "function",
            name: "navegar_a_pagina",
            description: "Navega a una sección del panel de administración.",
            parameters: {
                type: "object",
                properties: {
                    pagina: { type: "string", enum: paginas, description: "Clave de la página destino" },
                },
                required: ["pagina"],
            },
        },
    ];
}

export async function obtenerToken(req, res) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ message: "El agente de voz no está configurado en el servidor." });
    }

    const config = await obtenerConfig();
    if (!config.habilitado) {
        return res.status(403).json({ message: "El agente de voz está deshabilitado." });
    }

    const instrucciones = config.acento_estilo
        ? `${INSTRUCCIONES}\n\n${config.acento_estilo}`
        : INSTRUCCIONES;

    const respuesta = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            session: {
                type: "realtime",
                model: REALTIME_MODEL,
                instructions: instrucciones,
                audio: {
                    output: { voice: config.voz },
                    input: {
                        turn_detection: {
                            type: "semantic_vad",
                            eagerness: "low",
                            interrupt_response: true,
                        },
                    },
                },
                tools: buildTools(req.user.role),
                tool_choice: "auto",
            },
        }),
    });

    const datos = await respuesta.json();
    if (!respuesta.ok) {
        console.error("Error creando client_secret de OpenAI:", datos);
        return res.status(502).json({ message: "No se pudo iniciar la sesión del agente." });
    }

    res.json({ value: datos.value, expires_at: datos.expires_at });
}

export async function obtenerConfigController(req, res) {
    const config = await obtenerConfig();
    res.json({ config });
}

export async function actualizarConfigController(req, res) {
    const { habilitado, voz, acento_estilo } = req.body;

    if (typeof habilitado !== "boolean") {
        return res.status(400).json({ message: "El campo habilitado debe ser verdadero o falso." });
    }
    if (!VOCES_VALIDAS.includes(voz)) {
        return res.status(400).json({ message: "La voz seleccionada no es válida." });
    }
    if (typeof acento_estilo !== "string") {
        return res.status(400).json({ message: "El acento o estilo debe ser texto." });
    }

    const config = await actualizarConfig({ habilitado, voz, acento_estilo: acento_estilo.trim() });
    res.json({ config });
}
