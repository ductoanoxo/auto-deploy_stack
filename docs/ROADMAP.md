# 🗺️ DevOps + AI ChatOps — Project Roadmap

> Stack: EC2 · Docker Swarm · Jenkins · CRUD App (React + FastAPI + PostgreSQL) · Grafana Cloud (LGTM) · Grafana Alloy · FastAPI ChatOps · LLM · Telegram

---

## Phase 1 — Infrastructure Setup (EC2 + Docker Swarm)

- [] Provision EC2 instance (`c7i-flex.large`)
  - [ ] Cấu hình Security Groups (mở port: 22, 80, 443, 8080, 3000, 9090)
  - [ ] Gắn Elastic IP để có IP tĩnh
- [ ] Cài đặt Docker + Docker Compose trên EC2
- [ ] Khởi tạo Docker Swarm
  - [ ] `docker swarm init`
  - [ ] Tạo overlay network cho các service giao tiếp với nhau
- [ ] Cấu hình Docker secrets / environment variables cho các service

---

## Phase 2 — Jenkins CI/CD

- [ ] Deploy Jenkins lên EC2 (Docker container trong Swarm)
  - [ ] Cấu hình persistent volume cho Jenkins data
  - [ ] Expose port 8080
- [ ] Cài Jenkins plugins cần thiết
  - [ ] Docker Pipeline
  - [ ] GitHub Integration
  - [ ] Telegram Notification Plugin
- [ ] Tạo Jenkins Pipeline
  - [ ] Kết nối GitHub repo (webhook trigger)
  - [ ] Build Docker image
  - [ ] Push lên Docker Hub / ECR
  - [ ] Deploy service lên Docker Swarm (`docker service update`)
- [x] Cấu hình Telegram notification từ Jenkins
  - [x] Notify khi build pass / fail / deploy thành công

---

## Phase 3 — CRUD Demo App (Target Service để Monitor)

> Đây là service "thật" được deploy qua Jenkins, monitor bởi Grafana, và là nguồn sinh lỗi để demo ChatOps.

### 3.1 — FastAPI Backend (CRUD API)
- [ ] Khởi tạo FastAPI project trong thư mục `app/backend/`
- [ ] Kết nối PostgreSQL (dùng SQLAlchemy async)
- [ ] Implement CRUD endpoints:
  - [ ] `GET    /items`       — list tất cả items
  - [ ] `POST   /items`       — tạo item mới
  - [ ] `GET    /items/{id}`  — lấy 1 item
  - [ ] `PUT    /items/{id}`  — cập nhật item
  - [ ] `DELETE /items/{id}` — xóa item
- [ ] Thêm `/health` endpoint — kiểm tra DB connection
- [ ] Thêm `/metrics` endpoint (dùng `prometheus-fastapi-instrumentator`)
- [ ] Cấu hình **structured logging** (JSON format để Alloy đọc được)

### 3.2 — React Frontend
- [ ] UI hiển thị danh sách items (list, create, delete)
- [ ] Kết nối API với FastAPI backend
- [ ] Error state UI (hiển thị khi API lỗi)

### 3.3 — Supabase (PostgreSQL)
- [ ] Khởi tạo dự án trên Supabase
- [ ] Lấy connection string (Direct connection hoặc Transaction pooler)
- [ ] Cấu hình Environment Variables trong Jenkins/Docker Swarm cho backend kết nối Supabase
- [ ] Tạo database schema / migration (có thể chạy từ CI/CD hoặc manual)

### 3.4 — Failure Scenarios để Demo
- [ ] **Wrong DB Config**: Đổi connection string sai trong Docker Swarm → API trả 500 → Loki log error → Alert trigger
- [ ] **Slow query**: Viết một API endpoint thực hiện query nặng trên Supabase → latency spike → Grafana chart
- [ ] **Bad deploy**: deploy code lỗi logic kết nối DB → Jenkins fail → Telegram notify
- [ ] **High load**: dùng k6 gửi nhiều request → CPU spike trên EC2 → Alert

---

## Phase 4 — Observability Stack (Grafana Cloud + Alloy)

- [ ] Tạo tài khoản Grafana Cloud (free tier)
  - [ ] Lấy endpoint + API key cho Prometheus remote write
  - [ ] Lấy endpoint + API key cho Loki push
  - [ ] Lấy endpoint + API key cho Tempo push
- [ ] Deploy **Grafana Alloy** trên EC2 (Docker container)
  - [ ] Config thu thập **System metrics** (CPU, RAM, Disk, Network)
  - [ ] Config thu thập **Docker / Swarm metrics**
  - [ ] Config thu thập **Jenkins metrics** (cài Jenkins Prometheus Plugin)
  - [ ] Config thu thập **CRUD App logs** từ FastAPI app (`/var/log` hoặc stdout)
  - [ ] Config thu thập **CRUD App metrics** từ `/metrics` endpoint
  - [ ] Config thu thập **ChatOps backend logs + metrics**
  - [ ] Config push tất cả lên Grafana Cloud
- [ ] Thiết lập Grafana Cloud Dashboards
  - [ ] Dashboard: System Overview (CPU, RAM, Disk)
  - [ ] Dashboard: Jenkins Pipeline (build history, duration, success rate)
  - [ ] Dashboard: CRUD App (request rate, latency, error rate, DB connection health)
- [ ] Cấu hình **Grafana Alerting**
  - [ ] Alert: CPU > 80% trong 5 phút
  - [ ] Alert: RAM > 85%
  - [ ] Alert: CRUD App error rate > 5% (5xx spike)
  - [ ] Alert: DB connection health (health check endpoint fail)
  - [ ] Alert: API latency > 2s
  - [ ] Alert: Jenkins build thất bại liên tiếp
  - [ ] Tất cả alert → webhook → ChatOps backend (để LLM phân tích)
  - [ ] Riêng "backend down" → Grafana gửi Telegram trực tiếp (bypass backend)

---

## Phase 5 — ChatOps Backend (FastAPI + LLM + Telegram)

### 4.1 — Telegram Bot Setup
- [ ] Tạo Telegram Bot qua BotFather
  - [ ] Lấy Bot Token
  - [ ] Lấy Chat ID của group/channel
- [ ] Cấu hình webhook: Telegram → FastAPI endpoint

### 4.2 — FastAPI Backend
- [ ] Khởi tạo FastAPI project
- [ ] Expose `/metrics` endpoint (dùng `prometheus-fastapi-instrumentator`)
- [ ] Cấu hình structured logging (JSON format để Alloy đọc)
- [ ] Implement các route chính:
  - [ ] `POST /webhook/telegram` — nhận lệnh từ người dùng
  - [ ] `POST /webhook/grafana` — nhận alert từ Grafana
  - [ ] `GET /health` — health check endpoint

### 4.3 — LLM Integration
- [ ] Chọn LLM provider (Gemini API free tier / OpenAI gpt-4o-mini)
  - [ ] Setup API key
  - [ ] Implement LLM client (async)
- [ ] Thiết kế prompt template cho từng loại query:
  - [ ] **Alert analysis**: "Alert X fired, context: [metrics data] → phân tích nguyên nhân + suggest action"
  - [ ] **Status query**: "Dữ liệu hiện tại: [Grafana API response] → summarize cho user"
  - [ ] **Log analysis**: "Log errors trong 1h: [Loki query result] → tìm pattern"

### 4.4 — Grafana Cloud API Integration
- [ ] Implement Grafana API client trong backend
  - [ ] Query Prometheus metrics theo range
  - [ ] Query Loki logs theo filter
- [ ] Khi nhận alert webhook → tự động query thêm context từ Grafana → gửi LLM

### 4.5 — Telegram Command Handlers
- [ ] `/status` — tổng quan hệ thống hiện tại
- [ ] `/logs [service] [duration]` — logs gần đây của service
- [ ] `/build [status]` — trạng thái Jenkins builds
- [ ] `/alert list` — danh sách alert đang active
- [ ] Free-text query — user hỏi tự do, LLM trả lời dựa trên Grafana data

---

## Phase 6 — Docker Swarm Deployment (Production)

- [ ] Viết `docker-compose.yml` / Stack file cho toàn bộ hệ thống
  - [ ] Service: `jenkins`
  - [ ] Service: `crud-backend`     ← CRUD FastAPI app
  - [ ] Service: `crud-frontend`    ← React UI
  - [ ] Service: `chatops-backend`  ← ChatOps + LLM
  - [ ] Service: `grafana-alloy`    ← Collector
- [ ] Cấu hình resource limits cho từng service (tránh OOM trên 4GB RAM)
  - [ ] Jenkins: max 1.5GB RAM
  - [ ] CRUD Backend: max 384MB RAM
  - [ ] CRUD Frontend: max 128MB RAM
  - [ ] ChatOps Backend: max 512MB RAM
  - [ ] Grafana Alloy: max 384MB RAM
- [ ] Deploy toàn bộ stack lên Swarm
  - [ ] `docker stack deploy -c docker-compose.yml devops-stack`
- [ ] Verify các service đều `Running` trong Swarm
- [ ] Test rolling update: thay đổi code → Jenkins build → Swarm update tự động

---

## Phase 7 — Testing & Validation

- [ ] Test Jenkins pipeline end-to-end (push code → build → deploy → Telegram notify)
- [ ] Test Grafana Alloy đang ship data lên Grafana Cloud (kiểm tra dashboards có data)
- [ ] **Failure scenario demos:**
  - [ ] Sai cấu hình Supabase → xem API 500 errors xuất hiện trên Grafana → Alert → ChatOps phân tích
  - [ ] Deploy code lỗi intentionally → Jenkins fail → Telegram notify
  - [ ] Dùng k6 load test CRUD API → xem CPU/latency spike trên Grafana trên EC2
- [ ] Test Grafana Alert → webhook → ChatOps backend → LLM → Telegram
- [ ] Test Telegram commands: `/status`, `/logs`, `/build`
- [ ] Test natural language query: "DB có đang ổn không?", "lỗi gần nhất là gì?"
- [ ] Test "dead man's switch": tắt ChatOps backend → Grafana gửi Telegram trực tiếp

---

## Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │         EC2 c7i-flex.large        │
                    │                                   │
                    │  ┌─────────┐  ┌────────────┐  │
                    │  │ Jenkins │  │ CRUD App   │  │
                    │  │ :8080   │  │ API + UI   │  │
                    │  └────┬────┘  └─────┬──────┘  │
                    │       │             │          │
                    │  ┌────┴─────────────┴───────┐  │
                    │  │  ChatOps Backend :8001    │  │
                    │  │  (LLM + Telegram handler) │  │
                    │  └────────────┬─────────────┘  │
                    │               │                │
                    │  ┌────────────▼─────────────┐  │
                    │  │      Grafana Alloy        │  │
                    │  │  (collect all metrics/    │  │
                    │  │   logs from all services) │  │
                    │  └────────────┬────────────────┘  │
                    └───────────────┼───────────────────┘
                                    │ push           ┌──────────┐
                                    ▼                │ Supabase │
                           ┌─────────────────┐       │ (DB)     │
                           │  Grafana Cloud  │       └────▲─────┘
                           │  Prometheus     │            │
                           │  Loki           │────────────┘
                           │  Tempo          │ (connection health)
                           │  Alerting ──────┼──→ Telegram (direct, khi backend down)
                           └────────┬────────┘
                                    │ webhook (khi alert)
                                    ▼
                           ChatOps Backend
                           + Grafana API query
                           + LLM analysis
                                    │
                                    ▼
                              Telegram Bot
```

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Cloud Provider | AWS EC2 (c7i-flex.large) |
| Container Orchestration | Docker Swarm |
| CI/CD | Jenkins |
| **Demo App Backend** | **FastAPI (CRUD API)** |
| **Demo App Frontend** | **React** |
| **Demo App Database** | **Supabase (PostgreSQL)** |
| Observability Collection | Grafana Alloy |
| Metrics Storage | Grafana Cloud (Prometheus) |
| Log Storage | Grafana Cloud (Loki) |
| Trace Storage | Grafana Cloud (Tempo) |
| Visualization & Alerting | Grafana Cloud |
| ChatOps Backend | FastAPI (Python) |
| LLM | Gemini API / OpenAI |
| Notification Channel | Telegram Bot |
