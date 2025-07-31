# 🔧 Maintenance Club MVP

A performance management portal for automotive service shops with role-based access, vendor integration, and coaching features.

**Last Updated:** January 30, 2025 | **Version:** 2.0.0 | **Status:** Phase 2 - Enhanced Features

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)

### Running with Docker

1. **Start the services:**
   ```bash
   cd /path/to/projects
   docker-compose up maintenance-club-api maintenance-club-frontend postgres
   ```

2. **Access the application:**
   - **Frontend:** http://localhost:3007
   - **API:** http://localhost:5002
   - **API Health:** http://localhost:5002/health

3. **Demo Login Credentials:**
   - **Admin:** `admin@example.com` / `admin123`
   - **Advisor:** `john@example.com` / `admin123`

## 🏗️ Architecture

### Tech Stack
- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** React + TypeScript + Tailwind CSS
- **Authentication:** JWT-based with role permissions
- **File Processing:** XLSX parsing with vendor mapping

### Project Structure
```
maint_club/
├── api/                    # Node.js Express API
│   ├── server.js          # Main server file
│   ├── routes/            # API route handlers
│   └── services/          # Business logic & utilities
├── frontend/              # React TypeScript app
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route pages
│   │   ├── contexts/      # React contexts
│   │   └── services/      # API client
├── uploads/               # File upload storage
└── README.md
```

## 🎯 MVP Features

### ✅ Core Features Implemented

#### 🔐 **Authentication & Authorization**
- JWT-based login system
- Role-based access control (Admin, Market Manager, Store Manager, Advisor)
- Permission-based UI rendering
- Secure API endpoints

#### 📊 **Excel File Processing**
- **Services Files:** Advisor rollup data parsing
- **Operations Files:** Store-level KPI processing
- **Filename Parsing:** Auto-detect Market/Date from filename format
- **Advisor Extraction:** Unique advisor names for user mapping

#### 🏷️ **Vendor Integration**
- **Product Mapping:** Map service fields to vendor-branded products
- **Vendor Tags:** Associate markets with vendor partnerships
- **Branded Scorecards:** Display vendor product names in advisor performance
- **Service Mapping API:** Dynamic mapping system for generic → branded service names

#### 📈 **Performance Management**
- **Advisor Scorecards:** Individual performance metrics with vendor branding
- **Enhanced Goals System:** Set targets for 40+ services across 6 categories
- **Visual Goal Tracking:** Color-coded indicators and variance calculations
- **Achievement Tracking:** Compare actual vs. target performance with percentages

#### 💬 **In-App Coaching**
- **Message Threads:** Manager-to-Advisor communication
- **Read/Unread Tracking:** Message status management
- **Permission-Based Access:** Role-appropriate coaching visibility

#### 📦 **Data Export**
- **Structured JSON:** Complete performance data export
- **Raw Data Access:** Direct access to parsed spreadsheet data
- **API Endpoints:** External system integration ready

### 🎭 **Role-Based Features**

| Role | Features |
|------|----------|
| **Admin** | • File uploads<br>• Vendor mapping management<br>• User profile editing<br>• Advisor-to-user mapping<br>• Services Management with category editing<br>• Scorecard template editor<br>• Full system access |
| **Market Manager** | • Market-level reporting<br>• Goal setting for all services<br>• Advisor coaching<br>• Visual performance tracking<br>• Scorecard template viewing |
| **Store Manager** | • Store-level performance<br>• Advisor goal setting<br>• Team coaching<br>• Goal variance monitoring |
| **Advisor** | • Personal scorecard with goal indicators<br>• Goal tracking with visual feedback<br>• Coaching messages<br>• Branded service display |

## 🗄️ Database Schema

### Key Tables
- **`service_catalog`** - Master list of all services/KPIs with categories
- **`scorecard_templates`** - Market-specific scorecard configurations
- **`scorecard_template_categories`** - Template category definitions
- **`scorecard_template_fields`** - Fields assigned to each category
- **`vendor_product_mappings`** - Service → Vendor product mapping
- **`advisor_mappings`** - Spreadsheet names → System users
- **`performance_data`** - Parsed Excel data storage (JSONB)
- **`goals`** - Multi-level goal management
- **`coaching_messages`** - In-app communication threads
- **`file_uploads`** - Upload history and status tracking

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Current user info

### Performance Data
- `POST /api/performance/upload/services` - Upload services Excel
- `POST /api/performance/upload/operations` - Upload operations Excel
- `POST /api/performance/parse-advisors` - Extract advisor names

### Scorecards
- `GET /api/scorecard/advisor/:userId` - Get advisor scorecard
- `GET /api/scorecard/comparison` - Compare advisor performance

### User Management
- `GET /api/users` - Get all users (with role/status filters)
- `GET /api/users/:id` - Get single user by ID
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user profile and assignments

### Advisor Management
- `GET /api/advisor-mappings` - Get all advisor mappings
- `POST /api/advisor-mappings` - Create/update advisor mapping
- `DELETE /api/advisor-mappings/:id` - Delete advisor mapping
- `GET /api/advisor-mappings/by-name/:name` - Get mapping by advisor name

### Services Management
- `GET /api/services-management` - Get all services with filters (category, is_calculated, active)
- `GET /api/services-management/categories` - Get service categories with counts
- `GET /api/services-management/available-for-calculation` - Get non-calculated services
- `POST /api/services-management` - Create new service
- `PUT /api/services-management/:id` - Update service
- `DELETE /api/services-management/:id` - Delete service
- `PUT /api/services-management/categories/rename` - Rename category across all services
- `PUT /api/services-management/categories/merge` - Merge categories

### Vendor Management
- `GET /api/vendor-mappings` - Get service mappings (supports vendor_id, market_id filters)
- `POST /api/vendor-mappings` - Create individual service mapping
- `PUT /api/vendor-mappings/:id` - Update service mapping
- `DELETE /api/vendor-mappings/:id` - Delete service mapping
- `GET /api/vendor-mappings/vendor-products/:vendorId` - Get vendor products
- `GET /api/vendor-mappings/services/generic` - Available generic services

### Goals & Coaching
- `GET /api/goals/:type/:entityId` - Get goals
- `POST /api/goals` - Set goals  
- `GET /api/coaching/advisor/:id` - Get coaching messages
- `POST /api/coaching` - Send coaching message

### Data Export
- `GET /api/export/performance-json` - Structured JSON export
- `GET /api/export/raw-data` - Raw performance data

## 📁 File Format Requirements

### 🆕 New Filename Convention (Preferred)
```
Format: "market_id-YYYY-MM-DD-time-type-hash.xlsx"

Services Example: "694-2025-07-24-6am-Services-YlxBy3y5-1753351620.xlsx"
Operations Example: "694-2025-07-24-6am-Operations-abc123-9876543210.xlsx"

Parsing Components:
- market_id: Numeric market identifier (e.g., "694")
- YYYY-MM-DD: Date (e.g., "2025-07-24")
- time: Time period (e.g., "6am", "2pm")
- type: "Services" or "Operations"
- hash: Unique identifier (e.g., "YlxBy3y5-1753351620")
```

### 📁 Legacy Filename Format (Still Supported)
```
Format: "Market Name - System - Type - YYYY-MM-DD.xlsx"

Services Example: "Tire South - Tekmetric - Services - 2025-01-24.xlsx"
Operations Example: "Tire South - Tekmetric - Operations - 2025-01-24.xlsx"
```

### Required Excel Columns

#### Services Files (Advisor Data)
- ID, Market, Store, Employee
- Sales, GP Sales, GP Percent, Invoices
- Premium Oil Change, Fuel Additive, Engine Flush
- Alignments, Brake Service, Filters, etc.

#### Operations Files (Store Data)
- ID, Market, Store
- Sales, Invoices, GP $, GP %
- Labor Hours, Effective Labor Rate
- Tire Units, Parts GP $, Average RO

## 🚢 Deployment

### Docker Services

```yaml
# In your main docker-compose.yml
maintenance-club-api:
  container_name: maintenance-club-api
  image: node:18-alpine
  ports: ["5002:5000"]
  volumes: ["./maint_club/api:/app"]
  environment:
    - POSTGRES_DB=maintenance_club_mvp
  
maintenance-club-frontend:
  container_name: maintenance-club-frontend  
  image: node:18
  ports: ["3007:3000"]
  volumes: ["./maint_club/frontend:/app"]
  environment:
    - REACT_APP_API_URL=http://localhost:5002
```

### Environment Variables

**API (.env):**
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your_jwt_secret_here
POSTGRES_HOST=postgres
POSTGRES_DB=maintenance_club_mvp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=yourpassword
```

**Frontend:**
```env
REACT_APP_API_URL=http://localhost:5002
```

## 🎯 Usage Workflow

### 1. **Admin Setup**
1. Login as admin (`admin@example.com` / `admin123`)
2. Configure vendor product mappings
3. Upload Services/Operations Excel files
4. Map advisor names to system users

### 2. **Manager Operations**
1. Set goals for advisors/stores
2. Review performance reports
3. Send coaching messages
4. Monitor achievement rates

### 3. **Advisor Experience**
1. View personal scorecard
2. Track goal progress
3. Read coaching messages
4. See vendor-branded metrics

## 🔧 Development

### Local Development
```bash
# API
cd maint_club/api
npm install
npm start

# Frontend  
cd maint_club/frontend
npm install
npm start
```

### Adding New Features
1. **Database:** Update schema in `database-scripts/`
2. **API:** Add routes in `api/routes/`
3. **Frontend:** Add components in `frontend/src/`

## 📊 Sample Data

The MVP includes demo data:
- **Markets:** Tire South - Tekmetric, AutoCare Central
- **Stores:** McDonough, Atlanta, Covington
- **Users:** Admin, Managers, Advisors (John Blackerby, T. Allen)
- **Vendor Mappings:** BG Products, NAPA, Valvoline
- **Goals & Coaching:** Sample targets and messages

## 🎯 Recent Updates (January 30, 2025)

### ✅ New Features Added
- **Enhanced Advisor Management:** Edit profiles and map advisors to users directly from scorecards
- **Comprehensive Goal System:** Set goals for 40+ services across 6 categories with visual tracking
- **Advanced Permission System:** Role-based goal setting with detailed error handling
- **Visual Performance Indicators:** Color-coded goal achievement status with variance percentages
- **Services Management Integration:** Dynamic service catalog serves as single source of truth
- **Scorecard Template System:** Market-specific templates with categories from Services Management
- **Calculated Services Support:** Templates support calculated KPIs with formulas and dependencies
- **Service Category Management:** Rename and merge service categories with automatic template updates

### 🔧 Current Status
- **95% Complete** - Production-ready MVP
- Service categories now fully editable and manageable
- Debugging goals API permission issue
- All major features implemented and integrated

## 🎉 What's Next?

### Phase 3 - Analytics & Reporting
- Market-level rollup dashboards
- Trend analysis and forecasting
- Advanced coaching automation
- Mobile responsive design

### Phase 4 - Enterprise Features
- Multi-tenant architecture
- Advanced integrations
- AI-powered insights
- Custom reporting builder

---

**Built for The Maintenance Club** - Performance management that drives results! 🚗💨