#!/bin/bash

echo "🚀 Setting up DocuSign AI Clone..."

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required but not installed. Aborting." >&2; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Prerequisites check passed"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --legacy-peer-deps
echo "🔧 Generating Prisma client..."
npx prisma generate
cd ..

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install --legacy-peer-deps
cd ..

# Create environment file if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating environment file..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your actual configuration values:"
    echo "   - OPENROUTER_API_KEY (get from https://openrouter.ai/)"
    echo "   - AWS credentials for S3 storage"
    echo "   - SMTP credentials for email notifications"
    echo "   - JWT_SECRET (generate a secure random string)"
fi

# Create logs directory
mkdir -p backend/logs

# Create uploads directory for local development
mkdir -p backend/uploads

echo "✅ Setup complete!"
echo ""
echo "🔧 Configuration needed:"
echo "1. Edit backend/.env with your configuration:"
echo "   - OPENROUTER_API_KEY=your-openrouter-api-key"
echo "   - AWS_ACCESS_KEY_ID=your-aws-key"
echo "   - AWS_SECRET_ACCESS_KEY=your-aws-secret"
echo "   - S3_BUCKET=your-bucket-name"
echo "   - SMTP_HOST=smtp.gmail.com"
echo "   - SMTP_USER=your-email@gmail.com"
echo "   - SMTP_PASS=your-app-password"
echo "   - JWT_SECRET=your-secure-random-string"
echo ""
echo "🚀 To start development:"
echo "   npm run docker:dev"
echo ""
echo "🌐 Access points:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:3001"
echo "   - API Docs: http://localhost:3001/api-docs"
echo ""
echo "📚 Features implemented:"
echo "   ✅ Document upload and management"
echo "   ✅ PDF viewer with field placement"
echo "   ✅ Signature capture (draw/type/upload)"
echo "   ✅ Document signing workflow"
echo "   ✅ Email notifications"
echo "   ✅ AI document analysis"
echo "   ✅ Real-time updates"
echo "   ✅ Audit trails"
echo "   ✅ Role-based access control"
