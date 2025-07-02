import momentTimezone from 'moment-timezone';
import { PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IActivity, ICloudServiceOrder, ICloudServiceOrderFromId, INeppoSatisfactionSurvey, IUserAndContact } from './interfaces/index.js';

const DEFECT_IGNORE_LIST = ['ARROMBAMENTO', 'CANCELAMENTO'];

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

    let page = 0;
    let last = false;

    do {
      const cloudServiceOrderList = (await httpClientInstance.get<{ content: ICloudServiceOrder.ICloudServiceOrder[] }>(`https://api.segware.com.br/v2/serviceOrders?fromDate=${ utcLastDay }%2F${ utcLastMonth }%2F${ utcLastYear }&toShowDate=${ utcCurrentDay }%2F${ utcCurrentMonth }%2F${ utcCurrentYear }&dateType=CLOSING&page=${ page }&size=1000`)).data;
   
      await Promise.allSettled(
        cloudServiceOrderList.content.map(
          async (cloudServiceOrder: ICloudServiceOrder.ICloudServiceOrder): Promise<void> => {
            if (neppoSatisfactionSurveyList.find((neppoSatisfactionSurvey: INeppoSatisfactionSurvey.INeppoSatisfactionSurvey): boolean => neppoSatisfactionSurvey.sequential_id === String(cloudServiceOrder.sequentialId) && neppoSatisfactionSurvey.type === 'cloud')) {
              return;
            }
            
            if (cloudServiceOrder.status !== 4) {
              return;
            }
    
            if (DEFECT_IGNORE_LIST.includes(cloudServiceOrder.defect)) {
              return;
            }

            const cloudServiceOrderFromId = (await httpClientInstance.get<ICloudServiceOrderFromId.ICloudServiceOrderFromId>(`https://api.segware.com.br/v1/serviceOrders/${ cloudServiceOrder.id }`)).data;
    
            if (!cloudServiceOrderFromId?.activities.find((activity: IActivity.IActivity): boolean => activity.defectSolution.includes('PRESENCIAL'))) {
              return;
            }

            const userAndContactList = (await httpClientInstance.get<IUserAndContact.IUserAndContact[]>(`https://api.segware.com.br/v1/accounts/${ cloudServiceOrder.accountId }/userAndContacts`)).data;
            const userAndContactFilteredList = userAndContactList.filter((userAndContact: IUserAndContact.IUserAndContact): boolean => !!(userAndContact.function?.name.match(/\bPESQUISA\b/g)));
  
            for (let index = 0; index < userAndContactFilteredList.length; index += 1) {
              const phone01 = userAndContactFilteredList[index].phone01
                ? `55${ userAndContactFilteredList[index].phone01.replace(/\D/g, '').slice(-11) }`
                : undefined;
  
              if (phone01?.length === 13) {                
                await prisma.neppo_satisfaction_surveys.create(
                  {
                    data: {
                      sequential_id: String(cloudServiceOrder.sequentialId),
                      defect: cloudServiceOrder.defect,
                      phone: phone01,
                      status: 'pending',
                      type: 'cloud',
                      started_at: momentTimezone(cloudServiceOrder.beginDate).utc().toDate(),
                    }
                  }
                );
  
                break;
              }
            }
          }
        )
      );

      if (cloudServiceOrderList.last) {
        last = true;
      }
    } while (!last);
  } catch (error: unknown) {
    console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/createCloudNeppoSatisfactionSurveys.service.ts | Location: createCloudNeppoSatisfactionSurveys | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
