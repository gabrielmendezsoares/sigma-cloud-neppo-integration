import momentTimezone from 'moment-timezone';
import { PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil } from '../../expressium/src/index.js';
import { INeppoSatisfactionSurvey } from './interfaces/index.js';

const prisma = new PrismaClient();

export const sendNeppoSatisfactionSurveys = async (): Promise<void> => {
  try {
    const neppoSatisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany({ where: { status: 'pending' } });

    await Promise.allSettled(
      neppoSatisfactionSurveyList.map(
        async (neppoSatisfactionSurvey: INeppoSatisfactionSurvey.INeppoSatisfactionSurvey): Promise<void> => {
          const httpClientInstance = new HttpClientUtil.HttpClient();
          
          try {
            await httpClientInstance.post<unknown>(
              'https://newline.tm2digital.com/chat/api/send/message',
              {
                "phone": neppoSatisfactionSurvey.phone,
                "message": "msg",
                "group": "New Line Oficial",
                "channel": "WHATSAPP",
                "additionalInfo": `{\"namespace\":\"7a4b532c_88f3_42dd_826e_fdaa86b8ec63\",\"elementName\":\"pesquisa_visita_tecnica\",\"parameters\":{\"BODY\":[{\"type\":\"text\",\"text\":\"${ neppoSatisfactionSurvey.sequential_id }\"}]},\"medias\":{},\"openSession\":false}`
              },
              {
                headers: {
                  Authorization: process.env.NEPPO_TOKEN as string,
                  Cookie: process.env.NEPPO_COOKIE as string
                }
              }
            );
    
            await prisma.neppo_satisfaction_surveys.update(
              { 
                where: { id: neppoSatisfactionSurvey.id },
                data: { status: 'sent' }
              }
            );
          } catch (error: unknown) {
            console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/sendNeppoSatisfactionSurveys.service.ts | Location: sendNeppoSatisfactionSurveys | Error: ${ neppoSatisfactionSurvey.phone } - ${ error instanceof Error ? error.message : String(error) }`);

            await prisma.neppo_satisfaction_surveys.update(
              { 
                where: { id: neppoSatisfactionSurvey.id },
                data: { status: 'failed' }
              }
            );
          }
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/sendNeppoSatisfactionSurveys.service.ts | Location: sendNeppoSatisfactionSurveys | Error: ${ error instanceof Error ? error.message : String(error) }`);
  };
};
