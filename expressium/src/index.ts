import { Express } from 'express';
import { IncomingMessage, Server, ServerResponse } from 'http';
import { ApiError, BaseError } from './errors/index.js';
import { appRoute } from './routes/index.js';
import { IRouteMap } from './routes/interfaces/index.js';
import { cryptographyUtil, dateTimeFormatterUtil, HttpClientUtil } from './utils/index.js';
import { ApiKeyStrategy, BasicStrategy, BasicAndBearerStrategy, BearerStrategy, OAuthStrategy } from './utils/strategies/index.js';
import { IAuthenticationStrategy } from './utils/strategies/interfaces/index.js';
import { getAccessLog, getRateLimiter, createServer } from './app.module.js';

/**
 * ## global
 * 
 * Global type declarations for the NodeJS environment.
 * 
 * @description Extends the global NodeJS namespace with additional type definitions
 * for custom properties and utility methods. These declarations ensure type safety
 * and enable IDE autocompletion for custom extensions to built-in JavaScript objects.
 */
declare global {
  /**
   * ## ObjectConstructor
   * 
   * Type definitions for custom type-checking methods added to the Object interface.
   * 
   * @description Extends JavaScript's built-in Object constructor
   * with type guard utility methods that enhance type safety when working
   * with values of unknown type.
   */
  interface ObjectConstructor {
    /**
     * ## isObject
     * 
     * Type guard that checks if a value is a non-null object.
     * 
     * @description Determines if a value is an object using stricter type checking
     * than the typeof operator. Unlike typeof, this method:
     * 
     * - Treats null as non-object
     * - Can optionally exclude arrays based on the includeArrays parameter
     * 
     * @param element - The value to check.
     * @param includeArrays - When true, arrays are considered objects; when false (default), arrays are excluded.
     * 
     * @returns A boolean with type guard functionality.
     */
    isObject(element: unknown, includeArrays?: boolean): element is object;

    /**
     * ## isString
     * 
     * Type guard that checks if a value is a string.
     * 
     * @description Uses Object.prototype.toString for reliable string detection
     * that correctly identifies both string primitives and String objects,
     * providing more consistent results than the typeof operator.
     * 
     * @param element - The value to check.
     * 
     * @returns A boolean with type guard functionality.
     */
    isString(element: unknown): element is string;
  }
}

Object.isObject = (element: unknown, includeArrays = false): element is object => {
  return element !== null && typeof element === 'object' && (includeArrays || !Array.isArray(element));
};

Object.isString = (element: unknown): element is string => {
  return Object.prototype.toString.call(element) === '[object String]';
};

const LOG_INTERVAL = 600_000;
const SHUTDOWN_SIGNAL_LIST = ['SIGTERM', 'SIGINT'] as const;
const PORT = process.env.PORT ?? '3000';

/**
 * ## setupPeriodicLogging
 * 
 * Sets up periodic server status logging.
 *
 * @description Creates a recurring timer that logs server timestamp and port information
 * every LOG_INTERVAL milliseconds (10 minutes). The timer uses unref() to avoid
 * preventing Node.js process termination when it's the only active handle.
 * 
 * @returns Timer reference that can be cleared if needed.
 */
const setupPeriodicLogging = (): NodeJS.Timeout => {
  return setInterval(
    async (): Promise<void> => {
      console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Port: ${ PORT }`);
    }, 
    LOG_INTERVAL
  ).unref();
};

/**
 * ## setupGracefulShutdown
 * 
 * Configures graceful shutdown handlers for the server.
 *
 * @description Registers handlers for SIGTERM and SIGINT signals that:
 * 
 * 1. Log the shutdown trigger signal
 * 2. Call server.close() to stop accepting new connections
 * 3. Allow existing connections to complete
 * 4. Set a 5-second safety timeout for forced termination if graceful shutdown stalls
 * 
 * @param runningServerInstance - The active HTTP/HTTPS server instance.
 */
const setupGracefulShutdown = (runningServerInstance: Server<typeof IncomingMessage, typeof ServerResponse>): void => {
  SHUTDOWN_SIGNAL_LIST.forEach(
    (shutdownSignal: string): void => {
      process.on(
        shutdownSignal, 
        (): void => {
          console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Status: ${ shutdownSignal } received. Shutting down the server`);
          
          runningServerInstance.close(
            (): void => {
              console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Status: Server closed`);
              process.exit(0);
            }
          );
          
          setTimeout(
            (): void => {
              console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Status: Forcing server shutdown after timeout`);
              process.exit(1);
            }, 
            5000
          ).unref();
        }
      );
    }
  );
};

/**
 * ## startServer
 * 
 * Initializes and starts the HTTP/HTTPS server.
 * 
 * @description Starts the application server on the configured port with proper
 * error handling and shutdown management. Key features:
 * 
 * - Binds to port specified by PORT environment variable (defaults to 3000)
 * - Sets up periodic status logging
 * - Configures graceful shutdown handlers
 * - Handles common startup errors, including port conflicts (EADDRINUSE)
 * - Logs errors and terminates process with appropriate exit codes
 * 
 * @async
 * 
 * @param serverInstance - Configured Express application or HTTP/HTTPS server instance.
 * 
 * @returns Promise resolving to the running server instance.
 * 
 * @throws If server fails to start (exits process with code 1).
 */
const startServer = async (serverInstance: Express | Server<typeof IncomingMessage, typeof ServerResponse>): Promise<Server<typeof IncomingMessage, typeof ServerResponse>> => {
  try {
    const RunningServerInstance = serverInstance.listen(
      PORT, 
      async (): Promise<void> => {
        console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Status: Server started`);
        setupPeriodicLogging();
      }
    );
    
    setupGracefulShutdown(RunningServerInstance);
    
    RunningServerInstance.on(
      'error', 
      (error: NodeJS.ErrnoException): void => {
        if (error.code === 'EADDRINUSE') {
          console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Error: Port ${ PORT } is already in use`);
        } else {
          console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Error: ${ error.message }`);
        }

        process.exit(1);
      }
    );

    return RunningServerInstance;
  } catch (error: unknown) {
    console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Error: ${ error instanceof Error ? error.message : String(error) }`);
    process.exit(1);
  }
};

process.on(
  'uncaughtException', 
  (error: unknown): void => {
    console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Error: ${ error instanceof Error ? error.message : String(error) }`);
    process.exit(1);
  }
);

process.on(
  'unhandledRejection', 
  (error: unknown): void => {
    console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Error: ${ error instanceof Error ? error.message : String(error) }`);
    process.exit(1);
  }
);

export default startServer;

/**
 * ## generateRoute
 * 
 * Registers a route with the Express router based on configuration.
 * 
 * @description Creates and registers API routes using a standardized configuration object.
 * This function handles:
 * 
 * - API version validation
 * - Route path construction with version prefixing
 * - Authorization middleware application
 * - Role-based access control
 * - Custom middleware integration
 * - Controller wrapping for service handlers
 * 
 * The function builds routes following the pattern /<version>/<url> and applies
 * middleware in the correct sequence based on configuration.
 * 
 * @param routeMap - Complete route configuration object with the following properties:
 * @param routeMap.method - HTTP method (get, post, put, delete, etc.).
 * @param routeMap.version - API version identifier (e.g., 'v1', 'v2').
 * @param routeMap.url - Endpoint path excluding version prefix.
 * @param routeMap.serviceHandler - Business logic function.
 * @param routeMap.requiresAuthorization - Whether authorization is required (default: true).
 * @param routeMap.roleList - User roles allowed to access this route.
 * @param routeMap.middlewareHandlerList - Additional middleware functions.
 */
export const generateRoute = appRoute.generateRoute;

/**
 * ## router
 * 
 * Primary Express router for the application's API endpoints.
 * 
 * @description This router instance manages all API routes for the application.
 * It serves as the central registration point for endpoints and is exported
 * for mounting in the main Express application.
 * 
 * The router handles versioned API paths and enforces consistent routing patterns
 * across the application.
 */
export const router = appRoute.router;

export { 
  ApiError,
  BaseError,
  IRouteMap, 
  cryptographyUtil, 
  dateTimeFormatterUtil, 
  HttpClientUtil,
  ApiKeyStrategy, 
  BasicStrategy, 
  BasicAndBearerStrategy, 
  BearerStrategy,
  OAuthStrategy,
  IAuthenticationStrategy,
  getAccessLog,
  getRateLimiter,
  createServer
};
