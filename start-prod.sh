#!/bin/bash

echo "🚀 Starting DocuSign AI Clone Production Environment..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
if ! command_exists docker; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if .env file exists
if [ ! -f backend/.env ]; then
    echo "⚠️  Warning: backend/.env file not found!"
    echo "Please copy backend/.env.example to backend/.env and configure it."
    echo "Run: cp backend/.env.example backend/.env"
    exit 1
fi

echo "🐳 Starting production environment with Docker Compose..."
docker-compose -f docker-compose.prod.yml up --build

echo "✅ Production environment started!"
echo ""
echo "🌐 Access points:"
echo "   - Application: http://localhost"
echo "   - HTTPS: https://localhost (if SSL configured)"
echo ""
echo "📝 To stop the environment, press Ctrl+C or run:"
echo "   docker-compose -f docker-compose.prod.yml down"
