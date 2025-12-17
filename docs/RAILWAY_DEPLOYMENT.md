# Railway Deployment Guide for WorkshopsAI CMS

This guide provides step-by-step instructions for deploying the WorkshopsAI CMS to Railway.app.

## 📋 Prerequisites

1. **GitHub Repository**: Ensure your code is pushed to GitHub
2. **Railway Account**: Create an account at [railway.app](https://railway.app)
3. **Node.js**: Your project should already be built and tested

## 🚀 Quick Deployment Steps

### 1. Connect Repository to Railway

1. Log in to your Railway dashboard
2. Click **New Project**
3. Select **GitHub**
4. Choose the `workshopsAI_cms` repository
5. Click **Deploy**

### 2. Configure Environment Variables

In your Railway project settings, add these environment variables:

#### Required Variables
```bash
NODE_ENV=production
JWT_SECRET=<generate-32-char-random-string>
```

Generate JWT secret:
```bash
openssl rand -hex 32
```

#### Optional Variables (for features)
```bash
# OpenAI API (for Workshop Intelligence)
OPENAI_API_KEY=your-openai-api-key

# Anthropic API (for Claude models)
ANTHROPIC_API_KEY=your-anthropic-api-key

# Google AI (for Gemini models)
GOOGLE_AI_API_KEY=your-google-ai-api-key

# CORS origin
CORS_ORIGIN=https://your-app-name.railailway.app
```

### 3. Add PostgreSQL Plugin

1. In your Railway project dashboard
2. Click **+ New Service**
3. Select **PostgreSQL**
4. Railway will automatically provide `DATABASE_URL`

### 4. Deploy!

Railway will automatically:
- Build the application using `npm run build`
- Start the application using `npm start`
- Run health checks on `/health`
- Connect to the PostgreSQL database

## 📊 Deployment Status

Your app will be available at: `https://your-app-name.railway.app`

### Health Check

Monitor your deployment at: `https://your-app-name.railway.app/health`

## 🔧 Configuration Details

### Port Configuration
- Railway automatically sets the `PORT` environment variable
- The app is configured to use `process.env.PORT || 3010`
- Railway.toml specifies port 3010

### Build Process
- **Builder**: nixpacks
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Health Check**: `/health`

### Database
- **Type**: PostgreSQL (Railway managed)
- **Migration**: Automatic on first deploy
- **Connection**: Uses `DATABASE_URL` environment variable

## 📁 Railway Configuration Files

### `railway.toml`
```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"
startCommand = "npm start"

[[services]]
name = "web"
port = 3010
healthcheckPath = "/health"

[services.env]
NODE_ENV = "production"
```

### `Dockerfile`
Multi-stage Dockerfile optimized for production:
- **Stage 1**: Build dependencies and compile TypeScript
- **Stage 2**: Production dependencies only
- **Stage 3**: Final runtime image with minimal footprint

## 🐛 Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Check logs in Railway dashboard
# Look for TypeScript compilation errors
# Ensure all dependencies are in package.json
```

#### 2. Database Connection Issues
```bash
# Verify DATABASE_URL is set correctly
# Check PostgreSQL plugin is added
# Run migrations: npm run db:migrate
```

#### 3. Health Check Failing
```bash
# Ensure the health endpoint is accessible
# Check if the server is listening on PORT
# Verify health check path matches railway.toml config
```

#### 4. Environment Variables Not Loading
```bash
# Double-check variable names in Railway dashboard
# Ensure no typos in variable keys
# Restart the service after changing variables
```

## 📝 Development vs Production

### Environment Variables
| Variable | Development | Production |
|----------|-------------|------------|
| NODE_ENV | development | production |
| PORT | 3001 | Railway-provided |
| DATABASE_URL | localhost | Railway-provided |
| CORS_ORIGIN | http://localhost:5173 | https://your-app.railway.app |

### Features
- ✅ PostgreSQL for all data storage
- ✅ PostgreSQL for session storage (no Redis needed)
- ✅ File storage (AWS S3/Google Cloud)
- ✅ Email (SendGrid)
- ✅ LLM Integration (OpenAI/Anthropic/Google)
- ✅ PDF generation
- ✅ WebSocket support

## 📊 Performance Optimizations

### Production Optimizations
- Multi-stage Docker build for smaller image size
- PostgreSQL connection pooling
- Static file serving optimized
- Compression middleware enabled
- Rate limiting configured
- Security headers (helmet)

### Monitoring
- Health check endpoint at `/health`
- Structured logging with Winston
- Performance metrics ready
- Error tracking ready

## 🔐 Security Features

- **Authentication**: JWT-based auth
- **Authorization**: Role-based access control
- **Input Validation**: Express-validator
- **XSS Protection**: DOMPurify
- **CSRF Protection**: Built-in middleware
- **Rate Limiting**: Configurable limits
- **SQL Injection**: Drizzle ORM protection
- **GDPR Compliance**: Data anonymization tools

## 📚 Additional Resources

### Railway Documentation
- [Railway Docs](https://docs.railway.app/)
- [Environment Variables](https://docs.railway.app/deploy/variables)
- [Build Configuration](https://docs.railway.app/deploy/build-config)

### Project Documentation
- [API Documentation](./API.md)
- [Database Schema](./docs/DATABASE.md)
- [Security Guide](./docs/SECURITY.md)

## 🎉 Deployment Checklist

Before deploying, ensure:

- [ ] All tests pass locally
- [ ] TypeScript compilation succeeds
- [ ] Environment variables documented
- [ ] Database migrations ready
- [ ] Health endpoint functional
- [ ] Static assets built correctly
- [ ] Security audit passed

After deployment:

- [ ] Health check passes
- [ ] Database connected
- [ ] All features working
- [ ] Monitoring active
- [ ] SSL certificate valid
- [ ] CORS configured for production

## 🔄 Post-Deployment Tasks

### Database Migration
If you have schema changes:
```bash
# Connect to Railway console
railway shell

# Run migrations
npm run db:migrate
```

### Monitoring
- Monitor app metrics in Railway dashboard
- Check health endpoint regularly
- Set up alerts for downtime
- Review application logs

## 🎯 Best Practices

1. **Use Environment Variables** for all configuration
2. **Keep Secrets** out of the repository
3. **Test Locally** before deploying
4. **Monitor Health** continuously
5. **Update Dependencies** regularly
6. **Backup Database** regularly
7. **Use Railway's Features** like managed PostgreSQL

## 🚀 Success!

Your WorkshopsAI CMS is now deployed and running on Railway! 🎉

For support, check:
- Railway documentation
- Application logs
- Health endpoint status