import os
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

# Xác định đường dẫn gốc của project
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../'))
ENV_PATH = os.path.join(BASE_DIR, '.env')

# Load biến môi trường (OPENAI_API_KEY) từ file .env
load_dotenv(dotenv_path=ENV_PATH)

DOCS_DIR = os.path.join(BASE_DIR, 'docs')
CHROMA_DB_DIR = os.path.join(BASE_DIR, 'backend', 'chroma_db')

def ingest_docs():
    print(f"🔍 Bắt đầu đọc tài liệu từ: {DOCS_DIR}")
    
    # 1. Load toàn bộ file Markdown (.md)
    # Autoload dùng TextLoader để đảm bảo text sạch và không bị lỗi decode UTF-8
    loader = DirectoryLoader(
        DOCS_DIR, 
        glob="**/*.md", 
        loader_cls=TextLoader,
        loader_kwargs={'autodetect_encoding': True}
    )
    documents = loader.load()
    print(f"✅ Đã tải {len(documents)} file tài liệu.")

    # 2. Băm nhỏ văn bản (Chunking)
    # Chunk 1000 ký tự, chống đứt đoạn bằng overlap 200 ký tự
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    chunks = text_splitter.split_documents(documents)
    print(f"✂️ Đã cắt nhỏ thành {len(chunks)} đoạn (chunks).")

    # 3. Kích hoạt Embeddings Model của OpenAI
    if not os.getenv("OPENAI_API_KEY"):
        raise ValueError("❌ Lỗi: Không tìm thấy OPENAI_API_KEY trong file .env!")
        
    embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
    
    print(f"🧠 Đang mã hóa Vector và lưu vào DB cục bộ tại: {CHROMA_DB_DIR}...")
    # Tạo mới hoặc ghi đè thư mục ChromaDB
    Chroma.from_documents(
        documents=chunks, 
        embedding=embeddings, 
        persist_directory=CHROMA_DB_DIR
    )
    
    print("🎉 Hoàn tất quá trình tạo Data Ingestion (RAG Knowledge Base)!")

if __name__ == "__main__":
    ingest_docs()
