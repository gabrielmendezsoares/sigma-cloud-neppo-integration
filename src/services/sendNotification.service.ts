import { PrismaClient } from '@prisma/client/storage/client.js';
import { dateTimeFormatterUtil, HttpClientUtil } from '../../expressium/src/index.js';

const prisma = new PrismaClient();

export const sendNotification = async (): Promise<void> => {
  try {
    const satisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany({ where: { status: 'pending' } });

    await Promise.allSettled(
      satisfactionSurveyList.map(
        async (satisfactionSurvey: any): Promise<void> => {
          const httpClientInstance = new HttpClientUtil.HttpClient();
          
          try {
            await httpClientInstance.post(
              'https://newline.tm2digital.com/chat/api/send/message',
              {
                "phone": satisfactionSurvey.phone,
                "message": "msg",
                "group": "New Line Oficial",
                "channel": "WHATSAPP",
                "additionalInfo": `{\"namespace\":\"7a4b532c_88f3_42dd_826e_fdaa86b8ec63\",\"elementName\":\"pesquisa_visita_tecnica\",\"parameters\":{\"BODY\":[{\"type\":\"text\",\"text\":\"${ satisfactionSurvey.service_order_number }\"}]},\"medias\":{},\"openSession\":false}`
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
                where: { id: satisfactionSurvey.id },
                data: { status: 'sent' }
              }
            );
          } catch (error: unknown) {
            console.log(`Service | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Name: sendNotification | Error: ${ satisfactionSurvey.phone } - ${ error instanceof Error ? error.message : String(error) }`);

            await prisma.neppo_satisfaction_surveys.update(
              { 
                where: { id: satisfactionSurvey.id },
                data: { status: 'failed' }
              }
            );
          }
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Service | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Name: sendNotification | Error: ${ error instanceof Error ? error.message : String(error) }`);
  };
};
