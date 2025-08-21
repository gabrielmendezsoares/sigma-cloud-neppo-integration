import cors from 'cors';
import express, { Express, Request, Response } from 'express';
import { createRequire } from 'module';
import schedule from 'node-schedule';
import { expressiumRoute, loggerUtil, startServer, createServer } from '../expressium/index.js';
import { appRoute } from './routes/index.js';
import { createCloudSatisfactionSurveysService, createDesktopSatisfactionSurveysService, sendSatisfactionSurveysService } from './services/index.js';

const require = createRequire(import.meta.url);

const helmet = require('helmet');

const buildServer = async (): Promise<void> => {
  try {
    const app = express();

    app.use(cors());
    app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
    app.use(express.json());
    appRoute.buildRoutes();
    app.use('/api', expressiumRoute.router);

    app.use(
      (
        _req: Request, 
        res: Response
      ): void => {
        res
          .status(404)
          .json(
            {
              message: 'Route not found.',
              suggestion: 'Please check the URL and HTTP method to ensure they are correct.'
            }
          );
      }
    );

    const serverInstance = await createServer(app);
    
    await startServer(serverInstance as Express);
    await createCloudSatisfactionSurveysService.createCloudSatisfactionSurveys();
    await createDesktopSatisfactionSurveysService.createDesktopSatisfactionSurveys();
    await sendSatisfactionSurveysService.sendSatisfactionSurveys();

    schedule.scheduleJob('0 */1 * * * *', createCloudSatisfactionSurveysService.createCloudSatisfactionSurveys);
    schedule.scheduleJob('0 */1 * * * *', createDesktopSatisfactionSurveysService.createDesktopSatisfactionSurveys);
    schedule.scheduleJob('0 */1 9-17 * * 1-5', sendSatisfactionSurveysService.sendSatisfactionSurveys);
  } catch (error: unknown) {
    loggerUtil.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

buildServer();
