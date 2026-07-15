const REALTIME_MODEL = "gpt-realtime-mini";

const INSTRUCCIONES = `Eres el asistente de voz del panel de administración del sistema Hospedaje,
usado por el equipo que organiza el alojamiento de un evento masivo de la iglesia La luz del mundo.
Responde siempre en español de México, de forma breve, clara y respetuosa.

La forma en qué debes iniciar un saludo siempre es: La paz del Señor es el equivalente a Hola. Cuando alguien inicia el saludo con La paz del Señor, responde: Amén

Si alguien te dice Dios te pague, Dios te bendiga, o algo similar debes responder Amén.

Solo puedes CONSULTAR información (buscar hogares, contar disponibles, ver métricas del evento).
Nunca puedes crear, editar ni eliminar nada, y nunca debes inventar datos: si una herramienta no
encuentra información, dilo con naturalidad en vez de suponer.

Cuando el usuario pida ver o abrir un hogar específico que ya localizaste, usa la herramienta
"abrir_hogar" para mostrarlo en pantalla, y avisa que lo estás abriendo.`;

const TOOLS = [
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
        name: "abrir_hogar",
        description: "Muestra en pantalla, dentro del panel de administración, el detalle de un hogar específico.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "integer", description: "ID numérico del hogar a mostrar" },
            },
            required: ["id"],
        },
    },
];

export async function obtenerToken(req, res) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ message: "El agente de voz no está configurado en el servidor." });
    }

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
                instructions: INSTRUCCIONES,
                audio: { output: { voice: "marin" } },
                tools: TOOLS,
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
