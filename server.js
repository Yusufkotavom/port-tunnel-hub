const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');

const PORT = 7890;
const DATA_FILE = path.join(__dirname, 'tunnels.json');
const TRAEFIK_DIR = '/etc/dokploy/traefik/dynamic';
const DEFAULT_DOMAIN = 'devk.my.id';

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([
    { subdomain: '9', domain: DEFAULT_DOMAIN, port: 4321, description: 'Astro Blog Dev', createdAt: new Date().toISOString() }
  ], null, 2));
}

function getTunnels() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveTunnels(tunnels) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tunnels, null, 2));
}

function generateTraefikYaml(subdomain, domain, port) {
  const fullHost = `${subdomain}.${domain}`;
  const cleanId = subdomain.replace(/[^a-zA-Z0-9-]/g, '');
  return `http:
  routers:
    tunnel-${cleanId}-http:
      rule: Host(\`${fullHost}\`)
      service: tunnel-${cleanId}-svc
      entryPoints:
        - web
      middlewares:
        - redirect-to-https
    tunnel-${cleanId}-https:
      rule: Host(\`${fullHost}\`)
      service: tunnel-${cleanId}-svc
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
  services:
    tunnel-${cleanId}-svc:
      loadBalancer:
        servers:
          - url: http://172.17.0.1:${port}
        passHostHeader: false
`;
}

function syncTraefikFile(subdomain, domain, port) {
  const cleanId = subdomain.replace(/[^a-zA-Z0-9-]/g, '');
  const filePath = path.join(TRAEFIK_DIR, `tunnel-${cleanId}.yml`);
  fs.writeFileSync(filePath, generateTraefikYaml(subdomain, domain, port), 'utf8');
}

function removeTraefikFile(subdomain) {
  const cleanId = subdomain.replace(/[^a-zA-Z0-9-]/g, '');
  const filePath = path.join(TRAEFIK_DIR, `tunnel-${cleanId}.yml`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Initial sync on start
const initialTunnels = getTunnels();
for (const t of initialTunnels) {
  syncTraefikFile(t.subdomain, t.domain || DEFAULT_DOMAIN, t.port);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(250);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // API: GET /api/tunnels
  if ((req.method === 'GET' || req.method === 'HEAD') && url.pathname === '/api/tunnels') {
    const tunnels = getTunnels();
    const result = [];
    for (const t of tunnels) {
      const isListening = await checkPort(t.port);
      result.push({
        ...t,
        description: t.description || '',
        fullHost: `${t.subdomain}.${t.domain || DEFAULT_DOMAIN}`,
        isListening
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result));
  }

  // API: POST /api/tunnels (Add new)
  if (req.method === 'POST' && url.pathname === '/api/tunnels') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { subdomain, port, domain, description } = JSON.parse(body);
        if (!subdomain || !port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Subdomain dan Port harus diisi' }));
        }

        const cleanSub = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
        const targetPort = parseInt(port, 10);
        const targetDomain = (domain || DEFAULT_DOMAIN).trim();
        const desc = (description || '').trim();

        const tunnels = getTunnels();
        const existingIdx = tunnels.findIndex(t => t.subdomain === cleanSub);
        const item = {
          subdomain: cleanSub,
          domain: targetDomain,
          port: targetPort,
          description: desc,
          updatedAt: new Date().toISOString()
        };

        if (existingIdx >= 0) {
          tunnels[existingIdx] = { ...tunnels[existingIdx], ...item };
        } else {
          item.createdAt = new Date().toISOString();
          tunnels.push(item);
        }

        saveTunnels(tunnels);
        syncTraefikFile(cleanSub, targetDomain, targetPort);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, item }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: PUT /api/tunnels (Edit Port & Description)
  if (req.method === 'PUT' && url.pathname === '/api/tunnels') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { subdomain, port, description } = JSON.parse(body);
        const tunnels = getTunnels();
        const t = tunnels.find(x => x.subdomain === subdomain);
        if (!t) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Tunnel tidak ditemukan' }));
        }

        if (port) t.port = parseInt(port, 10);
        if (description !== undefined) t.description = description.trim();
        t.updatedAt = new Date().toISOString();

        saveTunnels(tunnels);
        syncTraefikFile(t.subdomain, t.domain || DEFAULT_DOMAIN, t.port);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, item: t }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // API: DELETE /api/tunnels
  if (req.method === 'DELETE' && url.pathname === '/api/tunnels') {
    const subdomain = url.searchParams.get('subdomain');
    if (!subdomain) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Subdomain dibutuhkan' }));
    }

    let tunnels = getTunnels();
    tunnels = tunnels.filter(t => t.subdomain !== subdomain);
    saveTunnels(tunnels);
    removeTraefikFile(subdomain);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ success: true }));
  }

  // Serve Web UI
  if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(htmlPath));
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Port Tunnel Manager running directly on port ${PORT}`);
});
