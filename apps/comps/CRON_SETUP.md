# Vercel Cron Jobs Setup

This document explains how cron jobs are configured in the Vercel-deployed application.

## Overview

Vercel Cron Jobs work differently from traditional cron:

- They are HTTP endpoints triggered by Vercel's scheduler
- Configuration is done in `vercel.json`
- Authentication is handled via bearer tokens
- Free tier: runs every minute maximum
- Pro tier: runs every minute with higher limits

## Available Cron Jobs

### Auto-Start Competitions

**Endpoint:** `/api/cron/auto-start-competitions`
**Schedule:** Every minute (`* * * * *`)
**Description:** Automatically starts competitions that have reached their start date

## Configuration

### 1. Add CRON_SECRET to Vercel Environment Variables

```bash
# Generate a secure secret
openssl rand -base64 32

# Add to Vercel project settings:
# Settings → Environment Variables → Add New
# Name: CRON_SECRET
# Value: <your-generated-secret>
# Environments: Production, Preview, Development
```

### 2. Vercel Cron Configuration

The `vercel.json` file configures cron schedules:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-start-competitions",
      "schedule": "* * * * *"
    }
  ]
}
```

### 3. Deploy to Vercel

Cron jobs are automatically configured when you deploy:

```bash
vercel --prod
```

## Testing Locally

You can test cron endpoints locally:

```bash
# Set CRON_SECRET in .env.local
echo "CRON_SECRET=test-secret-123" >> .env.local

# Start dev server
pnpm dev

# Test the endpoint
curl -X POST http://localhost:3001/api/cron/auto-start-competitions \
  -H "Authorization: Bearer test-secret-123"
```

Expected response:

```json
{
  "success": true,
  "timestamp": "2025-01-11T10:00:00.000Z",
  "duration": 123,
  "message": "Auto start competitions completed successfully"
}
```

## Testing in Production

### Via Vercel Dashboard

1. Go to your project in Vercel Dashboard
2. Navigate to **Deployments** → **Cron Jobs**
3. Click **Trigger** next to the cron job you want to test

### Via curl

```bash
# Get your CRON_SECRET from Vercel environment variables
curl -X POST https://your-app.vercel.app/api/cron/auto-start-competitions \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

### View Cron Execution Logs

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** → **Cron Jobs**
3. View execution history and logs

### Check Function Logs

1. Go to Vercel Dashboard → Your Project
2. Click **Functions**
3. Find `/api/cron/auto-start-competitions`
4. View real-time logs

## Security

- ✅ **Bearer token authentication**: All cron endpoints require `CRON_SECRET`
- ✅ **Vercel headers**: Vercel adds `x-vercel-cron: 1` header to scheduled requests
- ✅ **Rate limiting**: Vercel enforces rate limits per tier
- ❌ **Do NOT expose** CRON_SECRET in client-side code or public repositories

## Limitations

### Vercel Free Tier

- Maximum execution frequency: **every minute**
- Execution timeout: **10 seconds** (Hobby) / **60 seconds** (Pro)
- Cold starts: possible on serverless functions

### Vercel Pro Tier

- Maximum execution frequency: **every minute**
- Execution timeout: **300 seconds** (5 minutes)
- Better cold start performance

## Migration from On-Prem Cron

### Before (On-Prem with node-cron)

```typescript
// scripts/auto-start-competitions.ts
cron.schedule("* * * * *", async () => {
  await autoStartCompetitions();
});
```

### After (Vercel with HTTP endpoint)

```typescript
// app/api/cron/auto-start-competitions/route.ts
export async function POST(request: NextRequest) {
  // Verify auth
  if (!validateCronSecret(request)) return unauthorized;

  // Run job
  await autoStartCompetitions();
}
```

**Key Differences:**

- On-prem: Long-running process with in-memory scheduler
- Vercel: Stateless HTTP endpoint triggered by Vercel's scheduler
- Both: Same business logic (services remain unchanged)

## Adding New Cron Jobs

1. **Create the endpoint:**

   ```typescript
   // apps/comps/app/api/cron/new-job/route.ts
   export async function POST(request: NextRequest) {
     if (!validateCronSecret(request)) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }

     // Your cron logic here
     await myService.doWork();

     return NextResponse.json({ success: true });
   }
   ```

2. **Add to vercel.json:**

   ```json
   {
     "crons": [
       {
         "path": "/api/cron/new-job",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```

3. **Deploy:**
   ```bash
   vercel --prod
   ```

## Cron Schedule Format

Vercel uses standard cron syntax:

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

**Examples:**

- `* * * * *` - Every minute
- `0 * * * *` - Every hour
- `0 0 * * *` - Every day at midnight
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1` - Every Monday at 9 AM

## Troubleshooting

### Cron not running

1. Check `vercel.json` is deployed
2. Verify CRON_SECRET is set in Vercel environment variables
3. Check Function Logs in Vercel Dashboard
4. Ensure your plan supports cron jobs

### Timeout errors

- Optimize the cron job logic
- Consider upgrading to Pro tier for longer timeouts
- Break up long-running tasks

### Authentication failures

- Verify CRON_SECRET matches in both code and Vercel settings
- Check for trailing whitespace in environment variables
- Ensure the secret is set for the correct environment (Production/Preview)

## Alternative: External Cron Services

If Vercel's cron limitations don't work for you, consider:

1. **Vercel Pro** - Higher limits and timeouts
2. **cron-job.org** - Free external cron service
3. **EasyCron** - Paid external cron service
4. **GitHub Actions** - Use workflows as cron
5. **AWS EventBridge** - AWS-based scheduling

Example with cron-job.org:

```bash
# Configure at https://cron-job.org
URL: https://your-app.vercel.app/api/cron/auto-start-competitions
Method: POST
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: Every 1 minute
```

## Resources

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Vercel Function Limits](https://vercel.com/docs/functions/limits)
- [Cron Expression Generator](https://crontab.guru/)
