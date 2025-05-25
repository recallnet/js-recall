# Multi-Chain Trading Simulator Deployment Guide

This document provides instructions for deploying the Multi-Chain Trading Simulator using Docker and Docker Compose on DigitalOcean or similar cloud environments.

## Docker Deployment Quick Reference

This project uses Docker and Docker Compose for simplified deployment. Here's what you need to know:

### Files Created for Docker Deployment

- **`Dockerfile`**: Multi-stage build process for the Node.js application
- **`docker-compose.yml`**: Defines app and database services with proper networking
- **`deploy-setup.sh`**: Script for initial deployment and setup
- **`.dockerignore`**: Optimizes builds by excluding unnecessary files

### Quick Start Deployment

To deploy the Multi-Chain Trading Simulator:

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/trading-simulator.git
   cd trading-simulator
   ```

2. Create a `.env.production` file with your desired configuration:

   ```bash
   cp .env.example .env.production
   # Edit .env.production with your specific settings
   ```

3. Run the deployment script:

   ```bash
   ./trade-simulator-docker/deploy-setup.sh
   ```

   This script will:

   - Build Docker images
   - Create the `.env` file from `.env.production` if it doesn't exist
   - Set up Docker volumes
   - Start all services with Docker Compose

4. After deployment is complete, set up an admin account via API:

   ```bash
   curl -X POST http://localhost:3000/api/admin/setup \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"your-secure-password","email":"admin@example.com"}'
   ```

   Sample response:

   ```json
   {
     "success": true,
     "message": "Admin account created successfully",
     "apiKey": "sk_live_xxxxxxxxxxxxxxxxxxxxx"
   }
   ```

   **IMPORTANT:** Save the returned API key securely - it won't be shown again.

   Note: This admin setup will also initialize the `ROOT_ENCRYPTION_KEY` in the mounted `.env` file if it doesn't exist.

Your application should now be running at `http://localhost:3000`!

## What's Happening Behind the Scenes

- The application runs in a Docker container with necessary dependencies
- PostgreSQL database runs in a separate container
- Environment variables are loaded from the mounted `.env` file
- Only Docker-specific variables like `DB_HOST` are overridden in the compose file
- The API, database, and file storage are all persisted using Docker volumes
- Nginx handles TLS termination and proxies requests to the application

### Docker Architecture Benefits

- **Service Isolation**: Application and database run in separate containers
- **Simplified Configuration**: Environment variables managed through Docker Compose
- **Production Optimized**: Multi-stage build reduces image size and improves security
- **Data Persistence**: PostgreSQL data persisted in Docker volumes
- **Easy Updates**: Simple rebuild and restart process for updates
- **Configuration Persistence**: The .env file is mounted into the container for read/write access

Now let's dive into the detailed deployment process...

## Deployment Architecture

The deployment uses a Docker Compose setup with two main services:

1. **Application container** (`app`): Node.js application running the trading simulator
2. **Database container** (`db`): PostgreSQL database for storing application data

This architecture provides:

- Isolation between services
- Easy environment configuration
- Simplified deployment and updates
- Data persistence through Docker volumes

## Prerequisites

- A DigitalOcean Droplet (or similar cloud VM) with:
  - At least 2GB RAM
  - 2 vCPUs
  - 50GB SSD storage
- Docker and Docker Compose installed
- Git installed (for cloning the repository)
- Basic knowledge of Linux command line

## Deployment Steps

### 1. Prepare Your Server

1. Create a DigitalOcean Droplet:

   - Select Ubuntu 22.04 LTS
   - Choose a plan with at least 2GB RAM
   - Select your preferred region
   - Add your SSH key for secure access

2. Connect to your Droplet:

   ```bash
   ssh root@your-droplet-ip
   ```

3. Install Docker and Docker Compose:

   ```bash
   # Update package index
   apt update

   # Install required packages
   apt install -y apt-transport-https ca-certificates curl software-properties-common

   # Add Docker's official GPG key
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

   # Add Docker repository
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

   # Install Docker Engine
   apt update
   apt install -y docker-ce docker-ce-cli containerd.io

   # Install Docker Compose
   apt install -y docker-compose-plugin
   ln -s /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
   ```

4. Create a new user for running the application:

   ```bash
   # Create a new user
   adduser tradingsim

   # Add user to docker group
   usermod -aG docker tradingsim

   # Switch to the new user
   su - tradingsim
   ```

### 2. Deploy the Application

1. Create `.env.production` file:

   ```bash
   # Copy the example file
   cp .env.example .env.production

   # Edit the file to set your configuration
   nano .env.production
   ```

2. Run the deployment script:

   ```bash
   # Make the script executable
   chmod +x trade-simulator-docker/deploy-setup.sh

   # Run the script
   ./trade-simulator-docker/deploy-setup.sh
   ```

This script will:

- Check if Docker and Docker Compose are installed
- Create a `.env` file from `.env.production` if needed
- Set appropriate permissions on the `.env` file so the application can modify it
- Build and start the containers
- Initialize the database
- Provide instructions for setting up an admin account via the API

### 3. Configure Firewall

Set up a firewall to secure your server while allowing access to the application:

```bash
# Allow SSH
ufw allow 22/tcp

# Allow the application port (default is 3000)
ufw allow 3000/tcp

# Enable the firewall
ufw enable
```

### 4. Set Up Domain and HTTPS (Optional)

For production use, you should configure a domain name and HTTPS:

1. Point your domain to your server's IP address using DNS settings

2. Install Nginx as a reverse proxy:

   ```bash
   apt install -y nginx
   ```

3. Create an Nginx configuration for your domain:

   ```bash
   nano /etc/nginx/sites-available/trading-simulator
   ```

4. Add the following configuration:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

5. Enable the site and restart Nginx:

   ```bash
   ln -s /etc/nginx/sites-available/trading-simulator /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

6. Set up HTTPS with Certbot:
   ```bash
   apt install -y certbot python3-certbot-nginx
   certbot --nginx -d your-domain.com
   ```

## Managing Your Deployment

### View Logs

```bash
# View application logs
docker-compose -f trade-simulator-docker/docker-compose.yml logs app

# View database logs
docker-compose -f trade-simulator-docker/docker-compose.yml logs db

# Follow logs in real-time
docker-compose -f trade-simulator-docker/docker-compose.yml logs -f
```

### Start/Stop Services

```bash
# Stop all services
docker-compose -f trade-simulator-docker/docker-compose.yml down

# Start all services
docker-compose -f trade-simulator-docker/docker-compose.yml up -d

# Restart a specific service
docker-compose -f trade-simulator-docker/docker-compose.yml restart app
```

### Update the Application

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose -f trade-simulator-docker/docker-compose.yml up -d --build
```

### Manage Teams and Competitions

You can manage teams and competitions either through CLI scripts or direct API calls:

#### Using CLI Scripts (Legacy Method)

```bash
# Register a new team
docker-compose -f trade-simulator-docker/docker-compose.yml exec app pnpm register:team

# List all teams
docker-compose -f trade-simulator-docker/docker-compose.yml exec app pnpm list:teams

# Setup a competition
docker-compose -f trade-simulator-docker/docker-compose.yml exec app pnpm setup:competition

# Check competition status
docker-compose -f trade-simulator-docker/docker-compose.yml exec app pnpm comp:status
```

#### Using API Endpoints (Recommended)

For admin setup:

```bash
# Set up admin account
curl -X POST http://localhost:3000/api/admin/setup \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "admin",
    "password": "your-secure-password",
    "email": "admin@example.com"
  }'
# IMPORTANT: Save the API key from the response!
```

The response will include an admin API key like this:

```json
{
  "success": true,
  "message": "Admin account created successfully",
  "admin": {
    "id": "admin-uuid",
    "username": "admin",
    "email": "admin@example.com",
    "apiKey": "abc123def456_ghi789jkl012",
    "createdAt": "2023-07-25T15:30:45.123Z"
  }
}
```

This admin setup process also handles initializing the ROOT_ENCRYPTION_KEY in your mounted `.env` file if needed, ensuring proper encryption of all API keys.

For team registration (using admin API key):

```bash
# Register a team
curl -X POST http://localhost:3000/api/admin/teams/register \
  -H 'Authorization: Bearer YOUR_ADMIN_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "teamName": "Team Alpha",
    "email": "team@example.com",
    "contactPerson": "John Doe",
    "walletAddress": "0x1234567890123456789012345678901234567890"
  }'
# IMPORTANT: Save the team API key from the response!
```

For starting competitions:

```bash
# Start a competition
curl -X POST http://localhost:3000/api/admin/competition/start \
  -H 'Authorization: Bearer YOUR_ADMIN_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Trading Competition 2023",
    "description": "Annual trading competition",
    "teamIds": ["team-id-1", "team-id-2"]
  }'
```

## Database Backups

### Create a Backup

```bash
# Navigate to your project directory
cd /path/to/trade-sim

# Create a directory for backups if it doesn't exist
mkdir -p backups

# Export database to a file
docker-compose -f trade-simulator-docker/docker-compose.yml exec -T db pg_dump -U postgres trading_simulator > backups/backup-$(date +%Y%m%d-%H%M%S).sql
```

### Restore from Backup

```bash
# Stop the containers
docker-compose -f trade-simulator-docker/docker-compose.yml down

# Start only the database
docker-compose -f trade-simulator-docker/docker-compose.yml up -d db

# Wait for database to be ready
sleep 10

# Restore from a backup file
cat backups/your-backup-file.sql | docker-compose -f trade-simulator-docker/docker-compose.yml exec -T db psql -U postgres trading_simulator

# Start the rest of the services
docker-compose -f trade-simulator-docker/docker-compose.yml up -d
```

## Monitoring and Maintenance

### Check Container Status

```bash
docker-compose -f trade-simulator-docker/docker-compose.yml ps
```

### Check Resource Usage

```bash
docker stats
```

### Automatic Restart on System Reboot

Docker Compose includes `restart: unless-stopped` for both services, ensuring they restart automatically after system reboots.

## Environment Variables Management

The Docker setup handles environment variables in two complementary ways:

### Using .env File (Recommended)

The `deploy-setup.sh` script looks for a `.env.production` file and creates a `.env` file from it if needed. This is the recommended approach for production deployment.

The `.env` file serves two purposes in our setup:

1. It's loaded via Docker Compose's `env_file` directive to set container environment variables
2. It's mounted as a volume (`./.env:/app/.env`) so the application can read and modify it directly

Key environment variables to configure:

- **Database Configuration**:

  - `DATABASE_URL`: Connection string for PostgreSQL

- **Security Variables**:

  - `ROOT_ENCRYPTION_KEY`: Used for API key encryption (auto-generated by the application if empty)

- **Initial Token Balances**:

  - `INITIAL_SVM_SOL_BALANCE`, `INITIAL_ETH_ETH_BALANCE`, etc.

- **Chain Configuration**:
  - `EVM_CHAINS`: Comma-separated list of supported chains

### .env File Mounting

The `.env` file is mounted into the application container, allowing the application to read and write to it directly. This means:

- Application can automatically generate and update the `ROOT_ENCRYPTION_KEY` during setup
- Any changes made to the `.env` file by the application will persist after container restarts
- The deployment script sets appropriate permissions (`chmod 666`) on the `.env` file to make it writable

This approach respects the application's ability to manage its own configuration while providing persistence in a containerized environment.

### Docker Environment Variables

Only critical variables are overridden directly in the Docker Compose environment:

- `DB_HOST=db`: Ensures the application connects to the Docker database service
- `DB_SSL=false`: Disables SSL for internal Docker network communication

### Environment Variable Precedence

The system follows this order of precedence for environment variables:

1. Variables set directly in the Docker Compose `environment` section (overrides)
2. Variables from the `.env` file (loaded via `env_file`)
3. Default values specified in the application

This approach ensures that configuration is centralized in the `.env` file while allowing Docker-specific overrides where necessary.

## Troubleshooting

### Application Not Starting

Check the logs:

```bash
docker-compose -f trade-simulator-docker/docker-compose.yml logs app
```

### Database Connection Issues

Verify database is running:

```bash
docker-compose -f trade-simulator-docker/docker-compose.yml ps db
```

Check database logs:

```bash
docker-compose -f trade-simulator-docker/docker-compose.yml logs db
```

### Container Memory Issues

If containers are being killed due to memory constraints, consider upgrading your Droplet or optimizing the application configuration.

## Security Considerations

1. **Environment Variables**: Never commit the `.env` file with credentials to version control.

2. **Database Security**: The database is not exposed outside the Docker network, providing an additional layer of security.

3. **Regular Updates**: Keep your system, Docker, and application dependencies updated to patch security vulnerabilities.

4. **API Key Management**: The application uses encrypted API keys. Make sure to use a strong ROOT_ENCRYPTION_KEY.

5. **Backups**: Regularly backup your database to prevent data loss.

## Scaling and Performance Tuning

As your trading simulator grows in usage, you may need to scale and optimize your deployment.

### Vertical Scaling

The simplest way to improve performance is to increase resources on your DigitalOcean Droplet:

1. Power off your Droplet
2. Upgrade to a larger plan with more CPU and RAM
3. Power on your Droplet

This approach is suitable for moderate increases in load.

### Horizontal Scaling with Docker Swarm or Kubernetes

For more advanced scaling needs, consider migrating to Docker Swarm or Kubernetes:

1. **Docker Swarm**:
   - Simpler to set up than Kubernetes
   - Use the same Docker Compose file with minimal changes
   - Deploy across multiple nodes for better resource utilization
2. **Kubernetes**:
   - More complex but offers powerful orchestration features
   - Better for very large deployments
   - Requires converting Docker Compose to Kubernetes manifests

### Database Performance Optimization

1. **PostgreSQL Tuning**:

   - Modify `shared_buffers`, `work_mem`, and other PostgreSQL parameters
   - Add these to a custom `postgresql.conf` mounted as a volume

2. **Connection Pooling**:
   - For high-traffic applications, add PgBouncer in front of PostgreSQL
   - Reduces connection overhead and improves performance

### Application Optimization

1. **Environment Variables**:

   - Adjust `MAX_CONCURRENT_REQUESTS` for optimal API performance
   - Tune `PORTFOLIO_SNAPSHOT_INTERVAL_MS` and `PRICE_CACHE_MS` based on usage patterns

2. **Node.js Performance**:

   - Set the `NODE_ENV=production` environment variable (already configured)
   - Consider adding more application replicas behind a load balancer for heavy usage

3. **Monitoring**:
   - Add Prometheus and Grafana for performance monitoring
   - Monitor container resource usage and PostgreSQL query performance

## Need Help?

If you encounter issues, check the application logs and refer to the application's documentation. For specific deployment problems, consult the Docker and Docker Compose documentation.
