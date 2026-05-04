const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extraerNoticias(html) {
  const noticias = [];
  const vistos = new Set();

  const intentar = (regex) => {
    let match;
    while ((match = regex.exec(html)) !== null && noticias.length < 9) {
      const url = match[1];
      const titulo = match[2].trim()
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, '')
        .replace(/<[^>]+>/g, '');
      const urlFull = url.startsWith('http') ? url : 'https://www.guineaecuatorialpress.com' + url;
      if (!vistos.has(titulo) && titulo.length > 15 && titulo.length < 200) {
        vistos.add(titulo);
        noticias.push({ titulo, url: urlFull });
      }
    }
  };

  intentar(/<h[23][^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]{20,})<\/a>/gi);
  intentar(/<a[^>]+href="(\/[^"?#]+)"[^>]*>([^<]{25,150})<\/a>/gi);

  return noticias;
}

function detectarCategoria(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes('petróleo') || t.includes('gas') || t.includes('energía') || t.includes('sonagas')) return 'Energía';
  if (t.includes('econom') || t.includes('inversión') || t.includes('empresa') || t.includes('banco')) return 'Economía';
  if (t.includes('educac') || t.includes('escuel') || t.includes('univers') || t.includes('beca')) return 'Educación';
  if (t.includes('salud') || t.includes('hospital') || t.includes('médic') || t.includes('vacuna')) return 'Salud';
  if (t.includes('cultura') || t.includes('arte') || t.includes('music') || t.includes('festival')) return 'Cultura';
  if (t.includes('infraestructura') || t.includes('carretera') || t.includes('obra') || t.includes('construcción')) return 'Infraestructura';
  if (t.includes('diplomat') || t.includes('presidente') || t.includes('gobierno') || t.includes('ministro')) return 'Diplomacia';
  if (t.includes('fútbol') || t.includes('deporte') || t.includes('atleta') || t.includes('campeon')) return 'Deporte';
  return 'Nacional';
}

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const html = await fetchUrl('https://www.guineaecuatorialpress.com/ultimas_noticias');
    const noticias = extraerNoticias(html);

    const resultado = noticias.map(n => ({
      titulo: n.titulo,
      resumen: 'Noticia de última hora de Guinea Ecuatorial Press. Pulsa "Leer más" para ver el artículo completo.',
      categoria: detectarCategoria(n.titulo),
      fuente: 'Guinea Ecuatorial Press',
      fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      url: n.url
    }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ noticias: resultado })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
