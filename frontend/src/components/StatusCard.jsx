import React from 'react';
import { ServerIcon, CpuIcon, RamIcon, DiskIcon, DockerIcon, ContainerIcon } from './Icons';

const StatusCard = ({ data }) => {
  if (!data) return null;

  const getUsageColor = (percent) => {
    if (percent < 50) return '#4ade80';  // green
    if (percent < 80) return '#fbbf24';  // yellow
    return '#f87171';                    // red
  };

  return (
    <div className="status-card">
      {/* Server Header */}
      <div className="status-header">
        <div className="status-indicator">
          <span className="status-dot"></span>
          Server đang chạy
        </div>
        <span className="status-time">{new Date(data.timestamp).toLocaleString('vi-VN')}</span>
      </div>

      {/* System Metrics */}
      <div className="metrics-grid">
        <div className="metric-item">
          <div className="metric-label">
            <span className="metric-icon">⚡</span>
            CPU
          </div>
          <div className="metric-bar-track">
            <div 
              className="metric-bar-fill" 
              style={{ 
                width: `${data.cpu_percent}%`,
                backgroundColor: getUsageColor(data.cpu_percent)
              }}
            ></div>
          </div>
          <span className="metric-value">{data.cpu_percent}%</span>
        </div>

        <div className="metric-item">
          <div className="metric-label">
            <span className="metric-icon">🧠</span>
            RAM
          </div>
          <div className="metric-bar-track">
            <div 
              className="metric-bar-fill" 
              style={{ 
                width: `${data.ram_percent}%`,
                backgroundColor: getUsageColor(data.ram_percent)
              }}
            ></div>
          </div>
          <span className="metric-value">{data.ram_percent}% ({data.ram_used_mb} / {data.ram_total_mb} MB)</span>
        </div>

        <div className="metric-item">
          <div className="metric-label">
            <span className="metric-icon">💾</span>
            Disk
          </div>
          <div className="metric-bar-track">
            <div 
              className="metric-bar-fill" 
              style={{ 
                width: `${data.disk_percent}%`,
                backgroundColor: getUsageColor(data.disk_percent)
              }}
            ></div>
          </div>
          <span className="metric-value">{data.disk_percent}% ({data.disk_used_gb} / {data.disk_total_gb} GB)</span>
        </div>
      </div>

      {/* Docker Section */}
      <div className="docker-section">
        <div className="docker-header">
          <span className="docker-title">🐳 Docker Containers</span>
          <span className={`docker-status ${data.docker_status === 'connected' ? 'connected' : 'disconnected'}`}>
            {data.docker_status === 'connected' ? '● Connected' : '○ ' + data.docker_status}
          </span>
        </div>
        
        {data.containers.length > 0 ? (
          <div className="container-list">
            {data.containers.map((container, index) => (
              <div key={index} className="container-row">
                <span className={`container-status-dot ${container.status === 'running' ? 'running' : 'stopped'}`}></span>
                <span className="container-name">{container.name}</span>
                <span className="container-image">{container.image}</span>
                <span className={`container-badge ${container.status}`}>{container.status}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-containers">
            {data.docker_status === 'connected' 
              ? 'Không có container nào đang chạy'
              : 'Không thể kết nối Docker daemon'}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusCard;
