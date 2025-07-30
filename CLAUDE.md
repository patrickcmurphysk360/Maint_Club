# Claude Code - Project Documentation

## Project Structure
```
C:\Users\patri\projects\
├── maint_club/                    # Main project directory
│   ├── api/                       # Backend API (Node.js/Express)
│   ├── frontend/                  # React frontend
│   ├── database-scripts/          # SQL migration scripts
│   └── uploads/                   # File uploads
├── docker-compose.yml             # Main Docker services (PARENT DIRECTORY)
└── docker-compose-consolidated.yml # Alternative compose file
```

## Development Setup

### Prerequisites
- Docker and Docker Compose
- Node.js (for local development)

### Starting the Application
1. **Database**: `cd .. && docker-compose up -d postgres`
2. **API**: `cd api && npm run dev` (after database is running)
3. **Frontend**: `cd frontend && npm start`

### Key Services
- **PostgreSQL**: Docker service named 'postgres'
- **API**: Port 5000, expects database at 'postgres:5432'
- **Frontend**: Port 3000 (React dev server)

## Important Files
- `../docker-compose.yml` - Main infrastructure setup
- `api/server.js` - API entry point, hardcoded DB config
- `database-scripts/` - Migration files for schema updates
- `frontend/src/services/api.ts` - API client configuration

## Architecture Notes
- JWT authentication with role-based access
- PostgreSQL with JSONB fields for complex data
- React with TypeScript and Tailwind CSS
- RESTful API with Express.js

## Recently Restored Features
- Market Management with rich profile view
- Service Management with calculated KPIs
- Vendor tag system with color coding
- Store Management with user assignments and role-based access
- **User Management with sophisticated market/store assignment interface** ([Full Documentation](USER-MANAGEMENT-RESTORATION.md))
- Store and user relationship management

## Documentation & Restoration Records
- **[USER-MANAGEMENT-RESTORATION.md](USER-MANAGEMENT-RESTORATION.md)** - Complete restoration of sophisticated user edit functionality
- **[SERVICE-MANAGEMENT-CREATION.md]** - Service management with calculated KPIs (if exists)
- **[MARKET-MANAGEMENT-RESTORATION.md]** - Market profile functionality restoration (if exists)

## Common Issues
- Database connection errors: Ensure postgres container is running
- Missing services in dropdowns: Check service catalog seed data
- Lost functionality: Check for overwritten components in archived/
- **Before implementing new features**: Always check archived/ directories first
- **When overwriting components**: Document what's being replaced and why

## Testing Commands
- `npm run lint` - Code linting (if available)
- `npm run typecheck` - TypeScript checking (if available) 
- Check package.json scripts for project-specific commands