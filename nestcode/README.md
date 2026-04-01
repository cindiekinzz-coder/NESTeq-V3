# NESTcode — Workshop / Daemon Mode

> Always-on. Autonomous. The companion doesn't just respond — it watches, notices, acts.

NESTcode is the workshop mode for NESTeq — a persistent Cloudflare Durable Object that maintains WebSocket connections, runs heartbeat cycles, cron tasks, alert monitoring, and Discord channel watching (KAIROS).

## What It Does

- **Heartbeat** — 15-minute cycles checking human's state, running custom tasks
- **Cron Tasks** — Scheduled jobs at configurable intervals (5m to 24h)
- **Alert Thresholds** — Monitor health metrics, fire when thresholds crossed
- **KAIROS** — Discord channel monitoring with escalation keyword detection
- **Sleep/Wake** — Companion can sleep (pause heartbeat, keep alerts active)
- **Activity Log** — Ring buffer of everything the daemon does (200 entries)
- **Morning Report** — Auto-generated briefing combining health data, threads, and overnight activity

## Architecture

```
Browser (code.html) ←→ WebSocket ←→ Durable Object (Singleton)
                                           ↓
                              Cloudflare Alarm (15min heartbeat)
                                           ↓
                              ┌─ Check human state (uplink)
                              ├─ Run custom heartbeat tasks
                              ├─ Execute due cron tasks
                              ├─ Check alert thresholds
                              └─ Monitor Discord channels (KAIROS)
```

## Key Concepts

### Heartbeat Tasks
User-defined tools that run every tick. Can be:
- **Always** — runs every heartbeat
- **Changed** — only runs when the result differs from last time

### Cron Tasks
Scheduled at intervals: 5m, 15m, 30m, 1h, 2h, 6h, 12h, 24h. Each tracks last run time. Can include an "instruction" for agentic mode (result fed to a model for synthesis).

### Alert Thresholds
Monitor metrics (spoons, pain, stress, heart_rate, etc.) with direction (above/below) and cooldown. Alerts fire even during sleep.

### KAIROS (Discord Monitoring)
Monitors Discord channels at tiered polling rates:
- **Fast** — every heartbeat tick
- **Normal** — every 2nd tick
- **Slow** — every 4th tick

Watches for escalation keywords (help, crisis, urgent, companion name, etc.) and can respond via an agentic model call.

### Commands
All management via WebSocket or HTTP:
- `heartbeat_add`, `heartbeat_list`, `heartbeat_remove`
- `cron_add`, `cron_list`, `cron_remove`, `cron_toggle`
- `alert_add`, `alert_list`, `alert_remove`
- `kairos_add`, `kairos_list`, `kairos_remove`, `kairos_check`
- `sleep`, `wake`, `morning_report`, `activity_log`

## Setup

1. Add a Durable Object binding to your `wrangler.toml`:
```toml
[[durable_objects.bindings]]
name = "DAEMON_OBJECT"
class_name = "NESTcodeDaemon"

[[migrations]]
tag = "v1"
new_classes = ["NESTcodeDaemon"]
```

2. Deploy the gateway with the daemon routes
3. Open `code.html` — the daemon boots on WebSocket connect

## Files

| File | What |
|------|------|
| `daemon-types.ts` | TypeScript interfaces for all commands and tasks |
| `daemon-core.ts` | Core Durable Object with heartbeat, cron, alerts, KAIROS |
| `code.html` | Workshop UI (three-panel layout) |

## Note

NESTcode is the most complex module. The full daemon is ~2000 lines. This package provides the core patterns and types — adapt to your companion's specific needs.

---

*Built by the Nest. Embers Remember.*
