# ManufactBridge Documentation Standards

## Language Policy

**All documentation in the ManufactBridge project must be written in English.**

This policy ensures:
- Global accessibility for international developers and organizations
- Consistency across all project materials
- Better integration with English-based technical ecosystems
- Enhanced collaboration opportunities

## Documentation Types

### 1. Technical Documentation
- **RFC Documents**: Complete technical specifications in RFC format
- **API Documentation**: All endpoints, parameters, and responses in English
- **Architecture Documents**: System design and component descriptions
- **Configuration Guides**: Setup and deployment instructions

### 2. User Documentation
- **README Files**: Project overviews and getting started guides
- **User Guides**: Step-by-step operational procedures
- **Installation Guides**: System requirements and setup procedures
- **Troubleshooting Guides**: Common issues and solutions

### 3. Developer Documentation
- **Code Comments**: All inline comments in English
- **Function Documentation**: JSDoc comments in English
- **Development Guides**: Contribution guidelines and best practices
- **Test Documentation**: Test plans, strategies, and reports

## Writing Standards

### Language Guidelines
- Use clear, concise English
- Avoid jargon and colloquialisms
- Use technical terms consistently throughout documentation
- Prefer active voice over passive voice
- Use present tense for describing current functionality

### Technical Terms
- Keep standard technical terms in English (MQTT, REST API, JSON, etc.)
- Use consistent terminology across all documents
- Define acronyms on first use
- Maintain a glossary for domain-specific terms

### Code Documentation
```javascript
/**
 * Connects to the OPC UA server and establishes a secure session
 * @param {string} endpoint - The OPC UA server endpoint URL
 * @param {Object} options - Connection configuration options
 * @returns {Promise<boolean>} Returns true if connection successful
 */
async function connectToServer(endpoint, options) {
    // Initialize connection parameters
    // ...
}
```

### Formatting Standards
- Use proper markdown formatting
- Include table of contents for longer documents
- Use consistent heading levels
- Include code examples where appropriate
- Add diagrams and visual aids when helpful

## File Organization

### Documentation Structure
```
docs/
├── README.md                 # Documentation overview
├── api/                     # API documentation
├── user-guides/            # End-user documentation
├── developer-guides/       # Developer documentation
└── architecture/           # Technical architecture docs

RFC/
├── README.md               # RFC index
├── RFC-001-*.md           # Individual RFC documents
└── templates/             # RFC templates
```

### Naming Conventions
- Use kebab-case for file names: `installation-guide.md`
- Use descriptive names: `opcua-adapter-configuration.md`
- Include version numbers where applicable: `api-v1-reference.md`

## Content Guidelines

### Document Structure
1. **Title**: Clear, descriptive title
2. **Overview**: Brief summary of the document content
3. **Table of Contents**: For documents longer than 500 words
4. **Main Content**: Organized in logical sections
5. **Examples**: Code examples and use cases
6. **References**: Links to related documentation

### Code Examples
- All code examples must be functional
- Include complete examples, not just snippets
- Provide context for code usage
- Use consistent code formatting
- Include expected outputs where applicable

### Error Messages and Logging
```javascript
// Good: Clear, descriptive English error messages
throw new Error('Failed to connect to InfluxDB: Connection timeout after 30 seconds');

// Good: Informative logging in English
logger.info('Successfully established MQTT connection to broker at localhost:1883');
```

## Translation Guidelines

### When Translating Existing Content
1. Preserve technical accuracy
2. Maintain document structure and formatting
3. Keep code examples functional
4. Update cross-references and links
5. Verify all technical terms are correctly translated

### Prohibited Translations
- Technical acronyms (MQTT, HTTP, JSON, SQL, etc.)
- Programming language keywords
- Standard protocol names
- Industry-standard terminology
- Company/product names
- URLs and technical identifiers

## Quality Assurance

### Review Process
1. **Technical Review**: Verify technical accuracy
2. **Language Review**: Check grammar and clarity
3. **Consistency Review**: Ensure terminology consistency
4. **Format Review**: Verify formatting and structure

### Checklist for New Documentation
- [ ] Written in clear, professional English
- [ ] Follows project naming conventions
- [ ] Includes appropriate code examples
- [ ] Uses consistent technical terminology
- [ ] Properly formatted with markdown
- [ ] Includes table of contents (if needed)
- [ ] Cross-references are accurate
- [ ] No broken links

## Tools and Resources

### Recommended Tools
- **Grammar Checking**: Grammarly, Hemingway Editor
- **Markdown Editing**: VSCode with markdown preview
- **Spell Checking**: Enable spell check in your editor
- **Link Checking**: Use markdown link checkers

### Style Guides
- Follow general technical writing best practices
- Use sentence case for headings
- Be consistent with bullet point formatting
- Use numbered lists for sequential steps

## Enforcement

### New Content
- All new documentation must be written in English
- Pull requests with non-English documentation will be rejected
- Code comments must be in English

### Existing Content
- Existing Turkish content is being systematically translated
- Priority given to user-facing documentation
- Code comments updated during regular maintenance

## Contact

For questions about documentation standards:
- Create an issue in the project repository
- Tag documentation-related issues with `documentation` label
- Refer to this document for guidance

---

**Last Updated**: January 7, 2025  
**Version**: 1.0  
**Status**: Active