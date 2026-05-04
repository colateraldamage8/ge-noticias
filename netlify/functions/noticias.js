exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const hoy = new Date().toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: `Eres un editor de noticias especializado en Guinea Ecuatorial. Busca noticias RECIENTES y POSITIVAS sobre Guinea Ecuatorial usando web search.

Selecciona SOLO noticias que:
- Sean recientes (últimos 7 días preferiblemente)
- Favorezcan la imagen del país o muestren progreso
- Cubran: economía, energía/petróleo, educación, salud, cultura, infraestructura, diplomacia, deporte

Responde ÚNICAMENTE con JSON válido sin texto adicional ni backticks. Formato exacto:
{"noticias":[{"titulo":"...","resumen":"...","categoria":"Economía","fuente":"nombre medio","fecha":"DD Mon YYYY","url":"https://... o null"}]}

Devuelve entre 6 y 9 noticias.`,
        messages: [{
          role: "user",
          content: `Hoy es ${hoy}. Busca las noticias más recientes y positivas sobre Guinea Ecuatorial.`
        }]
      })
    });

    const rawText = await response.text();
    console.log('Anthropic status:', response.status);

    if (!response.ok) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: `Anthropic API error ${response.status}`, detail: rawText })
      };
    }

    const data = JSON.parse(rawText);

    // Extraer texto de todos los bloques
    let texto = '';
    for (const bloque of data.content || []) {
      if (bloque.type === 'text') texto += bloque.text;
    }

    // Limpiar y parsear JSON
    const limpio = texto.replace(/```json|```/g, '').trim();
    const inicio = limpio.indexOf('{');
    const fin = limpio.lastIndexOf('}');
    const jsonStr = limpio.substring(inicio, fin + 1);
    const resultado = JSON.parse(jsonStr);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(resultado)
    };

  } catch (err) {
    console.error('Error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
