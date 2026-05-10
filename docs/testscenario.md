# Kịch bản Kiểm thử Docker Swarm với k6

Tài liệu này mô tả các kịch bản kiểm thử (Test Scenarios) hệ thống triển khai trên Docker Swarm, tập trung vào 3 tính năng cốt lõi: **Zero Downtime Deployment**, **Self-Healing** và **Auto-Scaling**.

## Chuẩn bị: Script K6 tạo tải (`load_test.js`)
Tạo một file `load_test.js` trong dự án để giả lập người dùng truy cập liên tục vào hệ thống.

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 },  // Tăng dần lên 50 Virtual Users trong 30s
    { duration: '2m', target: 50 },   // Giữ tải ổn định trong 2 phút
    { duration: '30s', target: 0 },   // Giảm dần về 0
  ],
  thresholds: {
    http_req_duration: ['p(99)<500'], // 99% request < 500ms
    http_req_failed: ['rate<0.01'],   // Tỉ lệ lỗi < 1%
  },
};

export default function () {
  // Test Backend API
  const resApi = http.get('http://localhost:8000/api/health');
  check(resApi, {
    'API is status 200': (r) => r.status === 200,
  });

  // Test Frontend
  const resWeb = http.get('http://localhost:80'); 
  check(resWeb, {
    'Web is status 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

## Hướng dẫn chạy K6 nội bộ (Local) trên EC2
Vì chúng ta đã thiết lập sẵn file `load_test.js` (không bị map vào bất kỳ volume build nào của app), cách nhanh và tối ưu nhất để test trực tiếp trên file host mà không cần cài thêm phần mềm, ta sẽ nạp nội dung của file lệnh (`< load_test.js`) trực tiếp vào Docker bằng luồng stdin.

Lệnh thực thi chạy K6 bằng container tạm thời:
```bash
docker run --rm -i --network host grafana/k6 run - < load_test.js
```
*(Lưu ý: Nếu không sử dụng k6, bạn hoàn toàn có thể test kịch bản này bằng cách mở trình duyệt, ấn F5 liên tục (hoặc dùng một vòng lặp `curl http://34.196.57.162` trên terminal) trong lúc Jenkins đang build và phát hành ảnh mới, miễn sao xác nhận được việc luồng người dùng truy cập không bị trả về màn hình lỗi tải trang).*

---

## Kịch Bản 1: Zero Downtime Deployment (Cập nhật không gián đoạn)

**Mục tiêu:** Chứng minh cấu hình `update_config` của Docker Swarm hoạt động ứng dụng không bị rớt mạng khi có bản cập nhật mới.

**Cách thực hiện:**
1. **Bước 1:** Khởi chạy script k6 bằng Docker để tạo truy cập liên tục:
   ```bash
   docker run --rm -i --network host grafana/k6 run - < load_test.js
   ```
2. **Bước 2:** Commit thay đổi code Frontend/Backend và Push lên Git.
3. **Bước 3:** Chờ Jenkins tự chạy pipeline và gọi lệnh update update image mới lên Swarm. (Hoặc có thể chạy tay lệnh: `docker service update --image <tên_image>:v2 <stack_name>_frontend`)
4. **Đánh giá:** Quan sát output của k6. Trong suốt quá trình cập nhật mới, website vẫn hoạt động liên tục (status 200) và K6 không sinh ra lỗi. Docker Swarm sẽ tắt dần từng container cũ đi và bật container của version mới lên thay thế.

**[Giải thích] Cơ chế Zero Downtime hoạt động như thế nào?**
Quá trình này dựa trên kỹ thuật **Rolling Update** kết hợp với **Routing Mesh** của Docker Swarm:
- **Khởi động Container mới trước** (`order: start-first`): Hệ thống tạo container phiên bản mới (V2) trong khi các container cũ (V1) vẫn đang chạy và phục vụ người dùng.
- **Kiểm tra sức khỏe (Healthcheck)**: Load Balancer sẽ không đẩy request vào container V2 cho đến khi nó khởi động xong và báo trạng thái `Healthy`.
- **Tắt và Nghỉ** (`parallelism: 1`, `delay: 10s`): Khi container V2 sẵn sàng nhận request, Swarm ngắt kết nối an toàn với 1 container V1 cũ và xóa nó. Sau đó nghỉ 10 giây trước khi lặp lại vòng lặp cho các replica còn lại. Xuyên suốt quá trình, luôn có ít nhất 2 container (cũ, hoặc cũ kết hợp mới) thay nhau gánh tải nên tỉ lệ rớt mạng bằng 0.

**[Giải thích] Tại sao lại thiết lập `replicas: 2`?**
Con số 2 là cấu hình "vàng" cho mức cơ bản vì nó tiết kiệm tài nguyên nhưng vẫn đảm bảo tính sẵn sàng cao (High Availability):
1. **Phục vụ Cân bằng tải:** Phải có ít nhất 2 replicas thì bạn mới phát huy được bộ cân bằng phân chia request của Swarm.
2. **Tránh Downtime khi lỗi:** Nếu chỉ chạy 1 replica, lúc container đó bị lỗi crash thì ứng dụng sẽ "sập" hoàn toàn trong vài giây chờ Swarm tạo lại. Có 2 replicas đảm bảo nếu chết 1, cái còn lại vẫn duy trì web.
3. **An toàn khi cập nhật:** Khi cuốn chiếu phiên bản mới, nếu container mới bị lỗi ngầm, bạn vẫn còn 1 container chạy phiên bản cũ chống đỡ trong khi gọi lệnh rollback.

---

## Kịch Bản 2: Self-Healing (Tự động phục hồi)

**Mục tiêu:** Kiểm tra khả năng tự động thay thế khi phát hiện một hoặc vài containers bị sập (lỗi ứng dụng, hết RAM, hoặc lỡ tay kill). Hệ thống sẽ luôn đảm bảo được số lượng `replicas`.

**Cách thực hiện (Tùy chọn hiển thị):**
*(Kịch bản này bạn có thể cắm 1 Terminal chạy K6 liên tục ở máy tính cá nhân để xem tác động trực tiếp đến người dùng. Hoặc đơn giản nhất, bạn dùng trực tiếp 1 màn hình EC2 là đủ).*

1. **Bước 1:** SSH vào máy chủ EC2 quản lý Docker Swarm.
2. **Bước 2:** Lấy ID của một container backend hoặc frontend đang chạy và Ép dừng (kill) nó:
   ```bash
   # Tìm ID container của frontend
   docker ps
   # Ép dừng container
   docker kill <container_id_của_frontend>
   ```
3. **Bước 3 (Đánh giá):** 
   Ngay lập tức, gõ lệnh theo dõi lịch sử dịch vụ:
   ```bash
   docker service ps <stack_name>_frontend
   ```
   Bạn sẽ thấy container vừa bị kill thay đổi trạng thái thành `Failed`, và gần như ngay lập tức, Swarm lập tức tạo một task container mới toanh trạng thái `Running` để lấp vào chỗ trống, đảm bảo quy định `replicas: 2`.

---

## Kịch Bản 3: Auto-Scaling (Tự động mở rộng)

**Mục tiêu:** Hệ thống tự động tạo thêm replicas (node/container) khi mức tải vượt quá sức chịu đựng thông thường.

*Lưu ý:* Bản thân Docker Swarm không có auto-scaler mặc định khi CPU tăng cao, tiến trình này yêu cầu một luồng tự động hoá bằng kết hợp Observability và CI/CD.

**Cách thực hiện:**
1. **Bước 1:** Thay đổi thông số k6 đẩy tải cực lớn (VD: config 500-1000 Users) nhằm làm CPU của container vọt lên chạm mức cao (>80%).
2. **Bước 2:** Grafana Alloy / Prometheus thu nhận log đo đạc phần trăm CPU và kích hoạt **Trigger (Alert)**.
3. **Bước 3:** Alertmanager sẽ gửi webhook kích hoạt một tiến trình (Ví dụ gửi Webhook gọi Jenkins trigger một Job).
4. **Bước 4:** Jenkins Job này sẽ làm nhiệm vụ chạy lệnh tự động scale-up:
   ```bash
   docker service scale <stack_name>_frontend=5
   ```
5. **Đánh giá:** Sau khi tự scale hệ thống từ 2 lên 5 replicas, Load Balancer chia nhỏ truy cập k6 sang 5 node, phản hồi (response time) bên màn hình k6 sẽ tụt xuống lại về mốc xanh (nhanh và hết nghẽn). Ngược lại, khi k6 test xong tải tụt về mức thấp, ta có Trigger Alert thứ 2 để Scale-down về số 2 như bình thường.
