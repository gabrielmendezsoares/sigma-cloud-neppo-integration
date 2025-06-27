import momentTimezone from 'moment-timezone';
import { PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { ICloudServiceOrder, INeppoSatisfactionSurvey, IUserAndContact } from './interfaces/index.js';

const prisma = new PrismaClient();

export const createCloudNeppoSatisfactionSurveys = async (): Promise<void> => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();
  const utcCurrent = momentTimezone().utc();
  const utcCurrentDay = utcCurrent.format('DD');
  const utcCurrentMonth = utcCurrent.format('MM');
  const utcCurrentYear = utcCurrent.format('YYYY');
  const utcLastWeek = utcCurrent.clone().subtract(7, 'days');
  const utcLastDay = utcLastWeek.format('DD');
  const utcLastMonth = utcLastWeek.format('MM');
  const utcLastYear = utcLastWeek.format('YYYY');

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.SIGMA_CLOUD_BEARER_TOKEN as string));

  try {
    const neppoSatisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany();
    const serviceOrderList = await httpClientInstance.get<ICloudServiceOrder.ICloudServiceOrder[]>(`https://api.segware.com.br/v1/serviceOrders?fromDate=${ utcLastDay }%2F${ utcLastMonth }%2F${ utcLastYear }&toShowDate=${ utcCurrentDay }%2F${ utcCurrentMonth }%2F${ utcCurrentYear }&dateType=CLOSING`);
    const serviceOrderFilteredList = serviceOrderList.data.filter((serviceOrder: ICloudServiceOrder.ICloudServiceOrder): boolean => !!(serviceOrder.status === 4 && !neppoSatisfactionSurveyList.map((neppoSatisfactionSurvey: INeppoSatisfactionSurvey.INeppoSatisfactionSurvey): string => neppoSatisfactionSurvey.sequential_id).includes(String(serviceOrder.sequentialId))));
    
    await Promise.allSettled(
      serviceOrderFilteredList.map(
        async (serviceOrder: ICloudServiceOrder.ICloudServiceOrder): Promise<any> => {
          const userAndContactList = await httpClientInstance.get<IUserAndContact.IUserAndContact[]>(`https://api.segware.com.br/v1/accounts/${ serviceOrder.accountId }/userAndContacts`);
          const userAndContactFilteredList = userAndContactList.data.filter((userAndContact: IUserAndContact.IUserAndContact): boolean => !!(userAndContact.function?.name.match(/\bPESQUISA\b/g)));

          for (let index = 0; index < userAndContactFilteredList.length; index += 1) {
            const phone01 = userAndContactFilteredList[index].phone01
              ? `55${ userAndContactFilteredList[index].phone01.replace(/\D/g, '').slice(-11) }`
              : undefined;

            if (phone01?.length === 13) {                
              await prisma.neppo_satisfaction_surveys.create(
                {
                  data: {
                    sequential_id: String(serviceOrder.sequentialId),
                    phone: phone01,
                    status: 'pending'
                  }
                }
              );

              break;
            }
          }
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/createCloudNeppoSatisfactionSurveys.service.ts | Location: createCloudNeppoSatisfactionSurveys | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
