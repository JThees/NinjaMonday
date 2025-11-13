# Quick Reference Guide

## 📋 Common Commands

### Daily Operations
```bash
# Sync new tickets
npm run sync

# Update existing tickets with changes
npm run sync:update

# Preview what will sync (no changes)
npm run sync:dry-run
```

### Configuration
```bash
# View all settings
npm run config

# Add status mapping
npm run config add-status "In Progress" "Working on it"

# Update sync start date
npm run config update-date 2025-06-01T00:00:00Z
```

### Testing
```bash
# Test with 3 items only
npm run sync:test

# View sync statistics
cat sync-preview.json
```

## 🔧 Configuration File

Edit `config/field-mappings.json` or use `npm run config`

## 📊 Current Setup

- **Start Date**: July 1, 2025
- **Synced**: 50 tickets (Items #1-#50)
- **Board IDs**:
  - Kiosks: 9594374343
  - Tickets: 18246434123

## 🚀 Serverless Deployment

### AWS Lambda
```bash
# Deploy
serverless deploy

# View logs
serverless logs -f sync -t

# Manual trigger
serverless invoke -f sync

# Remove
serverless remove
```

### Schedules
- **Sync**: Daily at 9 AM UTC (4 AM EST)
- **Update**: Every 6 hours

## 🔑 Environment Variables

Required in `.env`:
```
NINJA_CLIENT_ID=***
NINJA_CLIENT_SECRET=***
MONDAY_API_TOKEN=***
MONDAY_KIOSKS_BOARD_ID=9594374343
MONDAY_TICKETS_BOARD_ID=18246434123
```

## 📈 Status Mappings

| NinjaRMM | Monday.com |
|----------|------------|
| Closed | Done |
| Waiting | Stuck |
| Supplies Ordered | Done |
| Pending Vendor | Working on it |
| Paused | Working BUT |
| Impending User Action | Working on it |

Add more: `npm run config add-status "New" "Working on it"`

## 🏷️ Auto-Created Tags

Current: Printer, Supplies, HTI, Desktop, Networking, Windows

Tags auto-create when found in NinjaRMM tickets.

## 🔍 Field Mappings

| NinjaRMM | Monday.com |
|----------|------------|
| Ticket ID | Ninja Ticket ID (text_mkxn628j) |
| Device (IBF-0136058) | Kiosk (text_mkx0wqmq) = 6058 |
| createTime | Date (date4) |
| tags | Core issue (tag_mkwzqtky) |
| status | Status (status) |
| location | Location (text_mkwzt5ce) |
| attribute[10] | County (text_mkwzhc6k) |
| attribute[80] | Service call (dropdown_mkwznn43) |

## 🛟 Troubleshooting

### Rate Limit Errors
```bash
# Wait 60 seconds, then retry
npm run sync
```

### View Recent Tickets
```bash
node src/list-synced-tickets.js
```

### Test Connection
```bash
npm run sync:dry-run
```

## 📞 Support Files

- **Full Docs**: `CLAUDE.md`
- **Deployment**: `DEPLOYMENT.md`
- **Summary**: `PROJECT-SUMMARY.md`
- **This File**: `QUICK-REFERENCE.md`

## ⚡ Emergency Recovery

### If sync fails completely
```bash
# 1. Check credentials
cat .env

# 2. Test with dry run
npm run sync:dry-run

# 3. Test with 3 items
npm run sync:test

# 4. Check logs for errors
```

### If duplicates created
Items are numbered consecutively. Monday detects duplicates by Ninja Ticket ID, so true duplicates shouldn't occur unless that field is empty.

### If wrong data synced
```bash
# 1. Fix data in NinjaRMM
# 2. Run update sync
npm run sync:update
```

## 🔄 Typical Workflow

**Weekly**:
1. Run `npm run sync` to create new tickets
2. Check Monday.com to verify
3. Run `npm run sync:update` to refresh existing data

**Monthly**:
1. Review sync logs
2. Update status mappings if needed
3. Clean up any bad data in NinjaRMM

**Quarterly**:
1. Review configuration (`npm run config`)
2. Update date filter if needed
3. Rotate API credentials

## 🎯 Best Practices

1. **Always test first**: Use `npm run sync:test` before full sync
2. **Check dry run**: Use `npm run sync:dry-run` to preview
3. **Monitor logs**: Check for warnings about missing data
4. **Clean NinjaRMM data**: Fix missing device/kiosk fields
5. **Use serverless**: Set up AWS Lambda for automatic syncs
6. **Version control**: Commit changes to field mappings

## 📞 Quick Stats

Run any script to see:
- ✅ Items created
- ⏭️ Items skipped (duplicates)
- ❌ Errors
- ⚠️ Warnings

Example output:
```
Total tickets processed: 39
✅ Created:              37
⏭️  Skipped (duplicate): 2
❌ Errors:               0
⚠️  Warnings:            5
```
