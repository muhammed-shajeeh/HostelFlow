# Cloud Deployment Architecture ☁️

HostelFlow is architected to run on high-performance cloud networks, decoupling the backend, frontend PWA, and server databases.

---

## 🗺️ SaaS Deployment Blueprint

```
+------------------+         +------------------+         +------------------+
| Vercel Cloud CD  |         | Render Cloud PAAS|         | MongoDB Atlas DB |
|  React PWA App   | <=====> |   Node Backend   | <=====> |  Cluster Shards  |
+------------------+         +------------------+         +------------------+
                                      |
                                      v
                             +------------------+
                             | Brevo SMTP Email |
                             +------------------+
```

---

## ⚙️ Core Environment Configuration

The following variables must be configured in production:

### 1. Render API Gateway (Backend)
- `PORT`: `5000`
- `MONGO_URI`: Connection string to MongoDB Atlas.
- `JWT_SECRET`: High-entropy key for token generation.
- `EMAIL_API_KEY`: Brevo Transactional SMTP API Key.
- `EMAIL_FROM`: Verification sender address (`verify@hostelflow.com`).

### 2. Vercel Console (Frontend PWA)
- `VITE_API_URL`: Absolute URL pointing to your Render live API endpoint.
