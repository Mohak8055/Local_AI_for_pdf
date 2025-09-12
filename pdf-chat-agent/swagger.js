import swaggerUi from 'swagger-ui-express';

// THIS IS THE ENTIRE API SPECIFICATION AS A JAVASCRIPT OBJECT. NO PARSING.
const swaggerSpecification = {
  openapi: '3.0.0',
  info: {
    title: 'Local RAG API with Authentication',
    version: '1.0.0',
    description: 'API for a local PDF chat agent with user management and SQLite database.',
  },
  servers: [
    { url: 'http://localhost:3001' }
  ],
  // Schemas define the shape of data for requests and responses
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      }
    },
    schemas: {
      UserCredentials: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'testuser' },
          password: { type: 'string', example: 'password123' }
        }
      },
      AuthToken: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Login successful!' },
          token: { type: 'string', example: 'eyJhbGciOiJI...' }
        }
      },
      PDFFile: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          fileName: { type: 'string', example: 'annual_report.pdf' }
        }
      },
      Question: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string', example: 'What were the main conclusions?' }
        }
      },
      Answer: {
        type: 'object',
        properties: {
          answer: { type: 'string' }
        }
      },
      ApiError: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  },
  // Paths define the actual API endpoints
  paths: {
    '/auth/register': {
      post: {
        summary: 'Register a new user',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserCredentials' }
            }
          }
        },
        responses: {
          '201': { description: 'User created successfully.' },
          '409': { description: 'Username already exists.' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Log in a user to get a JWT token',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UserCredentials' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Successful login. Returns a JWT token.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthToken' } } }
          },
          '401': { description: 'Invalid credentials.' }
        }
      }
    },
    '/api/pdfs': {
      get: {
        summary: "Get a list of the current user's uploaded PDFs",
        tags: ['RAG API'],
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: "An array of the user's PDF files.",
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/PDFFile' } } } }
          },
          '401': { description: 'Unauthorized.' }
        }
      }
    },
    '/api/upload': {
      post: {
        summary: 'Upload and process a new PDF file',
        tags: ['RAG API'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  pdf: { type: 'string', format: 'binary', description: 'The PDF file to upload.' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'PDF processed and stored successfully.' },
          '401': { description: 'Unauthorized.' }
        }
      }
    },
    '/api/ask': {
      post: {
        summary: 'Ask a question based on all uploaded documents',
        tags: ['RAG API'],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Question' }
            }
          }
        },
        responses: {
          '200': {
            description: 'The generated answer from the AI model.',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Answer' } } }
          },
          '401': { description: 'Unauthorized.' }
        }
      }
    }
  }
};

// This function now just serves the object directly.
const setupSwagger = (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecification));
};

export default setupSwagger;