import http from 'k6/http';
import { check, sleep } from 'k6';

// ============================================================
// K6 LOAD TEST — 2 profiles: normal (bình thường) và high (stress)
// 
// Chạy bình thường (Kịch bản 1 & 2):
//   docker run --rm -i --network host grafana/k6 run - < load_test.js
//
// Chạy stress test (Kịch bản 3 - Auto-Scaling):
//   docker run --rm -i --network host -e PROFILE=high grafana/k6 run - < load_test.js
// ============================================================

const PROFILE = __ENV.PROFILE || 'normal';

// IPs của các node trong Swarm cluster
// Manager (Jenkins, Portainer): 35.172.60.19
// Worker  (Backend, Frontend):  34.196.57.162
const BACKEND_HOST  = __ENV.BACKEND_HOST  || '34.196.57.162';  // Worker
const FRONTEND_HOST = __ENV.FRONTEND_HOST || '34.196.57.162';  // Worker (Frontend also here)

// Profile bình thường: kiểm tra Zero Downtime & Self-Healing
const normalStages = [
  { duration: '30s', target: 50 },   // Tăng dần lên 50 VUs trong 30s
  { duration: '2m',  target: 50 },   // Giữ tải ổn định 2 phút
  { duration: '30s', target: 0  },   // Giảm về 0
];

// Profile stress: mục đích kích hoạt Auto-Scaling Alert (CPU > 80%)
// Tăng tốc độ ramp-up để đạt đỉnh nhanh nhất
const highStages = [
  { duration: '20s', target: 300 }, // Lên đỉnh 300 users cực nhanh
  { duration: '5m',  target: 300 }, // Duy trì tải cao
  { duration: '1m',  target: 0   },
];

export const options = {
  stages: PROFILE === 'high' ? highStages : normalStages,
  thresholds: {
    // Ngưỡng đánh giá: p99 < 500ms và lỗi < 1% ở normal
    // Ở high load, ngưỡng nới lỏng hơn để k6 không dừng sớm
    http_req_duration: PROFILE === 'high'
      ? ['p(95)<3000']   // Chấp nhận tối đa 3s khi stress test
      : ['p(99)<500'],   // Bình thường < 500ms
    http_req_failed: ['rate<0.05'],  // Tỉ lệ lỗi < 5%
  },
};

export default function () {
  if (PROFILE === 'high') {
    // === STRESS PROFILE: Ép CPU lên 100% ===
    // Tăng iterations lên 3,000,000 để mỗi request "ngốn" CPU lâu hơn
    const resStress = http.get(`http://${BACKEND_HOST}:8000/api/stress?iterations=3000000`);
    check(resStress, {
      'Stress endpoint 200': (r) => r.status === 200,
      'Stress response < 10s': (r) => r.timings.duration < 10000,
    });
    sleep(0.1); // Gửi dồn dập
  } else {
    // === NORMAL PROFILE: Test Zero Downtime & Self-Healing ===
    const resApi = http.get(`http://${BACKEND_HOST}:8000/api/health`);
    check(resApi, {
      'Backend API status 200': (r) => r.status === 200,
      'Backend API response < 2s': (r) => r.timings.duration < 2000,
    });

    const resWeb = http.get(`http://${FRONTEND_HOST}:80`);
    check(resWeb, {
      'Frontend status 200': (r) => r.status === 200,
    });

    const resItems = http.get(`http://${BACKEND_HOST}:8000/api/users`);
    check(resItems, {
      'Users API status 200': (r) => r.status === 200,
    });

    sleep(1);
  }
}
