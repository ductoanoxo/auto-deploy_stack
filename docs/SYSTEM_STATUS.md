# System Status - Thực Tế Chạy Trong Cụm

Theo như thiết lập hiện tại (tính tới ngày kiểm tra gần nhất), hệ thống đang chạy trong môi trường Docker Swarm với hai loại node:

## 1. Môi trường Manager Node (`ip-172-31-2-142`)

- **Loại Instance (AWS EC2):** `c7i.large flex`
- **Vai trò:** Đây là nơi nhận mọi luồng điều phối của Swarm và quản lý các services.
Lệnh `docker service ls` cho thấy hạ tầng đang hoạt động ổn định:

| ID           | Tên Service (NAME) | Mode | Replicas | Image | Cổng (PORTS) |
|--------------|-------------------|--------|----------|-------|-------------|
| v76h8wj9mdov | `auto-deploy_stack_alloy` | global | 2/2 | grafana/alloy:latest | *:4317-4318->4317-4318/tcp |
| lsfoms2b23xi | `auto-deploy_stack_backend` | replicated | 2/2 | toantra349/backend:66 | *:8000->8000/tcp |
| lrbi5scuk3ah | `auto-deploy_stack_cadvisor` | global | 2/2 | gcr.io/cadvisor/cadvisor:v0.49.1 | |
| sqto8lb2vzcs | `auto-deploy_stack_frontend` | replicated | 2/2 | toantra349/frontend:66 | *:80->80/tcp |
| eitj3v37870r | `auto-deploy_stack_swarm-exporter` | replicated | 1/1 | toantra349/swarm-exporter:66 | |
| azg3xjyscf7q | `portainer_agent` | global | 2/2 | portainer/agent:2.21.5 | |
| r5ooxzqu4k2p | `portainer_portainer` | replicated | 1/1 | portainer/portainer-ce:2.21.5 | *:8001->8000/tcp, *:9000->9000/tcp, *:9443->9443/tcp |

**Nhận xét:**
- Các ứng dụng chính (`backend`, `frontend`) được chạy dạng `replicated` với 2 bản sao (replicas).
- `alloy`, `cadvisor` và `portainer-agent` được chạy ở dạng `global` để đảm bảo có mặt trên tât cả các nodes.
- Quản trị giao diện tổng thì thông qua `portainer` (replicated 1).

## 2. Môi trường Worker Node / Project Node (`ip-172-31-95-223`)

- **Loại Instance (AWS EC2):** `t3.small`
- **Vai trò:** Môi trường này là nơi các container tải nặng thực sự được thực thi.
Lệnh `docker ps` cho thấy các dịch vụ đã được triển khai xong:

| ID | Image | Trạng thái (STATUS) | Tên Container (NAMES) |
|----|-------|--------------------|----------------------|
| becd37828ed8 | grafana/alloy:latest | Up 3 minutes | `auto-deploy_stack_alloy...` |
| 65849c3dae5b | toantra349/frontend:66 | Up 3 minutes (healthy) | `auto-deploy_stack_frontend...` |
| 7bcb216d0a2b | toantra349/backend:66 | Up 3 minutes (healthy) | `auto-deploy_stack_backend...` |
| 02fc19154429 | portainer/agent:2.21.5 | Up 2 hours | `portainer_agent...` |
| 0c9a6df2c9a0 | gcr.io/cadvisor/cadvisor:v0.49.1 | Up 2 hours (healthy)| `auto-deploy_stack_cadvisor...` |

**Nhận xét:**
- Swarm đã gán phiên bản `1` của ứng dụng Front/Back end lên worker này (`auto-deploy_stack_frontend.1...`).
- Các tiến trình thu thập số liệu (alloy, cadvisor) chạy đúng dạng global mount vào môi trường con này.
- Health check đang hoạt động (đều có mác `healthy`).
