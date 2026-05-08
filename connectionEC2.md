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

### ❌ Lỗi 4: Nhầm lẫn địa chỉ IP
- **Lưu ý:** Luôn dùng **dấu chấm (`.`)** cho IP, không dùng dấu gạch ngang (`-`). Nên dùng **IP Private** khi các máy cùng VPC để tối ưu tốc độ và chi phí.
