# Contributing to workshopsAI CMS

Thank you for your interest in contributing to workshopsAI CMS! This guide will help you get started with contributing to this project.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Git

### Setup Development Environment

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/workshopsAI-cms.git
   cd workshopsAI-cms
   ```

3. **Set up upstream remote**:
   ```bash
   git remote add upstream https://github.com/workshopsAI/workshopsAI-cms.git
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your local configuration
   ```

6. **Set up the database**:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

7. **Start development server**:
   ```bash
   npm run dev
   ```

## 🏗️ Development Workflow

### Branch Naming

- **Features**: `feature/description-of-feature`
- **Bug fixes**: `fix/description-of-fix`
- **Documentation**: `docs/description-of-docs`
- **Refactoring**: `refactor/description-of-refactor`

### Making Changes

1. **Create a new branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test your changes**:
   ```bash
   npm run test
   npm run lint
   npm run typecheck
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

## 📝 Coding Standards

### TypeScript

- Use **strict TypeScript** configuration
- Provide **type annotations** for all functions
- Use **interfaces** over types when possible
- Prefer **const** over **let** when possible

### Code Style

- Follow **ESLint** configuration
- Use **Prettier** for code formatting
- Write **descriptive variable and function names**
- Add **JSDoc comments** for complex functions

### File Organization

```
src/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── middleware/      # Express middleware
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
├── types/          # TypeScript definitions
└── utils/          # Helper functions
```

## 🧪 Testing

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Writing Tests

- **Unit tests** for pure functions and services
- **Integration tests** for API endpoints
- **Test files** should be named `*.test.ts`
- Aim for **80%+ test coverage**
- Use **descriptive test names**

### Test Structure

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = service.methodName(input);

      // Assert
      expect(result).toEqual(expected);
    });
  });
});
```

## 🎯 Accessibility Standards

Our project is **WCAG 2.2 AA** compliant. When contributing:

- **Use semantic HTML** elements
- **Add ARIA labels** for interactive elements
- **Ensure keyboard navigation** works
- **Test with screen readers**
- **Maintain color contrast** ratios
- **Include alt text** for images

## 🔒 Security Guidelines

- **Never commit secrets** or API keys
- **Validate all inputs** using Zod schemas
- **Sanitize user-generated content**
- **Use parameterized queries** (Drizzle ORM handles this)
- **Implement rate limiting** for public endpoints
- **Follow OWASP security practices**

## 📚 Documentation

- **Update README.md** for user-facing changes
- **Add API documentation** for new endpoints
- **Include code examples** in documentation
- **Update CHANGELOG.md** for significant changes

## 🐛 Bug Reports

When reporting bugs:

1. **Check existing issues** first
2. **Use the bug report template**
3. **Include reproduction steps**
4. **Provide environment details**
5. **Add screenshots** if applicable

## 💡 Feature Requests

For feature requests:

1. **Check roadmap** for planned features
2. **Use the feature request template**
3. **Describe the use case** clearly
4. **Consider the impact** on existing users

## 🤝 Pull Request Process

### Before Submitting

- [ ] **All tests pass**
- [ ] **Code follows style guidelines**
- [ ] **Typescript compiles without errors**
- [ ] **Accessibility is maintained**
- [ ] **Documentation is updated**
- [ ] **Commits follow conventional format**

### Pull Request Template

```markdown
## Description
Brief description of the change

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Accessibility tested
```

## 🏷️ Commit Message Format

We use **conventional commits**:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```bash
feat(auth): add refresh token rotation
fix(api): resolve workshop enrollment validation
docs(readme): update installation instructions
test(workshops): add integration tests for CRUD operations
```

## 🚀 Release Process

Releases are handled by maintainers:

1. **Version bump** follows semantic versioning
2. **CHANGELOG.md** is updated
3. **GitHub release** is created
4. **npm package** is published (if applicable)

## 🤝 Community Guidelines

- **Be respectful** and inclusive
- **Welcome newcomers** and help them get started
- **Focus on what is best for the community**
- **Show empathy** towards other community members

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For general questions
- **Documentation**: Check existing docs first
- **Maintainers**: Tag maintainers for urgent issues

## 🎉 Recognition

Contributors are recognized in:
- **README.md** contributor list
- **Release notes** for significant contributions
- **Annual community highlights**

Thank you for contributing to workshopsAI CMS! 🙏