# HostelFlow Documentation Portal 📚

Welcome to the official, institutional-grade documentation portal for **HostelFlow**—a state-of-the-art, real-time smart Hostel Management & Operational ERP ecosystem.

This portal serves as a comprehensive resource for university administrators, system architects, native app builders, and QA testers.

---

## 🗺️ Documentation Map

### 📘 Core Project Reports
* **[HostelFlow_Final_Report.md](HostelFlow_Final_Report.md)**: Symmetrical 30-section official project report, thesis-ready, including cover page, abstract, technology analysis, and system evaluation.

### 📐 System Architecture
* **[architecture/system_architecture.md](architecture/system_architecture.md)**: Visualizing multi-tier Node/Express ➡️ Socket.IO ➡️ React structure.
* **[architecture/realtime_architecture.md](architecture/realtime_architecture.md)**: Under-the-hood of Decoupled CustomEvent Architecture.
* **[architecture/database_architecture.md](architecture/database_architecture.md)**: Deep dive into MongoDB Collections schemas.
* **[architecture/deployment_architecture.md](architecture/deployment_architecture.md)**: SaaS infrastructure blueprint (Vercel, Render, Atlas).
* **[architecture/android_architecture.md](architecture/android_architecture.md)**: Native Capacitor shell and Java 21 compilation.

### 🔄 Operational Workflows
* **[workflows/authentication_workflow.md](workflows/authentication_workflow.md)**: Strict JWT tokens and verification gates.
* **[workflows/student_registration_workflow.md](workflows/student_registration_workflow.md)**: Unverified ➡️ Verified ➡️ Allocation states.
* **[workflows/complaint_workflow.md](workflows/complaint_workflow.md)**: Lodged ➡️ Assigned ➡️ Resolved lifecycle.
* **[workflows/leave_workflow.md](workflows/leave_workflow.md)**: Outpass QR generation ➡️ Gate scanner validation.
* **[workflows/room_transfer_workflow.md](workflows/room_transfer_workflow.md)**: Dynamic bed balancing.
* **[workflows/notification_workflow.md](workflows/notification_workflow.md)**: Email transactional routing.

### ⚙️ Module Manuals
* **[modules/admin_module.md](modules/admin_module.md)**: Wardens setup and audit logs.
* **[modules/warden_module.md](modules/warden_module.md)**: Room management, leaves approval, notices.
* **[modules/student_module.md](modules/student_module.md)**: PWA student portal, payments, outpass codes.
* **[modules/parent_module.md](modules/parent_module.md)**: Student live tracking, daily meals logs.
* **[modules/security_gate_module.md](modules/security_gate_module.md)**: PIN-authenticated barcode/QR Scanner console.
* **[modules/realtime_system.md](modules/realtime_system.md)**: Room-based websocket isolation manual.

### 🚀 Production Deployment
* **[deployment/render_backend_setup.md](deployment/render_backend_setup.md)**: Deployment steps on Render.
* **[deployment/vercel_frontend_setup.md](deployment/vercel_frontend_setup.md)**: Frontend hosting on Vercel.
* **[deployment/mongodb_setup.md](deployment/mongodb_setup.md)**: MongoDB Atlas cluster configuration.
* **[deployment/brevo_email_setup.md](deployment/brevo_email_setup.md)**: Brevo SMTP credentials and API keys.
* **[deployment/android_build_guide.md](deployment/android_build_guide.md)**: Gradle build system and signed release APK setup.

### 🔌 REST API Reference
* **[api/authentication_api.md](api/authentication_api.md)** | **[api/student_api.md](api/student_api.md)** | **[api/complaint_api.md](api/complaint_api.md)** | **[api/leave_api.md](api/leave_api.md)** | **[api/notice_api.md](api/notice_api.md)** | **[api/room_api.md](api/room_api.md)**

### 🔌 UML Diagram Sources (Mermaid)
* **[diagrams/system_architecture.mmd](diagrams/system_architecture.mmd)** | **[diagrams/realtime_flow.mmd](diagrams/realtime_flow.mmd)** | **[diagrams/database_schema.mmd](diagrams/database_schema.mmd)** | **[diagrams/deployment_flow.mmd](diagrams/deployment_flow.mmd)** | **[diagrams/room_transfer_flow.mmd](diagrams/room_transfer_flow.mmd)**

### 🧪 Quality Assurance & Appendix
* **[testing/realtime_testing.md](testing/realtime_testing.md)** | **[testing/android_testing.md](testing/android_testing.md)** | **[testing/authentication_testing.md](testing/authentication_testing.md)** | **[testing/operational_testing.md](testing/operational_testing.md)**
* **[appendix/glossary.md](appendix/glossary.md)** | **[appendix/future_enhancements.md](appendix/future_enhancements.md)** | **[appendix/known_limitations.md](appendix/known_limitations.md)**
