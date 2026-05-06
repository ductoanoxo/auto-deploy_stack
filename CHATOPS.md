# DevOps ChatOps — Tính năng tra cứu trạng thái hệ thống

## Mục tiêu

Cho phép người dùng nhập lệnh `/status` qua giao diện web để tra cứu **trạng thái server EC2** và **danh sách Docker container** đang chạy — thay vì phải SSH vào server.

## User Story (Câu chuyện người dùng)

**Là một** (As a) kỹ sư DevOps / Quản trị viên hệ thống,
**Tôi muốn** (I want) có thể kiểm tra nhanh tình trạng tài nguyên của server (CPU, RAM, Disk) và trạng thái các Docker container trực tiếp từ giao diện chat,
**Để** (So that) tôi có thể giám sát hệ thống theo thời gian thực mà không cần tốn thời gian SSH vào server hay mở công cụ quản lý phức tạp.

### Tiêu chí nghiệm thu (Acceptance Criteria)
1. **Giao diện nhận diện lệnh:** Khi người dùng nhập `/status` vào ô chat, hệ thống không coi đó là một tin nhắn thông thường mà xử lý như một câu lệnh hệ thống.
2. **Hiển thị tài nguyên Server:** Hệ thống trả về % CPU, % RAM (có số MB cụ thể), % Disk (có số GB cụ thể) theo thời gian thực. Các chỉ số này có progress bar đổi màu (Xanh/Vàng/Đỏ) tùy theo mức độ sử dụng.
3. **Hiển thị trạng thái Docker:** Liệt kê đầy đủ các container đang chạy trên server với các thông tin: Tên container, Image đang dùng, Trạng thái (Running/Exited).
4. **Bảo mật & Fallback:** Nếu backend không có quyền truy cập Docker socket, hệ thống không bị crash mà phải hiển thị thông báo lỗi thân thiện ("Không thể kết nối Docker daemon").
5. **Đảm bảo CI/CD:** Trong Jenkins pipeline, phải có bước tự động kiểm tra (Health check) xem tính năng này có hoạt động bình thường sau mỗi lần deploy hay không.

## Kiến trúc

```
┌──────────────┐     /status      ┌──────────────────────────┐      Docker Socket
│   Frontend   │ ──────────────►  │   Backend (FastAPI)      │ ──────────────────►  Docker Daemon
│   (React)    │ ◄──────────────  │                          │
│              │   JSON response  │  ┌─ psutil (CPU/RAM)     │      /var/run/docker.sock
└──────────────┘                  │  └─ docker-py (Container)│
                                  └──────────────────────────┘
```

## API Endpoints

### `GET /api/status`
Trả về trạng thái hệ thống và danh sách Docker container.

**Response:**
```json
{
  "server_status": "running",
  "cpu_percent": 15.2,
  "ram_percent": 42.5,
  "ram_used_mb": 425.3,
  "ram_total_mb": 1000.0,
  "disk_percent": 35.0,
  "disk_used_gb": 5.6,
  "disk_total_gb": 16.0,
  "containers": [
    {
      "name": "backend",
      "status": "running",
      "image": "ductoanoxo/backend:latest"
    },
    {
      "name": "frontend",
      "status": "running",
      "image": "ductoanoxo/frontend:latest"
    }
  ],
  "docker_status": "connected",
  "timestamp": "2026-05-05T12:00:00Z"
}
```

### `GET /api/health`
Health check đơn giản cho pipeline verification.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-05T12:00:00Z"
}
```

## Cách sử dụng

### Trên giao diện web
1. Mở trình duyệt → `http://<EC2_IP>:3000`
2. Nhập `/status` vào ô chat → nhấn Enter
3. Hệ thống hiển thị:
   - **Server status**: CPU %, RAM %, Disk % (với thanh progress bar)
   - **Docker containers**: Danh sách container đang chạy (tên, image, status)

### Trên terminal (API trực tiếp)
```bash
# Health check
curl http://localhost:8000/api/health

# Xem trạng thái hệ thống
curl http://localhost:8000/api/status | python3 -m json.tool

# Greeting (tính năng cũ vẫn hoạt động)
curl -X POST http://localhost:8000/api/hello \
  -H "Content-Type: application/json" \
  -d '{"name": "Toan"}'
```

## Docker Socket Mount

Backend container cần quyền đọc Docker socket để lấy thông tin container:

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"  # Read-only
    group_add:
      - "999"  # Docker group GID trên host
```

> **⚠️ Lưu ý bảo mật:** Mount Docker socket cho container tiềm ẩn rủi ro privilege escalation. Trong production, nên dùng:
> - Socket read-only (`:ro`) — đã áp dụng
> - Docker socket proxy (ví dụ: [Tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy))
> - Hoặc query metrics từ Prometheus/cAdvisor thay vì trực tiếp Docker API

## Jenkins Pipeline — Health Check Stage

Sau khi deploy, pipeline tự động verify:

```groovy
stage('Health Check') {
    steps {
        script {
            sh 'sleep 10'
            sh 'curl -f http://localhost:8000/api/health'   // Backend sống?
            sh 'curl -f http://localhost:8000/api/status'    // Docker socket OK?
        }
    }
}
```

**Pipeline flow:**
```
Checkout → Test → Build → Push Hub → Deploy → Health Check ✨
```

## Thư viện sử dụng

| Thư viện | Phiên bản | Mục đích |
|----------|-----------|----------|
| `psutil` | 5.9.8 | Lấy metrics CPU, RAM, Disk của server |
| `docker` | 7.0.0 | Kết nối Docker daemon qua socket, liệt kê container |

## Kiểm tra GID Docker trên EC2

Nếu Health Check pipeline fail với lỗi "Permission denied" khi gọi `/api/status`:

```bash
# SSH vào EC2, kiểm tra Docker group GID
getent group docker
# Output: docker:x:999:ubuntu
#                    ^^^
# Nếu GID khác 999, sửa lại trong docker-compose.yml → group_add
```

## Hướng phát triển (Giai đoạn 2)

- **Prometheus + Grafana**: Giám sát tần suất gọi `/status`, CPU/RAM theo thời gian
- **Loki + Promtail**: Log tập trung các lệnh người dùng nhập
- **Thêm lệnh ChatOps**: `/logs`, `/restart <container>`, `/deploy`
- **Kubernetes**: Khi hệ thống mở rộng ra nhiều microservice và multi-node
