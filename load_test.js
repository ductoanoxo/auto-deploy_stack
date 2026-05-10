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
  // Đã hardcode IP public của EC2
  const TARGET_HOST = '34.196.57.162';

  // Test Backend API
  const resApi = http.get(`http://${TARGET_HOST}:8000/api/health`);
  check(resApi, {
    'API is status 200': (r) => r.status === 200,
  });

  // Test Frontend
  const resWeb = http.get(`http://${TARGET_HOST}:80`); 
  check(resWeb, {
    'Web is status 200': (r) => r.status === 200,
  });

  sleep(1);
}
