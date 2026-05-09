# 🏗️ System Architecture & Operations Guide (SOP)

Tài liệu này quy hoạch lại toàn bộ hệ thống CI/CD, Observability và quy trình vận hành chuẩn cho dự án.

## 1. Kiến trúc Hệ thống (Architecture)

Hệ thống được vận hành trên **Docker Swarm** với 2 vai trò chính:

### A. Manager Node (Điều khiển)
- **Địa chỉ:** `ip-172-31-2-142`
- **Dịch vụ chạy:** 
  - **Jenkins:** Tự động hóa build và deploy.
  - **Portainer UI:** Giao diện quản lý Docker tập trung.
- **Nhiệm vụ:** Nhận code từ GitHub, xây dựng Image và ra lệnh deploy cho các máy khác.

### B. Worker Node (Thực thi)
- **Địa chỉ:** `ip-172-31-95-223`
- **Dịch vụ chạy:** 
  - **Backend (FastAPI):** Xử lý logic.
  - **Frontend (React):** Giao diện người dùng.
  - **Grafana Alloy:** Thu thập Metrics, Logs, Traces.
  - **Portainer Agent:** Cung cấp dữ liệu cho Manager.
- **Nhiệm vụ:** Chạy ứng dụng thực tế và phục vụ người dùng.

---

## 2. Quy trình Vận hành Chuẩn (SOP)

### ✅ Quy tắc "Bất di bất dịch":
1. **Không chạy `docker-compose up`**: Chỉ dùng lệnh này trên máy Local của bạn để test. Trên máy chủ (EC2), chỉ dùng `docker stack deploy`.
2. **Mọi thay đổi phải qua Jenkins**: Không sửa code trực tiếp trên EC2.
3. **Dọn dẹp container lẻ**: Luôn đảm bảo không có container nào chạy bằng `docker run` trùng cổng với hệ thống Swarm.

### 🚀 Quy trình Deploy:
1. **Developer:** `git push origin main`
2. **Jenkins:** Tự động nhận lệnh -> Build Image -> Push lên Docker Hub.
3. **Jenkins:** Đẩy file `docker-compose.yml` lên Swarm dưới dạng **Stack**.
4. **Swarm:** Tự động phân phối các service sang máy Worker và Manager theo cấu hình.

---

## 3. Quản lý Cấu hình (Configuration)

Để hệ thống hoạt động ổn định trên nhiều máy, chúng ta sử dụng **Docker Config**.

- **Alloy Config:** Thay vì dùng file vật lý, nội dung file `config.alloy` được lưu vào bộ nhớ của Swarm.
  - Lệnh tạo: `docker config create alloy_config_vX config.alloy`
  - Lợi ích: Máy Worker tự động nhận được cấu hình mà không cần copy file thủ công.

---

## 4. Các lệnh Xử lý Sự cố (Troubleshooting)

### 🧹 1. Dọn dẹp xung đột cổng
Nếu thấy service không chạy (0/1), hãy kiểm tra xem có container lẻ nào đang chiếm cổng không:
```bash
docker rm -f backend frontend portainer alloy
```

### 🔍 2. Kiểm tra trạng thái hệ thống
Xem danh sách các service đang chạy và số lượng bản sao:
```bash
docker service ls
```

### 📋 3. Xem Log của một Service cụ thể
Ví dụ muốn xem tại sao Backend lỗi:
```bash
docker service logs -f auto-deploy_stack_backend
```

### 🔄 4. Khởi động lại một Service
```bash
docker service update --force auto-deploy_stack_alloy
```

---

## 6. Quy trình Xây dựng lại từ đầu (Full Rebuild Guide)

Nếu hệ thống bị lỗi nặng hoặc bạn muốn "làm sạch" để chạy lại theo quy hoạch mới, hãy làm theo các bước sau:

### Bước 1: Dọn dẹp trên Manager Node (ip-172-31-2-142)
Chạy các lệnh sau để xóa bỏ mọi tàn dư:
```bash
# 1. Xóa các Stack đang chạy
docker stack rm auto-deploy_stack
docker stack rm portainer

# 2. Xóa các container lẻ, rác (nếu có)
docker rm -f $(docker ps -aq)

# 3. Xóa các config cũ
docker config rm alloy_config_v1
```

### Bước 2: Thiết lập cấu hình Swarm mới
```bash
# 1. Tạo lại Config cho Alloy (file config.alloy phải có sẵn ở thư mục hiện tại)
docker config create alloy_config_v1 config.alloy

# 2. Kiểm tra danh sách config
docker config ls
```

### Bước 3: Kích hoạt Jenkins Build
1. Truy cập Jenkins Dashboard.
2. Chọn Job của project và nhấn **"Build Now"**.
3. Jenkins sẽ tự động thực hiện: Build -> Push -> Stack Deploy.

### Bước 4: Kiểm tra thành quả
Sau khi Jenkins báo Success, bạn kiểm tra trên Manager:
```bash
# Kiểm tra các service đã lên chưa
docker service ls

# Xem service nào đang lỗi (nếu Replicas là 0/1)
docker service ps auto-deploy_stack_alloy
```

---

## 7. Ghi chú về Môi trường (.env)
File `.env` chứa các thông tin nhạy cảm của Grafana Cloud. Khi thay đổi Token hoặc URL, bạn chỉ cần sửa file `.env` trên máy Manager và Jenkins sẽ tự động áp dụng vào Stack trong lần Deploy tới.
