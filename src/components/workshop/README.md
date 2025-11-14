# Workshop Editor Components

A comprehensive suite of web components for creating and managing workshops in the workshopsAI CMS. These components enable sociologists to create workshops in under 70 minutes through an intuitive drag-and-drop interface with smart templates and automated workflows.

## 🚀 Features

- **Drag-and-drop session planning** with automatic time calculation
- **Template system** with categories and customization options
- **File upload and management** with cloud storage integration
- **Live preview** in participant and facilitator views
- **Multi-language support** (Polish/English) with i18n
- **Auto-save every 30 seconds** with conflict resolution
- **Real-time validation** and publishing checklist
- **WCAG 2.2 AA accessibility** compliance
- **Mobile-first responsive** design
- **Offline support** with service workers

## 📦 Components

### WorkshopEditor
The main editor component that orchestrates all workshop creation functionality.

```html
<workshop-editor
  workshop-id="workshop-123"
  language="pl"
></workshop-editor>
```

**Features:**
- Workshop metadata management (title, description, tags, i18n)
- Session creation and management integration
- Resource upload and organization
- Template selection and customization
- Real-time preview functionality
- Publishing workflow with checklist validation
- Auto-save with conflict resolution

### SessionManager
Handles drag-and-drop session planning with timeline management.

```html
<session-manager
  workshop-id="workshop-123"
  .sessions=${sessions}
  language="pl"
></session-manager>
```

**Features:**
- Drag-and-drop session ordering
- Time allocation and duration management
- Session types (introduction, activity, break, conclusion)
- Automatic time calculation and workshop duration
- Session dependencies and prerequisites
- Session templates and quick-add functionality

### ResourceUpload
Manages file uploads with progress tracking and cloud storage integration.

```html
<resource-upload
  workshop-id="workshop-123"
  .materials=${materials}
  .sessions=${sessions}
  language="pl"
></resource-upload>
```

**Features:**
- Multiple file upload with progress tracking
- File type validation and size limits
- Cloud storage integration (S3/GCS)
- File organization by session or workshop
- Preview and download functionality
- Storage usage monitoring

### WorkshopPreview
Provides live preview of workshop from participant and facilitator perspectives.

```html
<workshop-preview
  .workshopData=${workshopData}
  .sessions=${sessions}
  .options=${previewOptions}
></workshop-preview>
```

**Features:**
- Participant view simulation
- Session flow visualization
- Interactive questionnaire preview
- Mobile-responsive preview
- Print-friendly workshop plan
- Device-specific preview modes

### TemplateSelector
Template system with categories and customization options.

```html
<template-selector
  language="pl"
></template-selector>
```

**Features:**
- Template library with categories
- Template preview and selection
- Customization and personalization
- Save custom templates for reuse
- Template sharing and collaboration
- Search and filtering capabilities

## 🔧 Installation and Setup

### Dependencies

The components use LitElement for the web component framework and include several external dependencies:

```json
{
  "dependencies": {
    "lit": "^2.0.0",
    "@lit/localize": "^0.11.0",
    "dragula": "^3.7.3",
    "@types/dragula": "^3.7.3"
  }
}
```

### Setup

1. Install dependencies:
```bash
npm install
```

2. Import the components in your application:
```javascript
import './src/components/workshop/WorkshopEditor.js';
import './src/components/workshop/SessionManager.js';
import './src/components/workshop/ResourceUpload.js';
import './src/components/workshop/WorkshopPreview.js';
import './src/components/workshop/TemplateSelector.js';
```

3. Use the components in your HTML:
```html
<workshop-editor
  workshop-id="your-workshop-id"
  language="pl"
></workshop-editor>
```

## 🏗️ Architecture

### Component Structure

```
src/components/workshop/
├── WorkshopEditor.ts      # Main editor orchestrator
├── SessionManager.ts       # Session planning with drag-and-drop
├── ResourceUpload.ts       # File upload and management
├── WorkshopPreview.ts      # Live preview functionality
├── TemplateSelector.ts     # Template system
├── WorkshopTypes.ts        # TypeScript interfaces
└── README.md              # This documentation
```

### Data Flow

1. **WorkshopEditor** orchestrates all components and manages global state
2. **SessionManager** handles session creation and ordering
3. **ResourceUpload** manages files and associates them with sessions
4. **WorkshopPreview** generates live previews from current data
5. **TemplateSelector** provides templates for quick workshop creation

### Backend Integration

The components are designed to work with the workshopsAI CMS backend APIs:

- `/api/v1/workshops` - Workshop CRUD operations
- `/api/v1/sessions` - Session management
- `/api/v1/materials` - File upload and management
- `/api/v1/templates` - Template system
- `/api/v1/questionnaires` - Questionnaire integration

## 🌐 Internationalization

The components support bilingual (Polish/English) interfaces:

```typescript
interface BilingualText {
  pl: string;  // Polish
  en: string;  // English
}
```

Language switching is handled automatically and all UI text is translated.

## ♿ Accessibility

All components follow WCAG 2.2 AA guidelines:

- **Keyboard navigation** - All functionality accessible via keyboard
- **Screen reader support** - ARIA labels and semantic HTML
- **High contrast mode** - Support for high contrast displays
- **Reduced motion** - Respect for prefers-reduced-motion
- **Focus management** - Clear focus indicators and logical tab order

## 📱 Responsive Design

Components are mobile-first with breakpoints:

- **Mobile**: < 768px - Stacked layouts and simplified interfaces
- **Tablet**: 768px - 1024px - Adapted layouts for touch interaction
- **Desktop**: > 1024px - Full-featured interfaces with optimal space usage

## 🔌 Event System

Components use custom events for communication:

```javascript
// WorkshopEditor events
'workshop-change'     // Workshop data changed
'sessions-change'     // Sessions updated
'materials-change'    // Materials updated
'template-selected'   // Template chosen
'preview-update'      // Preview options changed

// SessionManager events
'session-add'         // New session added
'session-update'      // Session modified
'session-delete'      // Session removed
'session-reorder'     // Sessions reordered

// ResourceUpload events
'file-upload'         // Files uploaded
'file-delete'         // File removed
'file-progress'       // Upload progress update
```

## 🎨 Styling

Components use CSS custom properties for theming:

```css
:host {
  --primary-color: #3b82f6;
  --primary-hover: #2563eb;
  --secondary-color: #6b7280;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  --border-color: #e5e7eb;
  --background-color: #f9fafb;
  --card-background: #ffffff;
}
```

## 🚀 Performance

- **Lazy loading** - Components load only when needed
- **Virtual scrolling** - For large lists of sessions/materials
- **Debounced saving** - Prevents excessive API calls
- **Progressive enhancement** - Core functionality works without JavaScript
- **Code splitting** - Components are loaded on-demand

## 🔧 Development

### Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start development server: `npm run dev`
4. Open browser to `http://localhost:3000`

### Testing

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run accessibility tests
npm run test:a11y

# Run performance tests
npm run test:perf
```

### Linting

```bash
# Check code style
npm run lint

# Fix code style issues
npm run lint:fix

# Type checking
npm run typecheck
```

## 📚 Examples

See the `examples/` directory for complete usage examples:

- `workshop-editor-demo.html` - Full workshop editor demonstration
- `session-manager-example.html` - Session manager standalone
- `template-selector-demo.html` - Template system showcase

## 🔗 API Reference

### WorkshopEditor

**Properties:**
- `workshopId?: string` - Existing workshop ID for editing
- `workshopData: WorkshopData` - Workshop data object
- `language: Language` - Current language ('pl' | 'en')

**Methods:**
- `saveWorkshop()` - Save workshop to backend
- `publishWorkshop()` - Publish workshop
- `togglePreview()` - Switch to preview mode
- `validateWorkshop()` - Run validation checks

### SessionManager

**Properties:**
- `workshopId?: string` - Workshop ID
- `sessions: WorkshopSession[]` - Array of sessions
- `language: Language` - Current language

**Events:**
- `sessions-change` - Fired when sessions are modified

**Methods:**
- `addSession(type: SessionType)` - Add new session
- `editSession(sessionId: string)` - Edit existing session
- `deleteSession(sessionId: string)` - Remove session

### ResourceUpload

**Properties:**
- `workshopId?: string` - Workshop ID
- `materials: WorkshopMaterial[]` - Array of materials
- `sessions: WorkshopSession[]` - Workshop sessions
- `language: Language` - Current language

**Events:**
- `materials-change` - Fired when materials are modified

**Methods:**
- `uploadFiles(files: File[])` - Upload new files
- `deleteMaterial(materialId: string)` - Remove material
- `assignToSession(materialId: string, sessionId?: string)` - Assign to session

## 🛠️ Troubleshooting

### Common Issues

**Components not loading:**
- Check that all dependencies are installed
- Verify import paths are correct
- Ensure browser supports web components

**Drag and drop not working:**
- Check that Dragula is properly imported
- Verify CSS styling allows for drag operations
- Test in different browsers

**File upload failing:**
- Check backend API endpoints
- Verify file size and type restrictions
- Ensure proper CORS configuration

**Auto-save not working:**
- Check network connectivity
- Verify backend API is accessible
- Check browser console for errors

### Getting Help

- Check the browser console for error messages
- Review the API documentation for backend integration
- Test components individually using the examples
- Check GitHub issues for known problems

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

For support and questions:

- Create an issue in the GitHub repository
- Check the documentation and examples
- Review the API reference
- Test with the provided demo files