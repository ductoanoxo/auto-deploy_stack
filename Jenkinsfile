pipeline {
    agent any

    environment {
        // Thay bằng IP Private của máy Project 
        PROJECT_SERVER_IP = '172.31.95.223'
        // Credential ID vừa tạo trong Jenkins Dashboard
        SSH_CREDENTIAL_ID = 'project-server-ssh'
        DOCKER_HUB_USER = 'toantra349'
        DOCKER_COMPOSE_VERSION = 'v2'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Test Backend') {
            steps {
                script {
                    echo 'Running Backend Tests...'
                    // Build the tester stage from multi-stage Dockerfile
                    sh 'docker build --no-cache --target tester -t backend-tester ./backend'
                }
            }
        }

        stage('Build Images') {
            steps {
                script {
                    echo 'Building Docker Images...'
                    sh 'docker compose build --no-cache'
                }
            }
        }
        stage('Push to Docker Hub') {
            steps {
                script {
                    echo 'Pushing images to Docker Hub...'
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-hub-creds') {
                        // docker compose build đã tag đúng tên từ docker-compose.yml
                        // KHÔNG dùng docker tag vì nó có thể ghi đè image mới bằng image cũ đã cache
                        sh "docker push ${DOCKER_HUB_USER}/backend:latest"
                        sh "docker push ${DOCKER_HUB_USER}/frontend:latest"
                    }
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    echo "Deploying to Docker Swarm Cluster..."
                    // --resolve-image always: Bắt buộc Swarm phải check và pull image mới nhất từ Registry
                    sh "docker stack deploy --with-registry-auth --resolve-image always -c docker-compose.yml auto-deploy_stack"
                }
            }
        }
        stage('Health Check') {
            steps {
                script {
                    echo "Running Health Check on ${PROJECT_SERVER_IP}..."
                    // Tăng thời gian chờ để Swarm kịp Pull Image và khởi động
                    sh 'sleep 40'
                    
                    // Verify backend is running (Sửa localhost thành IP Project)
                    sh "curl -f http://${PROJECT_SERVER_IP}:8000/api/health"
                    echo 'Health check passed!'
                    
                    // Verify ChatOps /status endpoint can reach Docker
                    sh "curl -f http://${PROJECT_SERVER_IP}:8000/api/status"
                    echo 'Status endpoint verified!'
                }
            }
        }
    }

    post {
        always {
            script {
                def status = currentBuild.currentResult
                def emoji = status == 'SUCCESS' ? '✅' : '❌'
                def message = """
${emoji} *Jenkins Build Alert*
*Project:* ${env.JOB_NAME}
*Build:* #${env.BUILD_NUMBER}
*Status:* ${status}
*URL:* ${env.BUILD_URL}
""".trim()
                
                withCredentials([string(credentialsId: 'telegram-bot-token', variable: 'TOKEN'),
                                 string(credentialsId: 'telegram-chat-id', variable: 'CHAT_ID')]) {
                    sh "curl -s -X POST https://api.telegram.org/bot${TOKEN}/sendMessage -d chat_id=${CHAT_ID} -d parse_mode=Markdown -d text='${message}'"
                }
            }
        }
        success {
            echo 'Pipeline finished successfully!'
        }
        failure {
            echo 'Pipeline failed. Please check the logs.'
        }
    }
}
