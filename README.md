# 🚀 Port Tunnel Hub

**Port Tunnel Hub** is an ultra-lightweight, native, direct application (zero Docker container overhead) with a sleek, mobile-friendly Web UI to route and expose arbitrary local ports to public subdomains instantly with automatic SSL certificates.

Designed specifically to sit seamlessly alongside **Dokploy** and **Traefik**, eliminating the need to manually configure Docker networks, IP addresses, or edit YAML routing files.

---

## ✨ Features

- ⚡ **Instant Port Forwarding:** Just type a Subdomain (e.g., `9`) and Port (e.g., `4321`) ➔ Done!
- 📱 **100% Mobile Friendly:** Automatically adapts to a touch-optimized card layout on mobile screens with touch-friendly controls.
- 📝 **Descriptions / Notes:** Add and edit notes for each tunnel (e.g., "Astro Blog", "FastAPI Backend", "Dokploy").
- ✏️ **Instant Port Switching:** Edit any port (e.g. change `4321` to `8900`) in 1 second without restarting services.
- 🟢 **Live Port Status:** Real-time indicator showing whether the local port is actively listening or offline.
- 🔒 **Automatic SSL:** Works directly with Traefik's Let's Encrypt resolver.
- 🪶 **Zero Dependencies:** Pure vanilla Node.js (~10 MB RAM footprint). No heavy Docker containers or complex reverse proxy stacks required.

---

## 📂 Project Structure

- `server.js` — Lightweight HTTP server & dynamic routing generator for Traefik.
- `index.html` — Responsive, dark-themed Web UI with interactive modals.
- `port-tunnel.service` — Systemd service definition for automatic background startup.
- `tunnels.json` — Local state file storing active tunnel metadata.

---

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Yusufkotavom/port-tunnel-hub.git /opt/port-tunnel
   cd /opt/port-tunnel
   ```

2. **Install as a Systemd Service:**
   ```bash
   sudo cp port-tunnel.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable port-tunnel
   sudo systemctl start port-tunnel
   ```

3. **Verify Status:**
   ```bash
   sudo systemctl status port-tunnel
   ```

4. **Access the Web UI:**
   - Directly via: `http://<SERVER_IP>:7890`
   - Or behind Traefik HTTPS at: `https://tunnel.<YOUR_DOMAIN>`

---

## 📄 License

MIT License © Yusuf Bahtiyar
