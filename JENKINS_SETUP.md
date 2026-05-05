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
