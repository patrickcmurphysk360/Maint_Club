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

## Recently Restored/Integrated Features
- Market Management with rich profile view
- Service Management with calculated KPIs (single source of truth)
- Vendor tag system with color coding
- Store Management with user assignments and role-based access
- **User Management with sophisticated market/store assignment interface** ([Full Documentation](USER-MANAGEMENT-RESTORATION.md))
- Store and user relationship management
- **Scorecard Template System integrated with Services Management** (January 30, 2025)
  - Dynamic categories from service catalog
  - Support for calculated services
  - Visual indicators for field metadata
- **Service Category Management System** (January 30, 2025)
  - Rename categories across all services
  - Merge categories to consolidate services
  - Automatic updates reflect in scorecard templates
  - Visual service counts per category
- **Unified Services Data Management System** (January 30, 2025)
  - Comprehensive MTD advisor performance data upload and processing
  - Enhanced advisor mapping with auto-recognition and persistence
  - Database schema viewer and data verification tools
  - Real-time monitoring and troubleshooting capabilities
  - Complete data linkage verification (Market → Store → Advisor)

## Documentation & Restoration Records
- **[PROJECT-STATUS.md](PROJECT-STATUS.md)** - Current project status and features (98% complete as of July 31, 2025)
- **[USER-MANAGEMENT-RESTORATION.md](USER-MANAGEMENT-RESTORATION.md)** - Complete restoration of sophisticated user edit functionality
- **[README.md](README.md)** - Main project documentation with API endpoints and setup instructions
- **[UPLOAD-SYSTEM-FIX.md](UPLOAD-SYSTEM-FIX.md)** - Database column mismatch fix and upload system verification (July 31, 2025)
- **[SCORECARD-SYSTEM-FIX.md](SCORECARD-SYSTEM-FIX.md)** - Complete fix for scorecard data display and vendor mapping (July 31, 2025)

## Common Issues
- Database connection errors: Ensure postgres container is running
- Missing services in dropdowns: Check service catalog seed data
- Lost functionality: Check for overwritten components in archived/
- **Upload failures**: Check `advisor_mappings` table uses `spreadsheet_name` column (NOT `advisor_name`)
- **Before implementing new features**: Always check archived/ directories first
- **When overwriting components**: Document what's being replaced and why

## Testing Commands
- `npm run lint` - Code linting (if available)
- `npm run typecheck` - TypeScript checking (if available) 
- Check package.json scripts for project-specific commands