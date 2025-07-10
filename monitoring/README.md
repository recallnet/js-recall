# Monitoring Setup for JS Recall API

This directory contains the monitoring setup for the JS Recall API using Prometheus and Grafana.

## Overview

The monitoring stack includes:
- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization and dashboards
- **Express API Metrics** - Custom metrics from the API application

## Prerequisites

- Docker and Docker Compose installed
- JS Recall API running on port 3000
- The API must be accessible from Docker containers

## Quick Start

1. **Start the monitoring stack:**
   ```bash
   ./start-monitoring.sh
   ```

2. **Access the services:**
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3002 (admin/admin)

3. **Import the dashboard:**
   - Copy the content of `grafana-dashboard.json`
   - In Grafana, go to "+" → "Import" → paste the JSON

## Manual Setup

If you prefer to set up manually:

```bash
cd monitoring
docker-compose up -d
```

## Available Metrics

The API exposes the following custom metrics at `/api/metrics`:

### Database Metrics
- `db_query_duration_ms` - Database query execution time (histogram)
- `db_queries_total` - Total number of database queries (counter)

### Node.js Runtime Metrics
- `nodejs_heap_size_used_bytes` - Heap memory usage
- `nodejs_heap_size_total_bytes` - Total heap size
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles` - Active handles
- `nodejs_active_requests` - Active requests
- `nodejs_gc_duration_seconds_total` - Garbage collection duration

### Process Metrics
- `process_cpu_seconds_total` - CPU usage
- `process_resident_memory_bytes` - Memory usage
- `process_start_time_seconds` - Process start time

## Configuration

### Prometheus Configuration

The Prometheus configuration (`prometheus.yml`) includes:
- Scraping the API at `host.docker.internal:3000/api/metrics`
- 10-second scrape interval
- Self-monitoring of Prometheus

### Grafana Configuration

Default setup includes:
- Admin user: `admin/admin`
- Data persistence with Docker volumes
- Pre-configured for Prometheus data source

## Grafana Dashboard

The included dashboard (`grafana-dashboard.json`) provides:

1. **Overview Panels:**
   - API Request Rate
   - Database Query Duration (95th percentile)
   - Database Queries/sec
   - Memory Usage

2. **Time Series Graphs:**
   - Database Query Duration Over Time
   - Database Queries by Operation
   - Node.js Event Loop Lag
   - Heap Memory Usage
   - Active Handles & Requests
   - Process CPU Usage
   - Garbage Collection

3. **Success Rate Monitoring:**
   - Database Operations Success Rate

## Troubleshooting

### API Not Being Scraped

If Prometheus shows the API target as down:

1. **Check API is running:**
   ```bash
   curl http://localhost:3000/api/metrics
   ```

2. **Verify Docker network access:**
   ```bash
   docker exec js-recall-prometheus curl host.docker.internal:3000/api/metrics
   ```

3. **Check Prometheus targets:**
   - Go to http://localhost:9090/targets
   - Verify the `js-recall-api` target status

### Common Issues

1. **Port conflicts:**
   - Prometheus: Port 9090
   - Grafana: Port 3002
   - Modify `docker-compose.yml` to use different ports if needed

2. **Docker networking:**
   - Uses `host.docker.internal` to access host machine
   - On Linux, you might need to use `host.docker.internal:host-gateway` in extra_hosts

3. **Data persistence:**
   - Data is stored in Docker volumes
   - To reset: `docker-compose down -v`

## Customization

### Adding New Metrics

To add custom metrics to your API:

1. In your Express app, import prom-client:
   ```javascript
   import client from 'prom-client';
   ```

2. Create a new metric:
   ```javascript
   const customCounter = new client.Counter({
     name: 'custom_operations_total',
     help: 'Total number of custom operations',
     labelNames: ['operation_type']
   });
   ```

3. Use the metric in your code:
   ```javascript
   customCounter.inc({ operation_type: 'user_login' });
   ```

### Modifying Dashboards

1. Edit the dashboard in Grafana UI
2. Export the updated JSON
3. Replace the content in `grafana-dashboard.json`

### Alerting

To add alerts:

1. Configure alerting rules in Prometheus
2. Set up alert receivers (email, Slack, etc.)
3. Create alert rules in `prometheus.yml`

## Stopping the Stack

```bash
docker-compose down
```

To remove all data:
```bash
docker-compose down -v
```

## Production Considerations

For production deployment:

1. **Security:**
   - Change default Grafana password
   - Use proper authentication
   - Configure HTTPS

2. **Persistence:**
   - Use external volumes or databases
   - Regular backups of metrics data

3. **Scalability:**
   - Consider Prometheus federation
   - Use remote storage for long-term retention

4. **Monitoring:**
   - Monitor the monitoring stack itself
   - Set up alerts for critical metrics

## Useful Queries

### Database Performance
```promql
# Average query duration by operation
rate(db_query_duration_ms_sum[5m]) / rate(db_query_duration_ms_count[5m])

# Slow queries (>100ms)
histogram_quantile(0.95, rate(db_query_duration_ms_bucket[5m])) > 100
```

### API Performance
```promql
# Request rate
rate(nodejs_http_requests_total[5m])

# Memory growth rate
rate(nodejs_heap_size_used_bytes[5m])
```

### System Health
```promql
# High CPU usage
rate(process_cpu_seconds_total[5m]) * 100 > 80

# High memory usage
process_resident_memory_bytes > 1000000000
```
