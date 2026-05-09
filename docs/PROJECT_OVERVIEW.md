# Tổng quan Kiến trúc Dự án (Project Architecture Overview)

Dự án này là một hệ thống ứng dụng Fullstack (React + FastAPI) được triển khai trên hạ tầng **Docker Swarm** với hệ thống **CI/CD tự động (Jenkins)** và ngăn xếp **Giám sát toàn diện (Observability Stack với Grafana Cloud)**.

Dưới đây là mô tả chi tiết về cấu trúc và sự phân bổ các dịch vụ trên hạ tầng AWS EC2.

---

## 1. Hạ tầng (Infrastructure)

Hệ thống sử dụng **Docker Swarm** gồm 2 node (2 máy ảo EC2):

### 🖥️ Node 1: Swarm Manager (EC2 Jenkins)
- **IP:** `172.31.2.142`
- **Vai trò chính:** Quản lý cụm Swarm, chạy CI/CD Pipeline, và lưu trữ các công cụ quản trị.
- **Các Container/Service đang chạy:**
  - `portainer/portainer-ce`: Giao diện quản lý Docker/Swarm trực quan.
  - `portainer/agent`: Agent giúp Portainer CE giao tiếp với node.
  - `grafana/alloy`: Thu thập logs và metrics của node Manager để gửi lên Grafana Cloud.
  - `gcr.io/cadvisor/cadvisor`: Thu thập các chỉ số về tài nguyên (CPU, RAM) của các container trên node.
  - *(Dự kiến)* `swarm-exporter`: Lấy thông tin về Replica (Running/Desired) của cụm Swarm.

### 🖥️ Node 2: Swarm Worker (EC2 Project)
- **IP:** `172.31.95.223`
- **Vai trò chính:** Chạy ứng dụng thực tế (Frontend, Backend) phục vụ người dùng.
- **Các Container/Service đang chạy:**
  - `toantra349/frontend`: Giao diện người dùng (React/Nginx).
  - `toantra349/backend`: API xử lý logic và kết nối Database (FastAPI/Uvicorn).
  - `portainer/agent`: Agent để Portainer Manager có thể quản lý node này.
  - `grafana/alloy`: Thu thập logs từ ứng dụng và metrics hệ thống gửi lên Grafana Cloud.
  - `gcr.io/cadvisor/cadvisor`: Giám sát tài nguyên container trên node Worker.

---

## 2. Quy trình CI/CD (Jenkins Pipeline)

Quy trình tự động hóa tích hợp và triển khai (CI/CD) được vận hành bởi **Jenkins** đặt tại Node Manager.

**Luồng hoạt động (Workflow):**
1. **Checkout:** Lấy code mới nhất từ GitHub.
2. **Test:** Chạy Unit Test cho Backend.
3. **Build:** Build các Docker image cho Frontend và Backend.
4. **Push:** Đẩy image lên Docker Hub (`toantra349/frontend` và `toantra349/backend` với tag tự động).
5. **Deploy:** Cập nhật file `.env`, tạo config mới cho Alloy, và chạy lệnh `docker stack deploy` để cập nhật ứng dụng trên cụm Docker Swarm.
6. **Health Check:** Kiểm tra tự động API endpoint (`/api/health` và `/api/status`) trên Node Worker (`172.31.95.223`) để đảm bảo dịch vụ đã lên thành công.
7. **Notify (ChatOps):** Gửi thông báo kết quả Build (Thành công/Thất bại) kèm URL qua **Telegram Bot**.

---

## 3. Hệ thống Giám sát (Observability - LGTM)

Dự án sử dụng giải pháp giám sát của **Grafana Cloud** kết hợp với **Grafana Alloy** làm bộ thu thập dữ liệu (Collector).

- **Metrics (Prometheus):** 
  - `cAdvisor`: Giám sát CPU, RAM, Restart Count của từng container.
  - `Swarm Exporter`: Giám sát trạng thái Replica (Desired vs Running) của các Service.
- **Logs (Loki):** Alloy gắn trực tiếp vào `docker.sock` để gom toàn bộ log của các container (Backend, Frontend) theo thời gian thực.
- **Traces (Tempo):** Backend (FastAPI) được tích hợp OpenTelemetry để gửi Trace dữ liệu về Alloy, giúp truy vết các request chậm hoặc lỗi.
- **Dashboard:** Một Dashboard tùy chỉnh (Docker Swarm Dashboard) được tạo trên Grafana Cloud để hiển thị trực quan toàn bộ các thông số trên.

---

## 4. Công nghệ cốt lõi (Tech Stack)

- **Frontend:** React, Tailwind CSS / Vanilla CSS.
- **Backend:** FastAPI (Python), PostgreSQL (Supabase).
- **Hạ tầng & Triển khai:** AWS EC2, Docker Swarm, Portainer.
- **CI/CD & Tự động hóa:** Jenkins, Bash Script.
- **Giám sát (Observability):** Grafana Cloud, Grafana Alloy, cAdvisor, Loki, Prometheus.
- **ChatOps:** Telegram Bot API.
