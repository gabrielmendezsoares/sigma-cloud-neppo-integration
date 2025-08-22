import momentTimezone from 'moment-timezone';
import { sigma_cloud_neppo_integration_satisfaction_surveys, PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, loggerUtil } from '../../expressium/index.js';

const prisma = new PrismaClient();

export const sendSatisfactionSurveys = async (): Promise<void> => {
  try {
    const sigmaCloudNeppoIntegrationSatisfactionSurveyList = await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.findMany({ where: { status: 'pending' } });

    await Promise.allSettled(
      sigmaCloudNeppoIntegrationSatisfactionSurveyList.map(
        async (sigmaCloudNeppoIntegrationSatisfactionSurvey: sigma_cloud_neppo_integration_satisfaction_surveys): Promise<void> => {
          const httpClientInstance = new HttpClientUtil.HttpClient();
          const sigmaCloudNeppoIntegrationSatisfactionSurveyDefect = sigmaCloudNeppoIntegrationSatisfactionSurvey.defect;
          const sigmaCloudNeppoIntegrationSatisfactionSurveyStartedAt = momentTimezone(sigmaCloudNeppoIntegrationSatisfactionSurvey.started_at);
          
          try {
            await httpClientInstance.post<unknown>(
              'https://newline.tm2digital.com/chat/api/send/message',
              {
                "phone": sigmaCloudNeppoIntegrationSatisfactionSurvey.normalized_phone ?? sigmaCloudNeppoIntegrationSatisfactionSurvey.registered_phone,
                "message": "msg",
                "group": "New Line Oficial",
                "channel": "WHATSAPP",
                "additionalInfo": `{\"namespace\":\"7a4b532c_88f3_42dd_826e_fdaa86b8ec63\",\"elementName\":\"pesquisa_visita_tecnica\",\"parameters\":{\"BODY\":[{\"type\":\"text\",\"text\":\"${ sigmaCloudNeppoIntegrationSatisfactionSurvey.sequential_id } – ${ sigmaCloudNeppoIntegrationSatisfactionSurveyDefect.length > 0 ? sigmaCloudNeppoIntegrationSatisfactionSurveyDefect : 'PADRÃO' }, aberta em ${ sigmaCloudNeppoIntegrationSatisfactionSurveyStartedAt.format('DD/MM') } às ${ sigmaCloudNeppoIntegrationSatisfactionSurveyStartedAt.format('HH') }h${ sigmaCloudNeppoIntegrationSatisfactionSurveyStartedAt.format('mm') }\"}]},\"medias\":{},\"openSession\":false}`
              },
              { headers: { Authorization: process.env.NEPPO_TOKEN as string } }
            );
    
            await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.update(
              { 
                where: { id: sigmaCloudNeppoIntegrationSatisfactionSurvey.id },
                data: { status: 'sent' }
              }
            );
          } catch (error: unknown) {
            loggerUtil.error(error instanceof Error ? error.message : String(error));

            await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.update(
              { 
                where: { id: sigmaCloudNeppoIntegrationSatisfactionSurvey.id },
                data: { status: 'failed' }
              }
            );
          }
        }
      )
    );
  } catch (error: unknown) {
    loggerUtil.error(error instanceof Error ? error.message : String(error));
  };
};
