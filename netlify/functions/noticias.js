const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9'
      }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function extraerNoticias(html) {
  const noticias = [];
  const vistos = new Set();

  // Pattern: <h3><a href="/noticias/...">Título</a></h3> followed by date and summary
  const regexBloque = /<h3[^>]*>\s*<a[^>]+href="(\/noticias\/[^"]+)"[^>]*>([^<]+)<\/a>\s*<\/h3>\s*(?:<[^>]+>\s*)*([^<]{0,300})/gi;

  let match;
  while ((match = regexBloque.exec(html)) !== null && noticias.length < 10) {
    const url = 'https://www.guineaecuatorialpress.com' + match[1];
    const titulo = match[2].trim().replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '');
    const resumenRaw = match[3] ? match[3].trim().replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ') : '';
    const resumen = resumenRaw.length > 20 ? resumenRaw.substring(0, 250) : '';

    if (!vistos.has(titulo) && titulo.length > 10) {
      vistos.add(titulo);
      noticias.push({ titulo, url, resumen });
    }
  }

  // Fallback: simpler pattern
  if (noticias.length < 3) {
    const regexSimple = /<a[^>]+href="(\/noticias\/[^"]+)"[^>]*>([^<]{20,200})<\/a>/gi;
    while ((match = regexSimple.exec(html)) !== null && noticias.length < 10) {
      const url = 'https://www.guineaecuatorialpress.com' + match[1];
      const titulo = match[2].trim().replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
      if (!vistos.has(titulo) && titulo.length > 15) {
        vistos.add(titulo);
        noticias.push({ titulo, url, resumen: '' });
      }
    }
  }

  return noticias;
}

function detectarCategoria(titulo) {
  const t = titulo.toLowerCase();
  if (t.includes('petróleo') || t.includes('gas') || t.includes('energía') || t.includes('sonagas') || t.includes('gnpc')) return 'Energía';
  if (t.includes('econom') || t.includes('inversión') || t.includes('empresa') || t.includes('banco') || t.includes('trabajo') || t.includes('empleo')) return 'Economía';
  if (t.includes('educac') || t.includes('escuel') || t.includes('univers') || t.includes('beca') || t.includes('docente')) return 'Educación';
  if (t.includes('salud') || t.includes('hospital') || t.includes('médic') || t.includes('vacuna') || t.includes('seguro médico')) return 'Salud';
  if (t.includes('cultura') || t.includes('arte') || t.includes('music') || t.includes('festival') || t.includes('prensa') || t.includes('información')) return 'Cultura';
  if (t.includes('infraestructura') || t.includes('carretera') || t.includes('obra') || t.includes('construcción') || t.includes('aeropuerto')) return 'Infraestructura';
  if (t.includes('diplomat') || t.includes('presidente') || t.includes('jefe de estado') || t.includes('ministro') || t.includes('embajad') || t.includes('delegación') || t.includes('onu') || t.includes('gobierno')) return 'Diplomacia';
  if (t.includes('fútbol') || t.includes('deporte') || t.includes('atleta') || t.includes('campeón') || t.includes('liga') || t.includes('equipo')) return 'Deporte';
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

    if (!noticias.length) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ noticias: [], debug: 'No noticias found', htmlLen: html.length })
      };
    }

    const resultado = noticias.map(n => ({
      titulo: n.titulo,
      resumen: n.resumen || 'Pulsa "Leer más" para ver el artículo completo en Guinea Ecuatorial Press.',
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
