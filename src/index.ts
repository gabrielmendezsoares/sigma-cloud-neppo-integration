import express, { Express, NextFunction, Request, Response } from 'express';
import morgan from 'morgan';
import schedule from 'node-schedule';
import startServer, { router, dateTimeFormatterUtil, getAccessLog, createServer } from '../expressium/src/index.js';
import { appRoute } from './routes/index.js';
import { createCloudServiceOrderService, createDesktopServiceOrderService, sendNotificationService } from './services/index.js';

const buildServer = async (): Promise<void> => {
  try {
    const app = express();

    if (process.env.NODE_ENV !== 'production') {
      const accessLog = await getAccessLog();

      app.use(morgan('combined', { stream: accessLog.createWriteStream() }));
    }
    
    app.use(express.json());
    app.use('/api', router);

    app.use(
      (
        req: Request, 
        res: Response, 
        _next: NextFunction
      ): void => {
        res
          .status(404)
          .json(
            {
              timestamp: dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()),
              status: false,
              statusCode: 404,
              method: req.method,
              path: req.originalUrl || req.url,
              query: req.query,
              headers: req.headers,
              body: req.body,
              message: 'Route not found.',
              suggestion: 'Please check the URL and HTTP method to ensure they are correct.'
            }
          );
      }
    );

    const serverInstance = await createServer(app);

    appRoute.buildRoutes();
    
    startServer(serverInstance as Express);
  } catch (error: unknown) {
    console.log(`Server | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Error: ${ error instanceof Error ? error.message : String(error) }`);
    process.exit(1);
  }
};

buildServer();
schedule.scheduleJob('*/15 * * * *', createCloudServiceOrderService.createCloudSatisfactionSurvey);
schedule.scheduleJob('*/15 * * * *', createDesktopServiceOrderService.createDesktopSatisfactionSurvey);
schedule.scheduleJob('*/2 9-17 * * 1-5', sendNotificationService.sendNotification);
