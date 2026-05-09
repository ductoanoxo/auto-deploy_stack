pipeline {
    agent any

    environment {
        // Thay bằng IP Private của máy Project 
        PROJECT_SERVER_IP = '172.31.95.223'
        // Credential ID vừa tạo trong Jenkins Dashboard
        SSH_CREDENTIAL_ID = 'project-server-ssh'
        DOCKER_HUB_USER = 'toantra349'
        DOCKER_COMPOSE_VERSION = 'v2'
        TAG = "${env.BUILD_NUMBER}"
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
                    sh 'TAG=${TAG} docker compose build'
                }
            }
        }
        stage('Push to Docker Hub') {
            steps {
                script {
                    echo 'Pushing images to Docker Hub...'
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-hub-creds') {
                        // docker compose build đã tag đúng tên và số build từ docker-compose.yml
                        sh "docker push ${DOCKER_HUB_USER}/backend:${TAG}"
                        sh "docker push ${DOCKER_HUB_USER}/frontend:${TAG}"
                    }
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    echo "Deploying to Docker Swarm Cluster (Version: ${TAG})..."
                    // Nạp biến từ .env và tạo Docker Config mới
                    sh """
                        export TAG=${TAG}
                        if [ -f .env ]; then
                            set -a
                            . ./.env
                            set +a
                        fi
                        
                        # Tạo config mới từ file local (Swarm Config là bất biến nên dùng TAG để tạo version mới)
                        docker config create alloy_config_v${TAG} config.alloy || true
                        
                        docker stack deploy --with-registry-auth --resolve-image always -c docker-compose.yml auto-deploy_stack
                        
                        # Dọn dẹp Docker Image cũ và rác hệ thống (giữ lại image trong 24h gần nhất)
                        docker system prune -af --filter "until=24h"
                    """
                }
            }
        }
        stage('Health Check') {
            steps {
                script {
                    echo "Running Health Check on ${PROJECT_SERVER_IP}..."
                    // Wait for Swarm to stabilize
                    sleep 30
                    
                    retry(3) {
                        try {
                            sh "curl -f http://${PROJECT_SERVER_IP}:8000/api/health"
                            echo 'Health check passed!'
                        } catch (Exception e) {
                            echo "Health check failed, retrying in 10s... (Error: ${e.message})"
                            sleep 10
                            error "Backend not reachable on ${PROJECT_SERVER_IP}:8000"
                        }
                    }
                    
                    // Verify Status endpoint
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
