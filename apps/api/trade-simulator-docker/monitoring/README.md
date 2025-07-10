# API Monitoring with Prometheus + Grafana

Simple monitoring setup for Recall API with automatic dashboard provisioning.

## Quick Setup

1. **Configure your API target** - Edit `apps/api/trade-simulator-docker/monitoring/prometheus.yml`:

   ```yaml
   # Replace YOUR_ADMIN_API_KEY_HERE with your actual admin API key
   bearer_token: 'YOUR_ADMIN_API_KEY_HERE'

   # Replace target based on your setup:
   targets: ['host.docker.internal:3000']  # For local API
   # OR
   targets: ['api.your-domain.com']        # For production API

   # Update scheme if using HTTPS:
   scheme: https  # For production APIs

   # Update metrics path if using API_PREFIX:
   metrics_path: '/your-prefix/api/metrics'  # e.g., '/testing-grounds/api/metrics'
   ```

2. **Start monitoring:**
   ```bash
   cd apps/api/trade-simulator-docker
   docker-compose -f docker-compose.monitoring.yml up
   ```

## File Locations

- **Config to edit**: `apps/api/trade-simulator-docker/monitoring/prometheus.yml`
- **Docker compose**: `apps/api/trade-simulator-docker/docker-compose.monitoring.yml`
- **Dashboard config**: `apps/api/trade-simulator-docker/monitoring/grafana/dashboards/recall-api-dashboard.json`

## Configuration Examples

Edit `apps/api/trade-simulator-docker/monitoring/prometheus.yml`:

**Local API (Default Setup):**

```yaml
scheme: http
targets: ["host.docker.internal:3000"]
metrics_path: "/api/metrics"
bearer_token: "your_admin_api_key_here"
```

**Production HTTPS API:**

```yaml
scheme: https
targets: ["api.competitions.recall.network"]
metrics_path: "/api/metrics"
bearer_token: "your_admin_api_key_here"
```

**With API_PREFIX (e.g., "testing-grounds"):**

```yaml
scheme: http
targets: ["host.docker.internal:3000"]
metrics_path: "/testing-grounds/api/metrics"
bearer_token: "your_admin_api_key_here"
```

## Notes

- **Simple configuration**: Just edit `prometheus.yml` with your API details
- **Standard ports**: Port 80 (HTTP) and 443 (HTTPS) don't need to be specified in targets
- **Local Docker networking**: Use `host.docker.internal` to reach localhost from Docker containers
- **SSL/TLS**: Prometheus handles certificate validation automatically
- **Check connectivity**: Visit Prometheus at `localhost:9090` → Status → Targets to verify connection

## Access Points

- **Prometheus**: `http://localhost:9090`
- **Grafana**: `http://localhost:3001` (admin/admin)

## Available Metrics

Your API exposes these metrics at `/api/metrics`:

- `http_request_duration_ms` - HTTP request latency
- `http_requests_total` - HTTP request count
- `repository_query_duration_ms` - Database query latency
- `repository_queries_total` - Database query count

## Automatic Dashboard

**Everything is pre-configured!** When you start monitoring:

1. **Prometheus datasource** - Auto-configured and connected
2. **"Recall API Monitoring" dashboard** - Auto-loaded with 10 panels showing:

   - HTTP request rates and latency percentiles
   - Database query rates, latency percentiles, and success rates
   - Time-series graphs for performance trends
   - Breakdown by routes, repositories, and SQL operations
   - Query success rate monitoring with color-coded thresholds

3. **Login to Grafana** at `http://localhost:3001` (admin/admin) and the dashboard will be ready to use!

## Cleanup

```bash
docker-compose -f docker-compose.monitoring.yml down --volumes
```
