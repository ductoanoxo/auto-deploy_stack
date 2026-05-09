# 📊 Observability Stack Setup Guide (LGTM + Grafana Alloy)

Tài liệu này hướng dẫn chi tiết cách thiết lập hệ thống giám sát toàn diện cho dự án bằng bộ tứ **LGTM** (Loki, Grafana, Tempo, Mimir/Prometheus) thông qua **Grafana Alloy**.

---

## 🏗️ Kiến trúc tổng quan

- **Grafana Cloud:** Nơi lưu trữ và hiển thị dữ liệu (SaaS).
- **Grafana Alloy:** Collector chạy trên EC2 (Docker Swarm) để thu gom dữ liệu.
- **Dữ liệu thu thập:**
  - **Metrics:** Thông số hệ thống EC2 và `/metrics` từ FastAPI.
  - **Logs:** Toàn bộ log từ các Docker container.
  - **Traces:** Dấu vết các request xử lý trong ứng dụng (distributed tracing).

---

## 🛠️ Bước 1: Chuẩn bị trên Grafana Cloud

1. Đăng nhập vào [Grafana Cloud](https://grafana.com/products/cloud/).
2. Truy cập vào trang **Security -> Access Policies** để tạo một Token (API Key) có quyền:
   - `metrics:write`
   - `logs:write`
   - `traces:write`
3. Lưu lại các thông số sau từ Dashboard của bạn:
   - **Prometheus:** Remote Write Endpoint, Username (User ID).
   - **Loki:** URL, Username.
   - **Tempo:** URL (OTLP Endpoint), Username.

---

## 🛠️ Bước 2: Cấu hình Grafana Alloy (`config.alloy`)

Tạo file `config.alloy` tại thư mục gốc của project:

```hcl
// ==========================================
// 1. METRICS (PROMETHEUS)
// ==========================================
prometheus.exporter.unix "node" { }

prometheus.scrape "system" {
  targets    = prometheus.exporter.unix.node.targets
  forward_to = [prometheus.remote_write.grafana_cloud.receiver]
}

prometheus.remote_write "grafana_cloud" {
  endpoint {
    url = "https://<PROMETHEUS_URL>/api/prom/push"
    basic_auth {
      username = "<PROMETHEUS_USER_ID>"
      password = "<GRAFANA_CLOUD_TOKEN>"
    }
  }
}

// ==========================================
// 2. LOGS (LOKI)
// ==========================================
loki.relabel "docker" {
  forward_to = [loki.write.grafana_cloud.receiver]
  rule {
    target_label = "job"
    replacement  = "docker_logs"
  }
}

loki.source.docker "all_containers" {
  host       = "unix:///var/run/docker.sock"
  forward_to = [loki.relabel.docker.receiver]
}

loki.write "grafana_cloud" {
  endpoint {
    url = "https://<LOKI_URL>/loki/api/v1/push"
    basic_auth {
      username = "<LOKI_USER_ID>"
      password = "<GRAFANA_CLOUD_TOKEN>"
    }
  }
}

// ==========================================
// 3. TRACES (TEMPO)
// ==========================================
otelcol.receiver.otlp "default" {
  grpc { endpoint = "0.0.0.0:4317" }
  http { endpoint = "0.0.0.0:4318" }

  output {
    traces = [otelcol.exporter.otlp.tempo.input]
  }
}

otelcol.auth.basic "tempo" {
  username = "<TEMPO_USER_ID>"
  password = "<GRAFANA_CLOUD_TOKEN>"
}

otelcol.exporter.otlp "tempo" {
  client {
    endpoint = "<TEMPO_URL>:443"
    auth     = otelcol.auth.basic.tempo.handler
  }
}
```

---

## 🛠️ Bước 3: Triển khai trên Docker Swarm

Cập nhật `docker-compose.yml` để thêm service Alloy chạy ở chế độ **Global**:

```yaml
  alloy:
    image: grafana/alloy:latest
    volumes:
      - ./config.alloy:/etc/alloy/config.alloy:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/host/root:ro,rslave
    command: [
      "run",
      "--allow-loading-from-ports",
      "/etc/alloy/config.alloy"
    ]
    ports:
      - "4317:4317" # gRPC Tracing
      - "4318:4318" # HTTP Tracing
    deploy:
      mode: global
      resources:
        limits:
          memory: 384M
```

---

## 🛠️ Bước 4: Instrument Backend (FastAPI)

Để Backend gửi được Traces và Metrics, cần thực hiện:

1. **Cài đặt thư viện:**
   ```bash
   pip install opentelemetry-api opentelemetry-sdk \
               opentelemetry-instrumentation-fastapi \
               opentelemetry-exporter-otlp \
               prometheus-fastapi-instrumentator
   ```

2. **Cấu hình trong `main.py`:**
   ```python
   from prometheus_fastapi_instrumentator import Instrumentator
   from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

   # ... khởi tạo app ...

   # Metrics
   Instrumentator().instrument(app).expose(app)

   # Tracing (Gửi tới Alloy)
   FastAPIInstrumentor.instrument_app(app)
   ```

3. **Biến môi trường cho Backend:**
   ```env
   OTEL_EXPORTER_OTLP_ENDPOINT=http://alloy:4317
   OTEL_SERVICE_NAME=backend-service
   ```

---

## 🛠️ Bước 5: Kiểm tra & Thành quả

1. **Check Alloy Logs:** `docker service logs -f devops_stack_alloy` để đảm bảo không có lỗi kết nối tới Grafana Cloud.
2. **Grafana Cloud Dashboards:**
   - Sử dụng **"Explore"** để truy vấn Metrics (Prometheus).
   - Truy cập **Loki** để xem log từ các container.
   - Truy cập **Tempo** để xem biểu đồ Traces.
3. **Xác nhận liên kết:** Khi xem một log lỗi, bạn sẽ thấy link **Trace ID** để nhảy thẳng sang Tempo xem vết của request đó.

---
> **Tip:** Luôn bảo mật file `config.alloy` hoặc sử dụng biến môi trường cho các Token nhạy cảm.
