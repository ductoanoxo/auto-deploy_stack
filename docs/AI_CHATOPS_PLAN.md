# Kế Hoạch Triển Khai AI ChatOps (LangChain + RAG + Grafana API)

Tài liệu này mô tả chi tiết lộ trình xây dựng trợ lý AI ChatOps trên Telegram, sử dụng nền tảng mã nguồn mở LangChain, OpenRouter (để gọi LLM), RAG cho tài liệu hệ thống và cơ chế Agent (Tool Calling) để tự động truy vấn Grafana Cloud.

## 1. Kiến Trúc Hệ Thống (Architecture)

Hệ thống xoay quanh một **LangChain ReAct Agent** với 2 luồng dữ liệu chính:

1. **RAG Pipeline (Knowledge Base):**
   - **Nguồn:** Thư mục `docs/`, `Jenkinsfile`, `docker-compose.yml`,...
   - **Xử lý:** Cắt nhỏ văn bản (Chunking) -> Tạo Vector Embeddings -> Lưu vào cơ sở dữ liệu vector nhẹ (ChromaDB chạy local).
   - **Sử dụng:** Mục đích để trả lời các câu hỏi về *định dạng hệ thống, luồng CI/CD, cách thiết lập, port quy định*.

2. **AIOps Pipeline (Log & Metrics Data):**
   - **Nguồn:** Grafana Loki (Logs) và Prometheus (Metrics) thông qua API sinh ra từ Alloy.
   - **Xử lý:** LLM nhận yêu cầu từ người dùng -> Nhận diện Intent -> **Tự động sinh lệnh LogQL/PromQL** -> Dùng Tool (Hàm Python) gián tiếp gọi API Grafana -> Nhận về JSON Data -> Phân tích JSON đưa ra kết luận.
   - **Sử dụng:** Trả lời các câu hỏi *nghiệp vụ theo thời gian thực* như: "Web sập vì sao?", "Có bao nhiêu lỗi trong 15 phút qua?".

---

## 2. Các Công Cụ Và Thư Viện Cần Thiết

- **LangChain:** `langchain`, `langchain-community`, `langchain-openai` (dùng wrapper của OpenAI để gọi OpenRouter).
- **VectorDB:** `chromadb` (Không cần cài server riêng, chạy dạng file local rất nhẹ).
- **Embedding:** `openai/text-embedding-3-small` (Độ chính xác cao, chi phí cực rẻ - khoảng $0.02/1 triệu tokens, phù hợp để tạo vector cho DB tài liệu thay vì dùng local mode).
- **Telegram Bot:** `python-telegram-bot` (Chạy luồng giao tiếp với người dùng).
- **LLM API:** OpenRouter (Khuyến nghị dùng `google/gemini-1.5-flash` hoặc `openai/gpt-4o-mini` để tối ưu 2$).

---

## 3. Lộ Trình Thực Hiện (Roadmap)

### Bước 1: Setup & Định Nghĩa Nền Tảng
1. Cài đặt thêm các thư viện vào `backend/requirements.txt`.
2. Khai báo các API Key truy cập vào `.env` (Telegram, OpenRouter, Grafana Cloud Token).
3. (Tùy chọn) Viết 1 file cấu hình test để gửi http request lên Telegram và Grafana xem đã thông mạng chưa.

### Bước 2: Xây Dựng RAG Pipeline (Data Ingestion)
1. Tạo thư mục `backend/rag/`.
2. Viết script `ingest.py` sử dụng `DirectoryLoader` của Langchain để đọc toàn bộ đuôi `.md` trong thư mục `/docs/`.
3. Dùng `RecursiveCharacterTextSplitter` chia nội dung thành các chunk kích thước 1000 tokens.
4. Lưu vào ChromaDB tại thư mục `backend/chroma_db/`.

### Bước 3: Build Custom Tools (Vũ Khí Cho LLM)
1. **Tool `Loki_Log_Search`:**
   - Input: Câu truy vấn `query` (Dạng LogQL) và `time_range` (Ví dụ 1h).
   - Logic: Gọi `GET https://logs-prod-020.grafana.net/loki/api/v1/query_range` với auth là Grafana Token.
   - Output: Trả về dạng Text ngắn gọn (ví dụ: limit tối đa trả về 20 dòng) để tiết kiệm token cho LLM.
2. **Tool `Prometheus_Metric_Search`:**
   - Input: PromQL query.
   - Output: Values tình trạng CPU/RAM.

### Bước 4: Tích hợp Agent & Gắn vào Telegram (Cốt lõi)
1. Khởi tạo `ChatOpenAI` nhưng truyền vào `base_url="https://openrouter.ai/api/v1"`.
2. Truyền System Prompt: *"Mày là DevOps Bot. Khi User hỏi tài liệu, dùng DB Vector. Khi User xem tình trạng, viết query LogQL hoặc PromQL rồi dùng Tool Grafana."*
3. Bọc Agent vào trong hàm xử lý tin nhắn của `python-telegram-bot`.
4. Mở API / Webhook hoặc chạy background long-polling chung với FastAPI.

### Bước 5: Cập Nhật Vòng Lặp CI/CD
1. Trong `Jenkinsfile`, ở một step build Backend, tự động gọi file `ingest.py` để cập nhật VectorDB nếu code/tài liệu bị sửa.
2. Đóng gói ChromaDB vào Image (hoặc Mount dạng Volume để lưu bền vững).

---

## 4. Tối Ưu Chi Phí & Bảo Mật

- **Lọc ở Server:** Ép LLM dùng parameter `limit=10` trên Grafana API để đảm bảo dù lỗi có hàng triệu dòng cũng chỉ LLM phân tích 10 dòng tiêu biểu.
- **Whitelist Users:** Telegram Bot sẽ kiểm tra ID của người dùng. Chỉ những ID/Username có trong danh sách được cấp phép mới được quyền hỏi bot, tránh người lạ inbox dùng chùa API OpenRouter.
- **RAG Embedding Cost:** Dùng `openai/text-embedding-3-small`. Với giá thành chỉ $0.02 / 1 triệu tokens, tạo embeddings cho toàn bộ hệ thống code/docs của bạn (chắc chỉ tốn chưa tới $0.001) mang lại khả năng search ngữ nghĩa xuất sắc mà chi phí là con số 0. 
