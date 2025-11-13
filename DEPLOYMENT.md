# Deployment Guide

This guide covers deploying the NinjaRMM → Monday.com sync automation to various serverless platforms.

## Prerequisites

1. Node.js 18.x or higher installed
2. AWS/Azure account (depending on platform)
3. API credentials configured in `.env` file

## Option 1: AWS Lambda (Recommended)

### Setup

1. **Install Serverless Framework**
   ```bash
   npm install -g serverless
   npm install --save-dev serverless-offline
   ```

2. **Configure AWS Credentials**
   ```bash
   serverless config credentials --provider aws --key YOUR_AWS_KEY --secret YOUR_AWS_SECRET
   ```

3. **Store Secrets in AWS Systems Manager Parameter Store**
   ```bash
   aws ssm put-parameter --name /ninjamonday/ninja_client_id --value "your_client_id" --type SecureString
   aws ssm put-parameter --name /ninjamonday/ninja_client_secret --value "your_client_secret" --type SecureString
   aws ssm put-parameter --name /ninjamonday/monday_api_token --value "your_token" --type SecureString
   aws ssm put-parameter --name /ninjamonday/monday_kiosks_board_id --value "9594374343" --type String
   aws ssm put-parameter --name /ninjamonday/monday_tickets_board_id --value "18246434123" --type String
   ```

4. **Deploy**
   ```bash
   serverless deploy
   ```

5. **Test Deployment**
   ```bash
   serverless invoke -f sync
   ```

### Scheduled Execution

The `serverless.yml` file is configured to run:
- **Full Sync**: Daily at 9 AM UTC (4 AM EST)
- **Update Sync**: Every 6 hours

### Manual Trigger via API

After deployment, you'll get an API endpoint:
```bash
curl -X POST https://your-api-gateway-url/sync
```

### View Logs

```bash
serverless logs -f sync -t
```

### Remove Deployment

```bash
serverless remove
```

## Option 2: Azure Functions

### Setup

1. **Install Azure Functions Core Tools**
   ```bash
   npm install -g azure-functions-core-tools@4
   ```

2. **Create Function App**
   ```bash
   func init --worker-runtime node --language javascript
   func new --template "Timer trigger" --name sync
   ```

3. **Configure Application Settings**
   In Azure Portal → Function App → Configuration:
   - `NINJA_CLIENT_ID`
   - `NINJA_CLIENT_SECRET`
   - `MONDAY_API_TOKEN`
   - `MONDAY_KIOSKS_BOARD_ID`
   - `MONDAY_TICKETS_BOARD_ID`

4. **Deploy**
   ```bash
   func azure functionapp publish YOUR_FUNCTION_APP_NAME
   ```

## Option 3: Docker Container (Any Platform)

### Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "src/sync.js"]
```

### Build and Run

```bash
docker build -t ninjamonday-sync .
docker run --env-file .env ninjamonday-sync
```

### Deploy to Cloud Run (Google Cloud)

```bash
gcloud run deploy ninjamonday-sync \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Option 4: Windows Task Scheduler (Local)

### Setup

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 9:00 AM
4. Action: Start a program
   - Program: `node`
   - Arguments: `C:\NinjaMonday\src\sync.js`
   - Start in: `C:\NinjaMonday`

### For Update Sync

Create another task:
- Trigger: Every 6 hours
- Action: `node C:\NinjaMonday\src\sync-update.js`

## Environment Variables

Required environment variables for all platforms:

```
NINJA_CLIENT_ID=your_client_id
NINJA_CLIENT_SECRET=your_client_secret
MONDAY_API_TOKEN=your_token
MONDAY_KIOSKS_BOARD_ID=9594374343
MONDAY_TICKETS_BOARD_ID=18246434123
```

## Monitoring

### AWS Lambda

View CloudWatch Logs:
```bash
aws logs tail /aws/lambda/ninjamonday-sync-dev-sync --follow
```

### Azure Functions

View logs in Azure Portal → Function App → Monitor

### Local/Container

Check application logs:
```bash
npm run sync 2>&1 | tee sync.log
```

## Cost Estimates

### AWS Lambda
- **Free Tier**: 1M requests/month, 400K GB-seconds compute
- **Estimated**: $0-5/month for daily syncs
- **Pricing**: https://aws.amazon.com/lambda/pricing/

### Azure Functions
- **Free Tier**: 1M executions/month
- **Estimated**: $0-5/month
- **Pricing**: https://azure.microsoft.com/pricing/details/functions/

### Google Cloud Run
- **Free Tier**: 2M requests/month
- **Estimated**: $0-3/month
- **Pricing**: https://cloud.google.com/run/pricing

## Troubleshooting

### Lambda Timeout
If sync takes > 5 minutes, increase timeout in `serverless.yml`:
```yaml
provider:
  timeout: 900  # 15 minutes
```

### Out of Memory
Increase memory in `serverless.yml`:
```yaml
provider:
  memorySize: 1024  # 1 GB
```

### Rate Limits
The scripts include retry logic and rate limiting. If you still hit limits:
- Increase `DELAY_BETWEEN_ITEMS` in config
- Add exponential backoff
- Run syncs less frequently

## Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use secret management** - AWS Secrets Manager, Azure Key Vault, etc.
3. **Restrict API permissions** - Use least-privilege IAM roles
4. **Enable CloudWatch/Application Insights** - Monitor for anomalies
5. **Rotate credentials regularly** - Update tokens every 90 days
