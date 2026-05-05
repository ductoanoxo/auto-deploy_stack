pipeline {
    agent any

    environment {
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
                    sh 'docker build --target tester -t backend-tester ./backend'
                }
            }
        }

        stage('Build Images') {
            steps {
                script {
                    echo 'Building Docker Images...'
                    sh 'docker compose build'
                }
            }
        }
        stage('Push to Docker Hub') {
            steps {
                script {
                    echo 'Pushing images to Docker Hub...'
                    docker.withRegistry('https://index.docker.io/v1/', 'docker-hub-creds') {
                        // Tag và Push Backend (Dùng tên image mặc định của docker-compose)
                        sh 'docker tag auto-deploy_stack-backend ductoanoxo/backend:latest'
                        sh 'docker push ductoanoxo/backend:latest'
                        
                        // Tag và Push Frontend
                        sh 'docker tag auto-deploy_stack-frontend ductoanoxo/frontend:latest'
                        sh 'docker push ductoanoxo/frontend:latest'
                    }
                }
            }
        }
        stage('Deploy') {
            steps {
                script {
                    echo 'Deploying Application...'
                    // Restart containers with the new images
                    sh 'docker compose down'
                    sh 'docker compose up -d'
                    sh 'docker image prune -f'
                }
            }
        }
    }

    post {
        success {
            echo 'Pipeline finished successfully!'
        }
        failure {
            echo 'Pipeline failed. Please check the logs.'
        }
    }
}
