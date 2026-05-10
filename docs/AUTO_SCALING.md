# 🚀 Hướng Dẫn Setup Auto-Scaling: Grafana Alert → Jenkins → Docker Swarm

Tài liệu này hướng dẫn từng bước để triển khai hệ thống **tự động scale** Docker Swarm services dựa trên CPU metrics từ Grafana Cloud.

## Kiến Trúc Luồng Tự Động

```
k6 (300 VU stress test)
    │
    ▼ CPU container tăng >80%
cAdvisor (đang chạy global mode)
    │
    ▼ scrape mỗi 15s
Alloy → Grafana Cloud (Prometheus)
    │
    ▼ evaluate mỗi 1 phút
Grafana Alert Rule "CPU High - Scale Up"
    │
    ▼ Alert FIRING
Contact Point → Webhook → Jenkins :8080
    │
    ▼ buildWithParameters
Jenkins Job: auto-scale-job
    │
    ▼
docker service scale auto-deploy_stack_frontend=3
docker service scale auto-deploy_stack_backend=3
    │
    ▼ Swarm routing mesh chia tải sang 3 container
k6: response time giảm về mức xanh ✅

─────── Chiều ngược lại (Scale Down) ───────

Tải giảm, CPU < 30% trong 5 phút liên tục
    │
    ▼
Grafana Alert Rule "CPU Low - Scale Down"
    │
    ▼
Jenkins Job: auto-scale-job (ACTION=scale-down)
    │
    ▼
docker service scale frontend=2, backend=2
```

---

## BƯỚC 1 — Mở Security Group AWS Port 8080

Vào **AWS Console → EC2 → Security Groups → Security Group của máy Jenkins (Manager)**:

| Type | Protocol | Port | Source | Mô tả |
|------|----------|------|--------|-------|
| Custom TCP | TCP | 8080 | 0.0.0.0/0 | Jenkins - Grafana Webhook |

> ⚠️ **Lưu ý bảo mật:** Chỉ mở cho demo. Trong production nên giới hạn IP của Grafana Cloud hoặc dùng VPN/ngrok.

---

## BƯỚC 2 — Tạo Jenkins Job `auto-scale-job`

### 2.1 Tạo Job

1. Vào Jenkins Dashboard (`http://<EC2_MANAGER_IP>:8080`)
2. **New Item** → Nhập tên: `auto-scale-job` → chọn **Pipeline** → OK
3. Phần **General**:
   - ☑️ Tick **"This project is parameterized"**
   - Thêm các parameters (xem mục 2.2 bên dưới)

### 2.2 Cấu hình Parameters

Thêm 3 parameters (Click **Add Parameter** → **Choice Parameter** / **String Parameter**):

**Parameter 1:**
- Type: **Choice Parameter**
- Name: `ACTION`
- Choices (mỗi dòng 1 giá trị):
  ```
  scale-up
  scale-down
  ```
- Description: `Hành động scale`

**Parameter 2:**
- Type: **String Parameter**
- Name: `REPLICAS_UP`
- Default Value: `3`
- Description: `Số replicas khi scale-up`

**Parameter 3:**
- Type: **String Parameter**
- Name: `REPLICAS_DOWN`
- Default Value: `2`
- Description: `Số replicas khi scale-down`

### 2.3 Bật Remote Trigger

Cuộn xuống phần **Build Triggers**:
- ☑️ Tick **"Trigger builds remotely (e.g., from scripts)"**
- **Authentication Token:** `GRAFANA_SCALE_TOKEN`

> 💡 Token này sẽ dùng trong URL webhook của Grafana bên dưới.

### 2.4 Cấu hình Pipeline Script

Phần **Pipeline**:
- Definition: **Pipeline script from SCM**
- SCM: **Git**
- Repository URL: (link GitHub repo của bạn)
- Script Path: `Jenkinsfile.scale`

→ **Save**

### 2.5 Test Thủ Công

Chạy lệnh này từ terminal để test job trước khi kết nối Grafana:

```bash
# Test scale-up (thay <EC2_MANAGER_IP> bằng IP thật)
curl -X POST "http://35.172.60.19:8080/job/auto-scale-job/buildWithParameters" \
  --user "toantra349:11649c4a3af9779372a711159cbc1bd075" \
  --data "token=GRAFANA_SCALE_TOKEN" \
  --data "ACTION=scale-up" \
  --data "REPLICAS_UP=3" \
  --data "REPLICAS_DOWN=2"

# Xem kết quả
docker service ls | grep auto-deploy_stack
```

> Lấy Jenkins API Token: **User → Configure → API Token → Add new Token**

---

## BƯỚC 3 — Cấu Hình Grafana Alert Rules

Vào **Grafana Cloud** (`https://grafana.com/orgs/<your-org>`) → **Alerting → Alert rules → New alert rule**

### 3.1 Alert Scale-Up (CPU > 80%)

**A. Define query and alert condition:**

Chọn data source: **grafanacloud-<tên-stack>-prom** (Prometheus của bạn)

Query (PromQL):
```promql
avg(
  rate(
    container_cpu_usage_seconds_total{
      container_label_com_docker_swarm_service_name=~"auto-deploy_stack_backend|auto-deploy_stack_frontend",
      name!=""
    }[2m]
  )
) * 100
```

- **Reduce:** Last
- **Threshold:** IS ABOVE `80`

**B. Alert evaluation behavior:**
- Folder: Tạo folder mới tên `Auto-Scaling`
- Evaluation group: `cpu-alerts` với interval: `1m`
- **For (Pending period):** `2m`
  > Nghĩa là: chỉ fire alert khi CPU > 80% LIÊN TỤC 2 phút (tránh false positive)

**C. Configure labels and notifications:**
- Thêm label: `severity = critical`
- Thêm label: `action = scale-up`

**D. Annotations:**
- Summary: `CPU usage vượt 80% - cần scale up`
- Description: `CPU trung bình đang ở {{ $value }}% - tự động tăng replicas lên 3`

→ **Save rule**

---

### 3.2 Alert Scale-Down (CPU < 30%)

Tạo rule thứ 2, tương tự nhưng:

Query: **Cùng PromQL như trên**

- **Threshold:** IS BELOW `30`
- **For (Pending period):** `5m`
  > Chờ 5 phút ổn định, tránh scale-down vội rồi lại scale-up ngay

Labels:
- `severity = info`
- `action = scale-down`

→ **Save rule**

---

## BƯỚC 4 — Cấu Hình Contact Points (Webhook to Jenkins)

Vào **Alerting → Contact points → Add contact point**

### 4.1 Contact Point Scale-Up

- **Name:** `Jenkins Scale-Up`
- **Integration:** **Webhook**
- **URL:**
  ```
  http://<EC2_MANAGER_IP>:8080/job/auto-scale-job/buildWithParameters?token=GRAFANA_SCALE_TOKEN&ACTION=scale-up&REPLICAS_UP=3&REPLICAS_DOWN=2
  ```
- **HTTP Method:** POST
- **Basic Auth:**
  - Username: `admin`
  - Password: `<JENKINS_API_TOKEN>`

→ Click **Test** để kiểm tra kết nối → **Save**

### 4.2 Contact Point Scale-Down

- **Name:** `Jenkins Scale-Down`
- **Integration:** **Webhook**
- **URL:**
  ```
  http://<EC2_MANAGER_IP>:8080/job/auto-scale-job/buildWithParameters?token=GRAFANA_SCALE_TOKEN&ACTION=scale-down&REPLICAS_UP=3&REPLICAS_DOWN=2
  ```
- **HTTP Method:** POST
- **Basic Auth:** (tương tự)

→ **Save**

---

## BƯỚC 5 — Cấu Hình Notification Policy

Vào **Alerting → Notification policies**

Cấu hình routing dựa trên label `action`:

```
[Root policy] → Contact point mặc định: (giữ nguyên hoặc Telegram nếu có)
│
├── [Specific routing - Rule 1]
│   Matcher: action = scale-up
│   Contact point: Jenkins Scale-Up
│   Group wait: 30s
│   Group interval: 5m      ← Không gửi scale-up liên tục, tối đa mỗi 5 phút
│   Repeat interval: 10m    ← Không lặp lại trong 10 phút
│
└── [Specific routing - Rule 2]
    Matcher: action = scale-down
    Contact point: Jenkins Scale-Down
    Group wait: 30s
    Group interval: 10m
    Repeat interval: 30m    ← Scale-down ít lặp hơn
```

> ⚠️ **Quan trọng:** `Repeat interval` phải lớn hơn thời gian để Swarm hoàn tất việc scale và Grafana cập nhật metrics. Tránh Jenkins bị trigger liên tục.

---

## BƯỚC 6 — Chạy Demo End-to-End

### 6.1 Chuẩn bị 3 terminal/tab

**Terminal 1 (EC2 Manager) — Theo dõi replicas:**
```bash
watch -n 5 'docker service ls | grep auto-deploy_stack'
```

**Terminal 2 (EC2 Manager) — Theo dõi Jenkins jobs:**
```bash
# Hoặc mở Jenkins Blue Ocean UI
curl -s http://localhost:8080/job/auto-scale-job/api/json | python3 -m json.tool
```

**Terminal 3 (Local hoặc EC2) — Chạy k6 stress test:**
```bash
# Chạy với profile HIGH để trigger scale-up
docker run --rm -i --network host \
  -e PROFILE=high \
  grafana/k6 run - < load_test.js
```

### 6.2 Timeline kỳ vọng

| Thời điểm | Sự kiện |
|-----------|---------|
| T+0:00 | k6 bắt đầu, 100 VU warm-up |
| T+1:00 | k6 tăng lên 150 VU |
| T+3:00 | k6 đạt 300 VU, CPU bắt đầu tăng mạnh |
| T+5:00 | Grafana Alert "CPU > 80%" → trạng thái **Pending** |
| T+7:00 | Alert → **Firing** → Webhook gửi tới Jenkins |
| T+7:30 | Jenkins Job chạy: `docker service scale frontend=3 backend=3` |
| T+8:00 | Swarm tạo thêm container (rolling update) |
| T+10:00 | 3 replicas hoạt động, k6 response time **giảm** ✅ |
| T+14:00 | k6 giảm tải xuống 50 VU |
| T+19:00 | CPU < 30% liên tục 5 phút → Alert Scale-Down **Firing** |
| T+20:00 | Jenkins scale về 2 replicas, Telegram thông báo 📉 |

### 6.3 Đánh giá thành công

Scale-up thành công khi:
- [ ] `docker service ls` hiển thị `3/3` cho frontend và backend
- [ ] k6 output: `http_req_duration p(95)` giảm sau khi scale
- [ ] Telegram nhận tin nhắn 📈 Scale-Up

Scale-down thành công khi:
- [ ] `docker service ls` hiển thị `2/2` cho frontend và backend
- [ ] Telegram nhận tin nhắn 📉 Scale-Down

---

## Troubleshooting

### ❌ Grafana Webhook không gọi được Jenkins
- Kiểm tra Security Group: port 8080 mở cho `0.0.0.0/0`
- Test thủ công: `curl http://<EC2_IP>:8080` từ máy tính cá nhân

### ❌ Alert không fire dù CPU cao
- Kiểm tra PromQL trả về data: vào Explore → chạy query
- Kiểm tra tên label: `container_label_com_docker_swarm_service_name` có đúng không
- Kiểm tra Alert Rule đang ở trạng thái nào (Normal/Pending/Firing)

### ❌ Jenkins job fail: "permission denied docker"
- Jenkins user cần thuộc group docker:
  ```bash
  sudo usermod -aG docker jenkins
  sudo systemctl restart jenkins
  ```

### ❌ Scale lệnh bị chặn: "service locked"
- Docker Swarm đang trong quá trình update khác
- Chờ 60s và thử lại: `docker service ps auto-deploy_stack_frontend`

---

*Tài liệu được tạo ngày 11/05/2026 — Auto-Scaling v1.0*
