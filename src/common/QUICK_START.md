# Quick Start Guide - Common Modules

Quick reference for using the newly added common modules in the Digital Wallet project.

## 🚀 Setup

### 1. Install Dependencies (if not already installed)
```bash
npm install @nestjs/axios rxjs
```

### 2. Enable Global Features (in `main.ts`)
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ExceptionHandlerFilter } from './common/errors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Global exception filter
  app.useGlobalFilters(new ExceptionHandlerFilter());
  
  await app.listen(3000);
}
bootstrap();
```

### 3. Enable Middleware (in `app.module.ts`)
```typescript
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware';

@Module({
  // ... your imports
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

## 📝 Common Use Cases

### Error Handling
```typescript
import { NotFoundError, BadRequestError, UnauthorizedError } from './common/errors';

// In your service
async findUser(id: string) {
  const user = await this.userRepository.findOne(id);
  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }
  return user;
}

// Validation error
if (!email) {
  throw new BadRequestError('Email is required', 'EMAIL_REQUIRED');
}

// Auth error
if (!isAuthorized) {
  throw new UnauthorizedError('Invalid credentials', 'INVALID_CREDENTIALS');
}
```

### Pagination
```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { PaginationQueryDto, createPaginationMeta } from './common/dtos';

@Controller('users')
export class UsersController {
  @Get()
  async findAll(@Query() query: PaginationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const offset = (page - 1) * limit;
    
    const [users, total] = await this.userRepository.findAndCount({
      skip: offset,
      take: limit,
    });
    
    const meta = createPaginationMeta(page, limit, total);
    return { data: users, meta };
  }
}

// Response format:
// {
//   "data": [...],
//   "meta": {
//     "page": 1,
//     "limit": 10,
//     "total": 100,
//     "totalPages": 10,
//     "hasNext": true,
//     "hasPrev": false
//   }
// }
```

### Guards & Authorization
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { Reflector } from '@nestjs/core';

// For roles decorator
export const Roles = Reflector.createDecorator<string[]>();
export const Public = Reflector.createDecorator<boolean>();

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  
  @Get('users')
  @Roles(['admin', 'superadmin'])
  getUsers() {
    // Only admin and superadmin can access
  }
  
  @Get('public')
  @Public()
  publicEndpoint() {
    // No authentication required
  }
}
```

### HTTP Client
```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from './common/http';

@Injectable()
export class ExternalApiService {
  constructor(private readonly httpService: HttpService) {}
  
  async fetchData() {
    const response = await this.httpService.get('https://api.example.com/data');
    return response.data;
  }
  
  async createResource(data: any) {
    const response = await this.httpService.post(
      'https://api.example.com/resource',
      data,
      { headers: { 'Content-Type': 'application/json' } }
    );
    return response.data;
  }
}
```

### Retry Decorator
```typescript
import { Injectable } from '@nestjs/common';
import { Retry } from './common/decorators';

@Injectable()
export class PaymentService {
  
  @Retry({ maxAttempts: 3, backOff: 1000 })
  async processPayment(paymentData: any) {
    // This will retry up to 3 times with 1 second delay
    return await this.paymentGateway.charge(paymentData);
  }
  
  @Retry({ 
    maxAttempts: 5, 
    backOff: 2000,
    doRetry: (error) => error.status >= 500 // Only retry server errors
  })
  async fetchFromUnreliableAPI() {
    return await this.http.get('https://unreliable-api.com/data');
  }
}
```

### Validation Utilities
```typescript
import { 
  isValidEmail, 
  isValidUUID, 
  isStrongPassword,
  isValidUrl 
} from './common/utilities';
import { BadRequestError } from './common/errors';

// Email validation
if (!isValidEmail(email)) {
  throw new BadRequestError('Invalid email format');
}

// UUID validation
if (!isValidUUID(userId)) {
  throw new BadRequestError('Invalid user ID format');
}

// Password validation
if (!isStrongPassword(password)) {
  throw new BadRequestError(
    'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
  );
}

// URL validation
if (!isValidUrl(website)) {
  throw new BadRequestError('Invalid website URL');
}
```

### String Utilities
```typescript
import { 
  isEmpty, 
  capitalize, 
  slugify, 
  mask,
  truncate 
} from './common/utilities';

// Check empty
if (isEmpty(username)) {
  throw new BadRequestError('Username cannot be empty');
}

// Capitalize
const name = capitalize('john doe'); // "John doe"

// Create URL slug
const slug = slugify('Hello World! 2024'); // "hello-world-2024"

// Mask sensitive data
const maskedCard = mask('1234567890123456', 4); // "************3456"

// Truncate long text
const preview = truncate(longDescription, 100); // "Long text..."
```

### Date Utilities
```typescript
import { 
  isValidDate, 
  formatDate, 
  addDays,
  diffInDays 
} from './common/utilities';

// Validate date
if (!isValidDate(new Date(dateString))) {
  throw new BadRequestError('Invalid date');
}

// Format date
const formatted = formatDate(new Date()); // "2024-11-30"

// Add days
const futureDate = addDays(new Date(), 7); // 7 days from now

// Calculate difference
const daysDiff = diffInDays(startDate, endDate);
```

### Interceptors
```typescript
import { Controller, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor, TransformInterceptor } from './common/interceptors';

@Controller('api')
@UseInterceptors(LoggingInterceptor) // Logs all requests
export class ApiController {
  
  @Get('data')
  @UseInterceptors(TransformInterceptor) // Transforms response
  getData() {
    return { message: 'Success' };
    // Response will be: { data: { message: 'Success' }, statusCode: 200, timestamp: '...' }
  }
}
```

## 🎯 Best Practices

1. **Always use custom errors** instead of throwing generic Error objects
2. **Use pagination DTOs** for all list endpoints
3. **Add guards** to protected routes
4. **Use retry decorator** for external API calls
5. **Validate input** using validation utilities before processing
6. **Use string utilities** for consistent data formatting
7. **Add request ID middleware** for request tracing

## 📚 More Information

- See `README.md` for detailed documentation
- See `COMMON_MODULES_ADDED.md` for complete module list
- Check individual files for inline documentation

## 🆘 Common Issues

### Issue: Guards not working
**Solution**: Make sure to provide Reflector in your module:
```typescript
@Module({
  providers: [Reflector, JwtAuthGuard, RolesGuard],
})
```

### Issue: HTTP module not found
**Solution**: Install @nestjs/axios:
```bash
npm install @nestjs/axios rxjs
```

### Issue: Validation not working
**Solution**: Make sure class-validator and class-transformer are installed:
```bash
npm install class-validator class-transformer
```

## 📞 Support

For issues or questions, refer to the main project documentation or create an issue in the project repository.
