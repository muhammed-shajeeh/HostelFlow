# System Architecture 📐

This document provides a highly detailed technical breakdown of the structural design of **HostelFlow**.

---

## 🏢 Multi-Tier Enterprise Topology

HostelFlow is built using an isolated multi-tier design, decoupling presentation, live real-time communication, application logic, and storage layers:

```
+--------------------------------------------------------------+
|                      1. Presentation Layer                   |
|       React PWA | Vite Bundler | Capacitor Shell (Android)  |
+--------------------------------------------------------------+
            | (HTTPS REST)                   ^ (WebSockets)
            v                                |
+--------------------------------------------------------------+
|                     2. API & Event Routing                   |
|          Express REST API Gateway | Socket.IO Server         |
+--------------------------------------------------------------+
            | (Mongoose Queries)             |
            v                                |
+--------------------------------------------------------------+
|                       3. Database Layer                      |
|                  MongoDB Atlas Cloud Cluster                 |
+--------------------------------------------------------------+
```

---

## 🛠️ Components Breakdown

### 1. Presentation Layer (Vite & React)
- **State Management**: Built on top of Context APIs (`AuthContext`, `SocketContext`, `ThemeContext`).
- **Capacitor Mobile Native**: Integrates with Android status bars and hardware back keys.

### 2. Application Server (Node.js & Express)
- **Express App**: Divided into clean controllers, routes, and middleware gates.
- **Websocket Controller**: Integrates with HTTP handshake verification to authorize active sessions.

### 3. Database Cloud (Mongoose)
- Automated transaction gates and schema checks. See **[database_architecture.md](database_architecture.md)** for schema definitions.
