# PDF Template Import System for workshopsAI CMS

This document describes the comprehensive PDF template import system for implementing the "NASZA (NIE)UTOPIA" Polish questionnaire template and supporting template management functionality.

## Overview

The PDF Template Import System enables questionnaire administrators to:
- Import PDF templates and automatically extract questions
- Use predefined templates like "NASZA (NIE)UTOPIA"
- Manage template versions and rollback functionality
- Preview templates before creating questionnaires
- Export and share templates as JSON

## Features

### 🚀 Core Features
- **PDF Parsing**: Intelligent extraction of questions and sections from PDF files
- **Predefined Templates**: Ready-to-use templates including "NASZA (NIE)UTOPIA" (23 questions, 4 sections)
- **Template Management**: Version control, rollback, and analytics
- **Multi-language Support**: Polish and English language support with UTF-8 encoding
- **Template Preview**: Interactive preview of templates with all question types
- **GDPR Compliance**: Secure file upload with validation and consent management

### 📊 Template Analytics
- Usage tracking and statistics
- Completion rate analysis
- Time-to-completion metrics
- Template performance insights

### 🔧 Technical Features
- **File Validation**: Secure PDF upload with size limits and type checking
- **Auto-detection**: Automatic question and section detection using regex patterns
- **Error Handling**: Comprehensive error handling and validation
- **Scalability**: Efficient database design with proper indexing
- **Security**: Input sanitization, authentication, and authorization

## Architecture

```
src/
├── templates/
│   └── nostra-nieutopia.json          # Predefined template data
├── services/
│   ├── pdfTemplateParser.ts           # PDF parsing engine
│   ├── templateManager.ts             # Template management logic
│   └── questionnaireService.ts        # Questionnaire CRUD operations
├── components/
│   ├── TemplateImport.ts              # Import UI component
│   └── TemplatePreview.ts             # Template preview interface
├── routes/
│   └── templates.ts                   # Template API routes
├── models/
│   └── schema.ts                      # Database schema (extended)
└── examples/
    └── template-usage-example.tsx     # Usage examples
```

## API Endpoints

### Template Management
- `GET /api/v1/templates` - List all available templates
- `GET /api/v1/templates/:templateId` - Get specific template details
- `GET /api/v1/templates/:templateId/export` - Export template as JSON
- `DELETE /api/v1/templates/:templateId` - Delete template (soft delete)

### Import Operations
- `POST /api/v1/templates/import/pdf` - Import template from PDF file
- `POST /api/v1/templates/import/json` - Import template from JSON export
- `POST /api/v1/templates/:templateId/create-questionnaire` - Create questionnaire from template

### Template Operations
- `POST /api/v1/templates/:templateId/version` - Create new template version
- `POST /api/v1/templates/:templateId/rollback/:version` - Rollback to specific version
- `GET /api/v1/templates/:templateId/validate` - Validate template structure
- `GET /api/v1/templates/:templateId/analytics` - Get template usage analytics

### Predefined Templates
- `GET /api/v1/templates/predefined/nasza-nieutopia` - Get NASZA (NIE)UTOPIA template
- `POST /api/v1/templates/predefined/nasza-nieutopia/create` - Create questionnaire from NASZA (NIE)UTOPIA

## Database Schema Extensions

The system extends the existing questionnaire schema with:

1. **Templates Table**: Template metadata and versioning
2. **Template Versions**: Version history tracking
3. **Template Analytics**: Usage statistics and performance metrics
4. **Template Files**: File storage and metadata

## Security Features

### File Upload Security
- **File Type Validation**: Only PDF files allowed
- **Size Limits**: Maximum 10MB file size
- **Virus Scanning**: Integration with security scanners (configurable)
- **Content Sanitization**: Input sanitization using DOMPurify

### Authentication & Authorization
- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Different permissions for different user roles
- **API Rate Limiting**: Prevent abuse and ensure system stability

### GDPR Compliance
- **Consent Management**: User consent for data processing
- **Data Anonymization**: Automatic PII detection and removal
- **Audit Logging**: Complete audit trail of all operations

## Template Structure

### "NASZA (NIE)UTOPIA" Template

The predefined template includes:

1. **Section 1: WIZJA / MANIFEST** (6 questions)
   - Key values and community purpose
   - Vision and goals
   - Needs fulfillment
   - External perception
   - Communication tools
   - Collaboration culture

2. **Section 2: PRZESTRZEŃ I MATERIA** (5 questions)
   - Material relationships
   - Income strategies
   - Management structures
   - Resource management
   - Essential materials and technologies

3. **Section 3: RELACJE, INTERAKCJE I WOLNOŚĆ OSOBISTA** (7 questions)
   - Relationship building practices
   - Communication and conflict resolution
   - External community relations
   - Family and motherhood concepts
   - Emotional handling
   - Body and relationships
   - Leisure time activities

4. **Section 4: ORGANIZOWANIE** (5 questions)
   - Traditions and rituals
   - Safety strategies
   - Educational strategies
   - Development support
   - Future aspirations

## Usage Examples

### 1. Import PDF Template

```typescript
// Using the PDF Template Parser
import { PDFTemplateParser } from './services/pdfTemplateParser';

const parser = new PDFTemplateParser();
const template = await parser.parsePDF(pdfBuffer, {
  language: 'both',
  autoDetectQuestions: true,
});

// Validate template
const validation = parser.validateTemplate(template);
if (!validation.valid) {
  console.error('Template validation failed:', validation.errors);
}
```

### 2. Create Questionnaire from Template

```typescript
// Using the Template Manager
import { templateManager } from './services/templateManager';

const questionnaire = await templateManager.createQuestionnaireFromTemplate(
  'nasza_nieutopia_v1',
  workshopId,
  { pl: 'Nasz kwestionariusz', en: 'Our questionnaire' },
  creatorId
);
```

### 3. Template Import Component

```typescript
// Using the Template Import Component
import { TemplateImport } from './components/TemplateImport';

<TemplateImport
  onImportSuccess={(templateId, questionnaireId) => {
    console.log('Template imported:', templateId);
    console.log('Questionnaire created:', questionnaireId);
  }}
  onImportError={(error) => {
    console.error('Import failed:', error);
  }}
/>
```

### 4. Template Preview

```typescript
// Using the Template Preview Component
import { TemplatePreview } from './components/TemplatePreview';

<TemplatePreview
  templateId="nasza_nieutopia_v1"
  language="pl"
  showMetadata={true}
  readonly={true}
/>
```

## Configuration

### Environment Variables

```bash
# File upload settings
MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_FILE_TYPES=pdf

# Template storage
TEMPLATES_DIR=./src/templates
TEMPLATE_ARCHIVE_DIR=./src/templates/archive

# Security settings
JWT_SECRET=your-secret-key
ENABLE_VIRUS_SCAN=false
RATE_LIMIT_REQUESTS=100
```

### Template Parser Configuration

```typescript
const parserOptions = {
  language: 'both',           // 'pl', 'en', or 'both'
  autoDetectQuestions: true,  // Enable auto-detection
  maxFileSize: 10485760,      // 10MB
  questionPatterns: [...],    // Custom regex patterns
  sectionPatterns: [...],     // Custom section patterns
};
```

## Performance Optimization

### Database Optimization
- **Indexing**: Proper indexing on template_id, created_by, and status fields
- **Query Optimization**: Efficient queries with proper joins
- **Caching**: Redis caching for frequently accessed templates

### File Processing
- **Streaming**: Stream processing for large PDF files
- **Background Processing**: Async processing for template parsing
- **Compression**: Template data compression for storage

### Frontend Optimization
- **Lazy Loading**: Lazy loading of template content
- **Virtual Scrolling**: For large questionnaires
- **Memoization**: React memoization for component optimization

## Testing

### Unit Tests
- Template parser logic
- Template validation
- API endpoint testing
- Component testing

### Integration Tests
- End-to-end template import flow
- File upload testing
- Database integration testing
- Authentication testing

### Performance Tests
- Load testing with concurrent template imports
- Memory usage optimization
- Database performance testing

## Monitoring and Analytics

### System Metrics
- Template import success/failure rates
- Processing time tracking
- File upload statistics
- API response times

### Business Metrics
- Template usage statistics
- Popular templates tracking
- User engagement metrics
- Conversion rates (template → questionnaire)

## Troubleshooting

### Common Issues

1. **PDF Parsing Errors**
   - Check PDF file format and encoding
   - Verify file size limits
   - Review parser configuration

2. **Template Validation Failures**
   - Check template structure requirements
   - Verify required fields are present
   - Review validation rules

3. **Permission Issues**
   - Verify user roles and permissions
   - Check JWT token validity
   - Review authentication configuration

### Debug Tools

- Template validation endpoint
- Analytics dashboard
- Error logging and monitoring
- Performance profiling tools

## Future Enhancements

### Planned Features
- **AI-Assisted Template Generation**: GPT-powered template suggestions
- **Bulk Import**: Multiple template import functionality
- **Template Marketplace**: Share and discover templates
- **Advanced Analytics**: AI-powered insights and recommendations
- **Integration APIs**: Third-party system integrations

### Technical Improvements
- **Microservices Architecture**: Separate services for template management
- **GraphQL API**: More efficient data fetching
- **Real-time Collaboration**: Multi-user template editing
- **Mobile App**: Native mobile application support

## Support and Documentation

### Documentation
- API documentation (OpenAPI/Swagger)
- User guides and tutorials
- Developer documentation
- Best practices guide

### Support Channels
- GitHub Issues for bug reports
- Community forum for discussions
- Email support for enterprise customers
- Knowledge base and FAQs

---

## Frontend Implementation Summary

### Components Created
- **TemplateImport**: Complete UI for PDF/JSON import with tabs for predefined templates, PDF upload, and JSON import
- **TemplatePreview**: Interactive template preview with section expansion, language switching, and all question types

### Services Implemented
- **PDFTemplateParser**: Advanced PDF parsing with auto-detection, validation, and Polish language support
- **TemplateManager**: Complete template management with versioning, analytics, and export functionality

### API Routes
- Full REST API for template CRUD operations
- Import endpoints for PDF and JSON
- Analytics and export endpoints
- Predefined template endpoints

### Security Features
- JWT authentication and role-based authorization
- File upload validation and sanitization
- GDPR compliance with consent management
- Rate limiting and error handling

## Compliance Checklist

✅ **GDPR Compliance**: User consent management and data protection
✅ **Accessibility**: WCAG 2.2 AA compliant components
✅ **Security**: Input validation, sanitization, and authentication
✅ **Performance**: Optimized queries and caching
✅ **Scalability**: Modular architecture and efficient design
✅ **Documentation**: Comprehensive API documentation and examples

The PDF Template Import System is production-ready and follows all best practices for security, performance, and user experience.