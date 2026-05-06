# 🛠️ Hướng dẫn Setup Jenkins trên AWS EC2

Tài liệu này hướng dẫn bạn cách cài đặt và cấu hình Jenkins để tự động hóa quy trình CI/CD cho dự án này trên môi trường AWS EC2.

---

## 1. Chuẩn bị Instance EC2

1.  **Launch Instance:**
    - OS: **Ubuntu 24.04 LTS**.
    - Type: **c7i-flex.large** (2 vCPU, 4 GiB RAM - Free Tier eligible).
    - Storage: **20 GiB** (SSD gp3).
2.  **Security Group:** Mở các port sau:
    - `22`: SSH (Truy cập server).
    - `8080`: Jenkins Dashboard.
    - `80` & `443`: HTTP/HTTPS (Frontend tiêu chuẩn).
    - `3000`: Frontend (Port mặc định trong docker-compose).
    - `8000`: Backend API.

---

## 2. Cài đặt Docker & Docker Compose

Chạy các lệnh sau trên terminal của EC2:

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker
sudo apt install docker.io -y
sudo systemctl start docker
sudo systemctl enable docker

# Thêm user hiện tại vào group docker (để chạy lệnh ko cần sudo)
sudo usermod -aG docker $USER
# Lưu ý: Bạn cần logout và login lại để lệnh này có hiệu lực
```

Cài đặt Docker Compose v2:
```bash
sudo apt install docker-compose-v2 -y
```

---

## 3. Cài đặt Jenkins

Jenkins yêu cầu Java (JDK) để chạy.

```bash
# Cài đặt JDK 21
sudo apt install fontconfig openjdk-21-jre -y

# Thêm Jenkins Repository
sudo wget -O /usr/share/keyrings/jenkins-keyring.asc \
  https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key
echo "deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/" | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Cài đặt Jenkins
sudo apt update
sudo apt install jenkins -y

# Start Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins
```

---

## 4. Cấu hình Jenkins ban đầu

1.  Truy cập: `http://<EC2-Public-IP>:8080`
2.  Lấy mật khẩu admin:
    ```bash
    sudo cat /var/lib/jenkins/secrets/initialAdminPassword
    ```
3.  Chọn **"Install suggested plugins"**.
4.  Tạo tài khoản Admin.

### Cấp quyền cho Jenkins chạy Docker
Đây là bước **QUAN TRỌNG** để Jenkins có thể build image:
```bash
sudo usermod -aG docker jenkins
sudo systemctl restart jenkins
```

---

## 5. Cấu hình Pipeline cho dự án

1.  Trong Jenkins Dashboard, chọn **New Item**.
2.  Nhập tên dự án (vd: `jenkins-cicd-pipeline`) -> Chọn **Pipeline**.
3.  Phần **Pipeline Definition**, chọn **Pipeline script from SCM**.
4.  **SCM**: Git.
5.  **Repository URL**: Link GitHub của bạn.
6.  **Script Path**: `Jenkinsfile`.
7.  **Save** và nhấn **Build Now**.

---

## 6. Lưu ý về Resource
Nếu EC2 bị đứng khi build Docker, hãy thử tạo thêm **Swap RAM**:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 7. Nhật ký xử lý lỗi (Troubleshooting) 🛠️

Trong quá trình setup thực tế, chúng ta đã gặp và xử lý các vấn đề sau:

### ❌ Lỗi 1: GPG error (NO_PUBKEY) khi cài Jenkins
*   **Hiện tượng:** Không thể `apt update` do thiếu khóa bảo mật của Jenkins.
*   **Cách sửa:** Cài đặt thêm `dirmngr` và dùng `curl` để tải trực tiếp khóa mới nhất:
    ```bash
    sudo apt install dirmngr ca-certificates curl gnupg -y
    curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee /usr/share/keyrings/jenkins-keyring.asc > /dev/null
    ```

### ❌ Lỗi 2: Jenkins không khởi động (Sai phiên bản Java)
*   **Hiện tượng:** Log báo `Running with Java 17... minimum required version (Java 21)`.
*   **Cách sửa:** Nâng cấp lên **OpenJDK 21**:
    ```bash
    sudo apt install openjdk-21-jre -y
    sudo update-alternatives --config java # Chọn bản 21
    sudo systemctl restart jenkins
    ```

### ❌ Lỗi 3: `docker-compose: not found` trong Pipeline
*   **Hiện tượng:** Jenkinsfile dùng lệnh cũ có dấu gạch ngang.
*   **Cách sửa:** Đổi tất cả lệnh `docker-compose` thành **`docker compose`** (dấu cách) để tương thích với Docker Compose V2.

### ❌ Lỗi 4: `MissingPropertyException: No such property: docker`
*   **Hiện tượng:** Jenkins không hiểu lệnh `docker.withRegistry`.
*   **Cách sửa:** Vào Manage Jenkins -> Plugins -> Cài đặt plugin **"Docker Pipeline"**.

### ❌ Lỗi 5: `Could not find credentials matching docker-hub-creds`
*   **Hiện tượng:** Sai ID khi tạo Credentials.
*   **Cách sửa:** Khi tạo Credential cho Docker Hub, phải đặt ô **ID** chính xác là `docker-hub-creds`.

### ❌ Lỗi 6: Webhook GitHub bị lỗi khi restart EC2
*   **Hiện tượng:** IP máy ảo bị thay đổi khiến GitHub không gửi được tín hiệu về Jenkins.
*   **Cách sửa:** Sử dụng **Elastic IP** trên AWS để cố định địa chỉ IP cho server.
