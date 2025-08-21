import momentTimezone from 'moment-timezone';
import { sigma_cloud_neppo_integration_satisfaction_surveys, PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, loggerUtil } from '../../expressium/index.js';

const NEPPO_SEND_MESSAGE_URL = 'https://newline.tm2digital.com/chat/api/send/message';

const prisma = new PrismaClient();

export const sendSatisfactionSurveys = async (): Promise<void> => {
  try {
    const sigmaCloudNeppoIntegrationSatisfactionSurveyList = await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.findMany({ where: { status: 'pending' } });

    await Promise.allSettled(
      sigmaCloudNeppoIntegrationSatisfactionSurveyList.map(
        async (sigmaCloudNeppoIntegrationSatisfactionSurvey: sigma_cloud_neppo_integration_satisfaction_surveys): Promise<void> => {
          const httpClientInstance = new HttpClientUtil.HttpClient();
          
          try {
            await httpClientInstance.post<unknown>(
              NEPPO_SEND_MESSAGE_URL,
              {
                "phone": sigmaCloudNeppoIntegrationSatisfactionSurvey.normalized_phone ?? sigmaCloudNeppoIntegrationSatisfactionSurvey.registered_phone,
                "message": "msg",
                "group": "New Line Oficial",
                "channel": "WHATSAPP",
                "additionalInfo": `{\"namespace\":\"7a4b532c_88f3_42dd_826e_fdaa86b8ec63\",\"elementName\":\"pesquisa_visita_tecnica\",\"parameters\":{\"BODY\":[{\"type\":\"text\",\"text\":\"${ sigmaCloudNeppoIntegrationSatisfactionSurvey.sequential_id } – ${ sigmaCloudNeppoIntegrationSatisfactionSurvey.defect.length > 0 ? sigmaCloudNeppoIntegrationSatisfactionSurvey.defect : 'PADRÃO' }, aberta em ${ momentTimezone(sigmaCloudNeppoIntegrationSatisfactionSurvey.started_at).format('DD/MM') } às ${ momentTimezone(sigmaCloudNeppoIntegrationSatisfactionSurvey.started_at).format('HH') }h${ momentTimezone(sigmaCloudNeppoIntegrationSatisfactionSurvey.started_at).format('mm') }\"}]},\"medias\":{},\"openSession\":false}`
              },
              { headers: { Authorization: process.env.NEPPO_TOKEN as string } }
            );
    
            await prisma.neppo_satisfaction_surveys.update(
              { 
                where: { id: sigmaCloudNeppoIntegrationSatisfactionSurvey.id },
                data: { status: 'sent' }
              }
            );
          } catch (error: unknown) {
            loggerUtil.error(error instanceof Error ? error.message : String(error));

            await prisma.neppo_satisfaction_surveys.update(
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
