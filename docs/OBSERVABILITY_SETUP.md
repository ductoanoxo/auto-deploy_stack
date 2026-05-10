# Docker Swarm Observability Setup Guide (LGTM Stack)

Tài liệu này ghi lại các cấu hình quan trọng và các bước xử lý sự cố để thiết lập hệ thống quan sát (Logging, Metrics, Tracing) cho cụm Docker Swarm trên AWS.

## 1. Logging (Loki)
**Thử thách:** Một số Docker Logging Drivers (như `awslogs` hoặc cấu hình mặc định trên AWS) không cho phép Alloy đọc log qua Docker API.
**Giải pháp:** Chuyển sang quét file log trực tiếp từ host.

- **Cấu hình Alloy (`config.alloy`):**
  - Sử dụng `loki.source.file` thay vì `loki.source.docker`.
  - Đường dẫn: `/var/lib/docker/containers/*/*-json.log`.
  - **Relabeling:** Ánh xạ nhãn `__meta_docker_container_label_com_docker_swarm_service_name` thành nhãn `job` để phân biệt các Service trong Swarm.

- **Docker Compose:** Phải mount volume log:
  ```yaml
  volumes:
    - /var/lib/docker/containers:/var/lib/docker/containers:ro
  ```

## 2. Tracing (Tempo)
**Thử thách:** Lệch pha giao thức giữa Backend (HTTP) và Collector (gRPC) dẫn đến mất dữ liệu Trace.
**Giải pháp:** Cấu hình Backend gửi Trace qua HTTP (cổng 4318) và định danh Service tường minh.

- **Endpoint:** `http://alloy:4318/v1/traces` (OTLP HTTP).
- **Backend (Python):** 
  - Sử dụng `OTLPSpanExporter` từ thư viện `opentelemetry-exporter-otlp-proto-http`.
  - **Quan trọng:** Phải khai báo `Resource` với `SERVICE_NAME` tường minh trong code để tránh nhãn `unknown_service`.

## 3. Metrics (Prometheus/Mimir)
**Thử thách:** Khó phân biệt dữ liệu giữa máy Jenkins, máy Manager và máy Worker.
**Giải pháp:** Gắn nhãn `nodename` toàn cục (External Labels).

- **Cấu hình Alloy:**
  ```alloy
  prometheus.remote_write "grafanacloud" {
    external_labels = {
      nodename = sys.env("NODE_NAME"),
    }
  }
  ```
- **Query Dashboard:** Sử dụng `avg by (nodename)` để biểu đồ hiển thị theo tên máy thay vì IP.

## 4. Grafana Dashboard Tips

### Dịch vụ & Bản sao (Services & Replicas)
- **Desired:** Số lượng bản sao bạn muốn chạy (cấu hình).
- **Running:** Số lượng bản sao thực tế đang sống.
- **Mẹo:** Sử dụng Transformation `Organize fields` để ẩn các cột rác và đổi tên `Value #A`, `Value #B` thành `Running` và `Desired`.

### Truy vết (Trace Search)
- Nếu bị lỗi "No data", hãy thử dùng query trống `{}` hoặc chuyển sang chế độ **Search** thay vì **TraceQL** để kiểm tra tính thông suốt của dữ liệu.

---
*Tài liệu được khởi tạo ngày 10/05/2026 sau khi fix thành công toàn bộ LGTM stack.*
