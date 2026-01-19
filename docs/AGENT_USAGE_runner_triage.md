# Runner Triage Agent Usage Guide

## Overview

The Runner Triage Agent monitors and maintains self-hosted GitHub Actions runners across the TAGS ecosystem. It ensures runners remain online, healthy, and efficiently utilized.

## Mission

- Monitor runner status and health across all TAGS repositories
- Perform safe recovery operations for offline or unresponsive runners
- Analyze logs and diagnose failure patterns
- Generate utilization reports and optimization recommendations

## Usage Examples

### Daily Health Check

**Task:** "Perform daily health check on all TAGS runners"

**Expected Behavior:**
1. Query status of spotifydev, tagsdev, and other ecosystem runners
2. Check systemd service status on local infrastructure
3. Report online/offline status, current jobs, and queue depth
4. Identify any runners requiring attention
5. Generate summary report with recommendations

### Runner Recovery

**Task:** "tagsdev runner is offline, diagnose and recover"

**Expected Behavior:**
1. Check systemd service status: `sudo ./svc.sh status`
2. Analyze recent logs for failure patterns
3. Attempt safe recovery (service restart)
4. Verify runner returns to online status
5. Document findings and actions taken

### Utilization Analysis

**Task:** "Analyze runner utilization over the past month"

**Expected Behavior:**
1. Query GitHub API for historical run data
2. Calculate usage statistics by runner and time period
3. Identify peak usage times and potential bottlenecks
4. Generate optimization recommendations
5. Create formatted report for stakeholders

## OPLOG Format

All runner operations include comprehensive OPLOG entries:

```
[OPLOG] Runner Health Check - spotifydev
- Status: online, idle (0 queued jobs)
- Service: active (running) since 2025-11-20 14:30 UTC
- Last Job: CI Pipeline #1234 (completed 2h ago)
- CPU Usage: 15%, Memory: 2.1GB/8GB
- Disk Usage: 45% (/home: 45GB used)
- Network: healthy
- No issues detected
```

## Monitoring Scope

### Runner Types
- **spotifydev**: Primary runner for spotify-dev-toolkit
- **tagsdev**: Runner for DevOnboarder and ecosystem projects
- **Future**: Additional runners as ecosystem grows

### Health Metrics
- **Availability**: Online/offline status
- **Utilization**: Busy/idle state, queue depth
- **Performance**: CPU, memory, disk usage
- **Service Health**: systemd status and logs
- **Job Success**: Historical completion rates

## Recovery Procedures

### Automatic Recovery
- Service restart for offline runners
- Log rotation when disk space low
- Dependency updates for outdated software

### Escalation Triggers
- Configuration file corruption
- Hardware failures
- Network connectivity issues
- Security incidents
- Persistent unavailability

## Integration Points

- **GitHub API**: Runner status, job history, repository access
- **Systemd**: Service management and monitoring
- **File System**: Log analysis and configuration reading
- **CLI Tools**: `gh`, `systemctl`, `journalctl` for operations

## Success Metrics

- **Availability**: >99.9% uptime across all runners
- **MTTR**: <5 minutes for routine issues
- **Proactive Detection**: Issues identified before impacting CI
- **Documentation**: Comprehensive OPLOG for all operations
- **Reporting**: Regular utilization and health reports

## Boundaries

**Allowed:**
- Status monitoring and health checks
- Safe service operations (start/stop/restart)
- Log analysis and pattern recognition
- Utilization reporting and optimization suggestions

**Forbidden:**
- Runner configuration modifications
- Secret or credential access
- Infrastructure changes beyond service management
- Repository content modifications

## Emergency Procedures

If critical runner failures occur:
1. Immediate escalation to human operator
2. Detailed diagnostic information provided
3. Step-by-step recovery instructions
4. Continuous monitoring until resolved
5. Post-mortem analysis and prevention recommendations