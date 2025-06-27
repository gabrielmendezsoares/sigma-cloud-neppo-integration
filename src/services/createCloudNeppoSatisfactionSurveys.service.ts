import momentTimezone from 'moment-timezone';
import { PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IActivity, ICloudServiceOrder, ICloudServiceOrderFromId, INeppoSatisfactionSurvey, IUserAndContact } from './interfaces/index.js';

const prisma = new PrismaClient();

const DEFECT_IGNORE_LIST = ['CANCELAMENTO', 'ARROMBAMENTO'];
const DEFECT_SOLUTION_ID = 15326;

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
    const cloudServiceOrderList = await httpClientInstance.get<ICloudServiceOrder.ICloudServiceOrder[]>(`https://api.segware.com.br/v1/serviceOrders?fromDate=${ utcLastDay }%2F${ utcLastMonth }%2F${ utcLastYear }&toShowDate=${ utcCurrentDay }%2F${ utcCurrentMonth }%2F${ utcCurrentYear }&dateType=CLOSING`);
    const neppoSatisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany();
    const sequentialIdList = neppoSatisfactionSurveyList.map((neppoSatisfactionSurvey: INeppoSatisfactionSurvey.INeppoSatisfactionSurvey): string => neppoSatisfactionSurvey.sequential_id);

    const cloudServiceOrderFilteredList = cloudServiceOrderList.data.filter(
      async (cloudServiceOrder: ICloudServiceOrder.ICloudServiceOrder): Promise<boolean> => {
       const cloudServiceOrderFromId = await httpClientInstance.get<ICloudServiceOrderFromId.ICloudServiceOrderFromId>(`https://api.segware.com.br/v1/serviceOrders/${ cloudServiceOrder.sequentialId }`);

        return !!(
          !sequentialIdList.includes(String(cloudServiceOrder.sequentialId)) 
          && cloudServiceOrder.status === 4 
          && !DEFECT_IGNORE_LIST.includes(cloudServiceOrder.defect) 
          && cloudServiceOrderFromId.data.activities.find((activity: IActivity.IActivity): boolean => activity.defectSolutionId === DEFECT_SOLUTION_ID)
        );
      }
    );
    
    await Promise.allSettled(
      cloudServiceOrderFilteredList.map(
        async (cloudServiceOrderFiltered: ICloudServiceOrder.ICloudServiceOrder): Promise<any> => {
          const userAndContactList = await httpClientInstance.get<IUserAndContact.IUserAndContact[]>(`https://api.segware.com.br/v1/accounts/${ cloudServiceOrderFiltered.accountId }/userAndContacts`);
          const userAndContactFilteredList = userAndContactList.data.filter((userAndContact: IUserAndContact.IUserAndContact): boolean => !!(userAndContact.function?.name.match(/\bPESQUISA\b/g)));

          for (let index = 0; index < userAndContactFilteredList.length; index += 1) {
            const phone01 = userAndContactFilteredList[index].phone01
              ? `55${ userAndContactFilteredList[index].phone01.replace(/\D/g, '').slice(-11) }`
              : undefined;

            if (phone01?.length === 13) {                
              await prisma.neppo_satisfaction_surveys.create(
                {
                  data: {
                    sequential_id: String(cloudServiceOrderFiltered.sequentialId),
                    defect: cloudServiceOrderFiltered.defect,
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
