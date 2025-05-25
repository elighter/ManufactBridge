#!/bin/sh

# ManufactBridge Health Check Script

# Check if the main application is running
if ! pgrep -f "node src/index.js" > /dev/null; then
    echo "❌ ManufactBridge process not running"
    exit 1
fi

# Check if monitoring port is responding
if ! curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "❌ Health endpoint not responding"
    exit 1
fi

echo "✅ ManufactBridge is healthy"
exit 0 