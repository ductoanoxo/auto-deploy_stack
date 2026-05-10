import docker
import time
from prometheus_client import start_http_server, Gauge

client = docker.from_env()

running_replicas = Gauge('docker_swarm_service_running_replicas', 'Running replicas', ['service', 'service_name'])
desired_replicas = Gauge('docker_swarm_service_desired_replicas', 'Desired replicas', ['service', 'service_name'])

def update_metrics():
    while True:
        try:
            services = client.services.list()
            for service in services:
                name = service.name
                # Get desired replicas
                mode = service.attrs.get('Spec', {}).get('Mode', {})
                desired = 0
                if 'Replicated' in mode and mode['Replicated']:
                    desired = mode['Replicated'].get('Replicas', 0)
                elif 'Global' in mode:
                    # Approximation for global services
                    try:
                        nodes = client.nodes.list(filters={'role': 'manager'}) + client.nodes.list(filters={'role': 'worker'})
                        desired = len(nodes)
                    except Exception:
                        pass
                
                # Get running replicas
                tasks = service.tasks(filters={'desired-state': 'running'})
                running = len([t for t in tasks if t.get('Status', {}).get('State') == 'running'])
                
                desired_replicas.labels(service=name, service_name=name).set(desired)
                running_replicas.labels(service=name, service_name=name).set(running)
        except Exception as e:
            print("Error updating metrics: ", e)
        time.sleep(15)

if __name__ == '__main__':
    start_http_server(9000)
    print("Swarm Exporter started on port 9000")
    update_metrics()
