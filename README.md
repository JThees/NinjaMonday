# NinjaRMM → Monday.com Sync Automation

Automated ticket synchronization from NinjaRMM to Monday.com for Indiana Legal Help's kiosk management system.

## 🎯 Purpose

Eliminate manual double data entry by automatically syncing ticket information from NinjaRMM (device management) to Monday.com (project tracking) for 92 county kiosks across Indiana. Enables trend analysis dashboards showing problem patterns and repeat offender kiosks.

## ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
cp .env.example .env
# Edit .env with your API credentials

# 3. Test connection
npm run sync:dry-run

# 4. Test with 3 items
npm run sync:test

# 5. Run full sync
npm run sync
```

## 📦 What's Included

- ✅ **Full sync** - Create new Monday items from NinjaRMM tickets
- ✅ **Update sync** - Update existing Monday items with latest data
- ✅ **Health status automation** - Auto-update kiosk health based on ticket status
- ✅ **Combined workflow** - Run ticket sync + health update in one command
- ✅ **Dry run mode** - Preview changes without modifying data
- ✅ **Auto tag creation** - Automatically creates Monday.com tags
- ✅ **Smart enrichment** - Enriches data from ILH Kiosks board
- ✅ **Configuration tool** - Manage field mappings without code
- ✅ **Serverless ready** - Deploy to AWS Lambda, Azure, or GCP
- ✅ **Error handling** - Retry logic and rate limiting

## 📊 Current Status

- **52 tickets synced** (July 2025 - November 2025)
- **147 kiosks** health status automated
- **6 tags auto-created**
- **100% success rate**
- **Service Call field** integrated and working
- **Health status automation** operational

## 🚀 Available Commands

```bash
npm run sync:all          # Sync tickets + update health (RECOMMENDED)
npm run sync              # Sync new tickets to Monday.com
npm run sync:update       # Update existing Monday items
npm run health:update     # Update kiosk health statuses only
npm run sync:dry-run      # Preview without changes
npm run sync:test         # Test with 3 items only
npm run config            # View/manage configuration
```

## 📚 Documentation

- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Commands & common tasks
- **[CLAUDE.md](CLAUDE.md)** - Complete project documentation
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Serverless deployment guide
- **[PROJECT-SUMMARY.md](PROJECT-SUMMARY.md)** - Detailed overview

## 🔧 Configuration

View and manage field mappings:

```bash
npm run config                                    # View settings
npm run config add-status "New" "Working on it"   # Add status mapping
npm run config update-date 2025-06-01T00:00:00Z   # Update sync date
```

Configuration stored in `config/field-mappings.json`

## 🌐 Serverless Deployment

### AWS Lambda (Recommended)

```bash
# Install Serverless Framework
npm install -g serverless

# Deploy
serverless deploy

# View logs
serverless logs -f sync -t
```

**Automatic Schedules:**
- Daily sync at 9 AM UTC (4 AM EST)
- Update sync every 6 hours

See [DEPLOYMENT.md](DEPLOYMENT.md) for full guide.

## 📋 Data Mapping

| NinjaRMM | Monday.com |
|----------|------------|
| Ticket ID | Ninja Ticket ID |
| Device (IBF-0136058) | Kiosk (6058) |
| Creation Date | Date |
| Tags | Core Issue |
| Status | Status (mapped) |
| Location | Location |
| Attribute: County | County |
| Attribute: Service (checkbox) | Service call (Yes/No) |

### Ticket Status Mappings (NinjaRMM → Monday Tickets)

| NinjaRMM | Monday.com |
|----------|------------|
| Closed | Done |
| Waiting | Stuck |
| Supplies Ordered | Done |
| Pending Vendor | Working on it |
| Paused | Working BUT |
| Impending User Action | Working on it |

### Health Status Automation (Monday Tickets → ILH Kiosks)

Kiosk health status is automatically updated based on the most recent ticket for each kiosk:

| Ticket Status | Kiosk Health Status |
|--------------|---------------------|
| Done | HEALTHY |
| Working on it | NEEDS_ATTENTION |
| Working BUT | NEEDS_ATTENTION |
| Stuck | NEEDS_ATTENTION |
| *(no tickets)* | HEALTHY |

**Logic:** Most recent ticket (by date) determines the kiosk's health status.

## 🛟 Troubleshooting

**Rate Limit Errors (429)**
```bash
# Wait 60 seconds, then retry
npm run sync
```

**Missing Data**
- Check if kiosk exists in ILH Kiosks board
- Verify device field in NinjaRMM ticket

**Duplicates**
- Script checks Ninja Ticket ID to avoid duplicates
- Items numbered consecutively (22, 23, 24...)

## 🔑 Environment Variables

Required in `.env` file:

```env
NINJA_CLIENT_ID=your_client_id
NINJA_CLIENT_SECRET=your_client_secret
MONDAY_API_TOKEN=your_api_token
MONDAY_KIOSKS_BOARD_ID=9594374343
MONDAY_TICKETS_BOARD_ID=18246434123
```

See `.env.example` for template.

## 🏗️ Project Structure

```
├── src/
│   ├── sync.js                 # Full sync
│   ├── sync-update.js          # Update existing items
│   ├── config-tool.js          # Configuration manager
│   └── lambda/                 # Serverless handlers
├── config/
│   └── field-mappings.json     # Configuration
├── .env                        # Credentials (not committed)
├── serverless.yml              # AWS Lambda config
└── package.json                # Dependencies
```

## 🎯 Features

### Smart Sync
- **Duplicate Detection** - Uses Ninja Ticket ID as primary key
- **Date Filtering** - Only syncs tickets from July 1, 2025+
- **Consecutive Numbering** - Items named as integers (22, 23, 24...)
- **Rate Limiting** - Built-in delays and retry logic

### Data Enrichment
- **Kiosk Lookup** - Enriches county/location from ILH Kiosks board
- **County Fallback** - Uses NinjaRMM attributes if kiosk not found
- **Auto Tag Creation** - Creates Monday tags via API

### Configuration
- **JSON-based** - All mappings in `config/field-mappings.json`
- **CLI Tool** - Manage config via `npm run config`
- **No Code Changes** - Update mappings without editing code

## 📈 Success Metrics

After running sync:

```
Total tickets processed: 39
✅ Created:              37
⏭️ Skipped (duplicate):   2
❌ Errors:                0
⚠️ Warnings:              5
```

## 🔒 Security

- API credentials in `.env` (git-ignored)
- Supports AWS Secrets Manager
- Rate limiting prevents API abuse
- Detailed logging for audit trail

## 🤝 Contributing

This is a custom automation for Indiana Legal Help's internal use.

## 📄 License

ISC

## 👤 Author

Built for Indiana Legal Help kiosk management.

## 🙏 Acknowledgments

- NinjaRMM API: https://app.ninjarmm.com/apidocs
- Monday.com API: https://developer.monday.com
- Serverless Framework: https://serverless.com

---

**Need Help?** Check [QUICK-REFERENCE.md](QUICK-REFERENCE.md) for common commands and troubleshooting.
