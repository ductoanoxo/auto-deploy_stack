# 🔗 Hướng dẫn kết nối Jenkins Server và Project Server

Tài liệu này hướng dẫn cách cấu hình để máy **Jenkins (Build Server)** có thể điều khiển và deploy ứng dụng sang máy **Project (App Server)**.

> [!NOTE]
> **Về Key Pair khi tạo EC2:**
> Bạn có thể dùng chung **một Key Pair** (file `.pem`) cho cả 2 máy Jenkins và Project. 
> *   Để vào máy Jenkins: `ssh -i key.pem ubuntu@IP_JENKINS`
> *   Để vào máy Project: `ssh -i key.pem ubuntu@IP_PROJECT`
> *   Việc dùng chung key giúp bạn dễ quản lý, bạn phân biệt 2 máy dựa vào địa chỉ IP của chúng.

---

## 1. Cấu hình Mạng (Security Groups)

### Tại máy Project (App Server):
Cần mở các port sau để nhận kết nối từ bên ngoài và từ Jenkins:

| Type | Protocol | Port range | Source type | Value (Source) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | 22 | My IP | `IP_CỦA_BẠN` | SSH cá nhân |
| **SSH** | TCP | 22 | Custom | `sg-xxx (Jenkins SG)` | Jenkins SSH Deploy |
| **HTTP** | TCP | 80 | Anywhere-IPv4 | `0.0.0.0/0` | Web Frontend |
| **Custom TCP** | TCP | 8000 | Anywhere-IPv4 | `0.0.0.0/0` | FastAPI Backend API |
| **HTTPS** | TCP | 443 | Anywhere-IPv4 | `0.0.0.0/0` | SSL (Tương lai) |

---

### Tại máy Jenkins (Build Server):

| Type | Protocol | Port range | Source type | Value (Source) | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SSH** | TCP | 22 | My IP | `IP_CỦA_BẠN` | SSH cá nhân |
| **Custom TCP** | TCP | 8080 | My IP | `IP_CỦA_BẠN` | Jenkins Web UI |

---

## 2. Thiết lập SSH Key (Để Jenkins không cần nhập pass)

Bước này giúp máy Jenkins "truy cập không mật khẩu" vào máy Project.

### Bước 2.1: Tạo SSH Key trên máy Jenkins
Nếu bạn chưa có key, hãy SSH vào máy Jenkins và chạy:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa_jenkins
# Nhấn Enter liên tục (không đặt passphrase)
```

### Bước 2.2: Copy Public Key sang máy Project
Lấy nội dung key vừa tạo:
```bash
cat ~/.ssh/id_rsa_jenkins.pub
```
**Copy đoạn text hiện ra.**

### Bước 2.3: Dán vào máy Project
SSH vào máy **Project**, mở file authorized_keys:
```bash
mkdir -p ~/.ssh
nano ~/.ssh/authorized_keys
```
**Dán đoạn text vào cuối file và lưu lại (Ctrl+O, Enter, Ctrl+X).**

### Bước 2.4: Kiểm tra kết nối
Từ máy Jenkins, thử SSH sang máy Project:
```bash
ssh -i ~/.ssh/id_rsa_jenkins ubuntu@<IP_PRIVATE_PROJECT>
```
*Nếu vào thẳng được terminal của máy Project mà không hỏi pass là thành công!*

---

## 3. Khởi tạo Docker Swarm Cluster (Tùy chọn)

Để quản lý container tập trung, bạn nên kết nối 2 máy vào 1 cụm Swarm.

### Tại máy Jenkins (Manager):
```bash
docker swarm init --advertise-addr <IP_PRIVATE_JENKINS>
```
Hệ thống sẽ trả về một lệnh dạng: `docker swarm join --token <TOKEN> <IP>:2377`

### Tại máy Project (Worker):
Copy lệnh vừa nhận được ở trên và chạy trên máy Project:
```bash
docker swarm join --token <TOKEN> <IP_PRIVATE_JENKINS>:2377
```

---

## 4. Cấu hình trong Jenkins Dashboard

Để Jenkins dùng được key này trong Pipeline:

1. Vào **Manage Jenkins** → **Credentials**.
2. Chọn **System** → **Global credentials** → **Add Credentials**.
3. **Kind:** SSH Username with private key.
4. **ID:** `project-server-ssh` (Dùng ID này trong Jenkinsfile).
5. **Username:** `ubuntu` (hoặc user của EC2).
6. **Private Key:** Copy toàn bộ nội dung file `~/.ssh/id_rsa_jenkins` trên máy Jenkins và dán vào đây.

---

## 5. Lệnh Deploy mẫu trong Jenkinsfile

Sau khi kết nối, bạn có thể dùng lệnh này để deploy từ xa:

```groovy
stage('Deploy') {
    steps {
        sshagent(['project-server-ssh']) {
            sh "ssh -o StrictHostKeyChecking=no ubuntu@<IP_PRIVATE_PROJECT> 'cd /home/ubuntu/app && docker compose pull && docker compose up -d'"
        }
    }
}
```

---

> [!TIP]
> Luôn sử dụng **IP Private** khi kết nối giữa 2 máy EC2 trong cùng một VPC để tiết kiệm chi phí băng thông và tăng tính bảo mật.
---

## 6. Lưu ý & Các lỗi thường gặp (Troubleshooting)

Trong quá trình thiết lập, bạn có thể gặp các lỗi sau:

### ❌ Lỗi 1: `Could not resolve 'download.docker.io'`
- **Nguyên nhân:** Lỗi DNS hoặc mất kết nối Internet tạm thời.
- **Cách sửa:** Kiểm tra `ping google.com`. Nếu ping được, hãy dùng script cài đặt tự động: `curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh`.

### ❌ Lỗi 2: `permission denied while trying to connect to the docker API`
- **Nguyên nhân:** User chưa được cập nhật quyền vào group `docker`.
- **Cách sửa:** Chạy lệnh `newgrp docker` để cập nhật quyền ngay lập tức mà không cần logout.

### ❌ Lỗi 3: `Timeout was reached before node joined` (Khi join Swarm)
- **Nguyên nhân:** Security Group của máy Manager (Jenkins) chưa mở các port 2377, 7946, 4789.
- **Lưu ý về Source:** Khi mở port trên máy Jenkins, phần **Source** phải là **Security Group ID của máy Project** (hoặc dải IP nội bộ `172.31.0.0/16`). Nếu nhầm lẫn giữa SG của 2 máy, kết nối sẽ bị chặn (Timeout).
- **Cách sửa:** Đảm bảo cả 2 máy đều cho phép các port này từ máy kia. Dùng lệnh `nc -zv <IP_MANAGER> 2377` để kiểm tra thông mạch trước khi join.

### ❌ Lỗi 5: Backend Crash khi khởi động (Database Connection)
- **Nguyên nhân:** Backend cố gắng tạo bảng dữ liệu ngay khi khởi động nhưng Database (Supabase) chưa sẵn sàng hoặc kết nối bị từ chối, dẫn đến container bị sập (Exit 1).
- **Cách sửa:** Bao bọc lệnh khởi tạo database (`Base.metadata.create_all`) trong khối `try-except` và ghi log lỗi thay vì để ứng dụng sập. Điều này giúp container vẫn "sống" để trả về kết quả Health Check.

### ❌ Lỗi 6: Docker Swarm giết Container liên tục (Exit 0/Shutdown)
- **Nguyên nhân:** Lỗi cú pháp trong lệnh `HEALTHCHECK` của `Dockerfile` (thừa dấu cách sau dấu gạch chéo `\ `). Docker Swarm hiểu sai lệnh và coi container luôn ở trạng thái "Unhealthy", dẫn đến việc tự động tắt container cũ sau khi hết `start-period`.
- **Dấu hiệu:** `docker service ps` báo trạng thái `Shutdown / Complete` liên tục mà không có lỗi cụ thể.
- **Cách sửa:** Kiểm tra kỹ khoảng trắng trong `Dockerfile` và đồng bộ cấu hình `healthcheck` vào file `docker-compose.yml`.

### ❌ Lỗi 7: Jenkins không thể Health Check tới Worker Node (Connection Refused)
- **Nguyên nhân:** Security Group của máy Project chưa mở port 8000 cho máy Jenkins, hoặc cấu hình IP đích bị sai.
- **Giải pháp tối ưu:** Sử dụng **Docker Swarm Routing Mesh**. Thay vì gọi tới IP thật của máy Project, hãy gọi tới `http://localhost:8000` ngay trên máy Jenkins. Swarm sẽ tự động điều hướng gói tin tới đúng container đang chạy ở bất kỳ đâu trong cụm.

### ❌ Lỗi 8: Docker Compose Validation Error (healthcheck)
- **Nguyên nhân:** Đặt khối `healthcheck` sai vị trí (bên trong khối `deploy`).
- **Cách sửa:** `healthcheck` phải là thuộc tính trực tiếp của **Service**, nằm cùng cấp với `image`, `ports`, và `volumes`.
