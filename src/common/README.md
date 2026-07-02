# Common Utilities

This directory contains reusable common utilities and modules for the Digital Wallet project, inspired by best practices from the ecommerce project.

## Directory Structure

```
common/
├── config/          # Configuration management
├── constants/       # Application constants and enums
├── decorators/      # Custom decorators
├── dtos/           # Data Transfer Objects
├── errors/         # Error handling
├── guards/         # Authentication and authorization guards
├── http/           # HTTP client utilities
├── interceptors/   # Request/response interceptors
├── logger/         # Logging utilities
├── middleware/     # Custom middleware
├── pg-client/      # PostgreSQL client
└── utilities/      # Helper functions
```

## Modules

### Constants (`constants/`)
Common constants and enums used throughout the application:
- `MAX_DATE`, `MIN_DATE`: Date boundaries
- `REQUEST_ID_HEADER_KEY`: Standard header keys
- `Environment`: Environment enum (local, development, staging, production)

### Errors (`errors/`)
Centralized error handling:
- **CustomError**: Base error class with code and title
- **BadRequestError**: 400 Bad Request
- **UnauthorizedError**: 401 Unauthorized
- **ForbiddenError**: 403 Forbidden
- **NotFoundError**: 404 Not Found
- **ConflictError**: 409 Conflict
- **InternalServerError**: 500 Internal Server Error
- **ExceptionHandlerFilter**: Global exception filter for consistent error responses

Usage:
```typescript
throw new NotFoundError('User not found', 'USER_NOT_FOUND');
```

### DTOs (`dtos/`)
Common Data Transfer Objects:
- **PaginationQueryDto**: Query parameters for pagination (page, limit)
- **PaginationMetaDto**: Pagination metadata
- **PaginatedResponseDto<T>**: Generic paginated response
- **createPaginationMeta()**: Helper to create pagination metadata

Usage:
```typescript
@Get()
async findAll(@Query() query: PaginationQueryDto) {
  const meta = createPaginationMeta(query.page, query.limit, total);
  return { data: items, meta };
}
```

### Decorators (`decorators/`)
Custom decorators:
- **@Retry()**: Retry failed operations with configurable attempts and backoff

Usage:
```typescript
@Retry({ maxAttempts: 3, backOff: 1000 })
async fetchData() {
  // This will retry up to 3 times with 1s delay
}
```

### Guards (`guards/`)
Authentication and authorization:
- **JwtAuthGuard**: JWT authentication guard with public route support
- **RolesGuard**: Role-based access control

Usage:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Get('users')
getUsers() {}
```

### HTTP (`http/`)
HTTP client wrapper:
- **HttpModule**: Configures Axios HTTP client
- **HttpService**: Service for making HTTP requests (get, post, put, patch, delete)

Usage:
```typescript
constructor(private httpService: HttpService) {}

async fetchData() {
  const response = await this.httpService.get('https://api.example.com/data');
  return response.data;
}
```

### Interceptors (`interceptors/`)
Request/response interceptors:
- **LoggingInterceptor**: Logs request method, URL, status, and duration
- **TransformInterceptor**: Transforms response to standard format with statusCode and timestamp

Usage:
```typescript
@UseInterceptors(LoggingInterceptor)
@Controller('users')
export class UsersController {}
```

### Middleware (`middleware/`)
Custom middleware:
- **RequestIdMiddleware**: Adds unique request ID to each request

Usage in AppModule:
```typescript
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
```

### Utilities (`utilities/`)

#### Date Utils (`date.utils.ts`)
- `isValidDate(date)`: Check if date is valid
- `formatDate(date)`: Format date to ISO string
- `parseDate(dateString)`: Parse date string
- `addDays(date, days)`: Add days to date
- `diffInDays(date1, date2)`: Calculate difference in days

#### String Utils (`string.utils.ts`)
- `isEmpty(value)`: Check if string is empty
- `capitalize(str)`: Capitalize first letter
- `slugify(str)`: Convert string to URL-friendly slug
- `truncate(str, maxLength)`: Truncate with ellipsis
- `mask(str, visibleChars)`: Mask sensitive data

#### Validation Utils (`validation.utils.ts`)
- `isValidEmail(email)`: Validate email format
- `isValidUUID(uuid)`: Validate UUID format
- `isValidUrl(url)`: Validate URL format
- `isStrongPassword(password)`: Validate password strength

#### Paging Utils (`paging.utils.ts`)
- `calculateOffset(page, limit)`: Calculate SQL offset
- `calculateTotalPages(total, limit)`: Calculate total pages
- `queryAllByPagingID()`: Async generator for cursor-based pagination

## Installation

The common utilities use the following dependencies (already in package.json):
- `@nestjs/common`
- `@nestjs/axios`
- `class-validator`
- `class-transformer`
- `uuid`
- `rxjs`

## Usage Examples

### Global Exception Handler
```typescript
// main.ts
import { ExceptionHandlerFilter } from './common/errors';

app.useGlobalFilters(new ExceptionHandlerFilter());
```

### Pagination
```typescript
import { PaginationQueryDto, createPaginationMeta } from './common/dtos';

@Get()
async findAll(@Query() query: PaginationQueryDto) {
  const { page, limit } = query;
  const offset = calculateOffset(page, limit);
  
  const [items, total] = await this.repository.findAndCount({
    skip: offset,
    take: limit,
  });
  
  const meta = createPaginationMeta(page, limit, total);
  return { data: items, meta };
}
```

### Custom Errors
```typescript
import { NotFoundError, BadRequestError } from './common/errors';

async findOne(id: string) {
  const user = await this.repository.findOne(id);
  if (!user) {
    throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  }
  return user;
}
```

### Validation
```typescript
import { isValidEmail, isStrongPassword } from './common/utilities';

if (!isValidEmail(email)) {
  throw new BadRequestError('Invalid email format');
}

if (!isStrongPassword(password)) {
  throw new BadRequestError('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
}
```

## Contributing

When adding new common utilities:
1. Keep them generic and reusable
2. Add proper TypeScript types
3. Document usage in this README
4. Add unit tests where applicable
5. Export from index.ts for easy imports
