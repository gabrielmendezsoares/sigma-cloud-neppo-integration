import momentTimezone from 'moment-timezone';
import { sigma_cloud_neppo_integration_satisfaction_surveys, PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, loggerUtil, BearerStrategy } from '../../expressium/index.js';
import { normalizePhoneService } from './index.js';
import { IActivity, ICloudServiceOrder, ICloudServiceOrderFromId, ICloudServiceOrderList, IUserAndContact } from './interfaces/index.js';

const SERVICE_ORDER_PAGE_SIZE = '10000';
const TYPE = 'cloud';
const STATUS = 4;
const DEFECT_IGNORE_LIST = ['ARROMBAMENTO', 'CANCELAMENTO'];
const DEFECT_SOLUTION = 'PRESENCIAL';
const FUNCTION_REGEX = /\bPESQUISA\b/g;
const PHONE_REGEX = /\D/g;

const prisma = new PrismaClient();

export const createCloudSatisfactionSurveys = async (): Promise<void> => { 
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
    const sigmaCloudNeppoIntegrationSatisfactionSurveyList = await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.findMany();

    let page = 0;
    let last = false;

    do {
      const cloudServiceOrderList = (await httpClientInstance.get<ICloudServiceOrderList.ICloudServiceOrderList>(`https://api.segware.com.br/v2/serviceOrders?fromDate=${ utcLastDay }%2F${ utcLastMonth }%2F${ utcLastYear }&toShowDate=${ utcCurrentDay }%2F${ utcCurrentMonth }%2F${ utcCurrentYear }&dateType=CLOSING&page=${ page }&size=${ SERVICE_ORDER_PAGE_SIZE }`)).data;
   
      loggerUtil.info(`Cloud — Fetched page ${ page } with ${ cloudServiceOrderList?.content.length ?? 0 } service orders.`);

      await Promise.allSettled(
        cloudServiceOrderList?.content.map(
          async (cloudServiceOrder: ICloudServiceOrder.ICloudServiceOrder): Promise<void> => {
            if (sigmaCloudNeppoIntegrationSatisfactionSurveyList.find((sigmaCloudNeppoIntegrationSatisfactionSurvey: sigma_cloud_neppo_integration_satisfaction_surveys): boolean => sigmaCloudNeppoIntegrationSatisfactionSurvey.sequential_id === cloudServiceOrder.sequentialId && sigmaCloudNeppoIntegrationSatisfactionSurvey.type === TYPE)) {
              loggerUtil.info(`Cloud — Satisfaction survey already exists for service order ${ cloudServiceOrder.sequentialId }. Skipping.`);
              
              return;
            }
            
            if (cloudServiceOrder.status !== STATUS) {
              loggerUtil.info(`Cloud — Skipping service order ${ cloudServiceOrder.sequentialId } due to status !== ${ STATUS }.`);

              return;
            }
    
            if (DEFECT_IGNORE_LIST.includes(cloudServiceOrder.defect)) {
              loggerUtil.info(`Cloud — Skipping service order ${ cloudServiceOrder.sequentialId } due to ignored defect.`);

              return;
            }

            const cloudServiceOrderFromId = (await httpClientInstance.get<ICloudServiceOrderFromId.ICloudServiceOrderFromId>(`https://api.segware.com.br/v1/serviceOrders/${ cloudServiceOrder.id }`)).data;
    
            if (!cloudServiceOrderFromId?.activities.find((activity: IActivity.IActivity): boolean => activity.defectSolution.includes(DEFECT_SOLUTION))) {
              loggerUtil.info(`Cloud — Skipping service order ${ cloudServiceOrder.sequentialId } — no '${ DEFECT_SOLUTION }' activity.`);

              return;
            }

            const userAndContactList = (await httpClientInstance.get<IUserAndContact.IUserAndContact[]>(`https://api.segware.com.br/v1/accounts/${ cloudServiceOrder.accountId }/userAndContacts`)).data;
            const userAndContactFilteredList = userAndContactList.filter((userAndContact: IUserAndContact.IUserAndContact): boolean => !!(userAndContact.function?.name.match(FUNCTION_REGEX)));
  
            for (let userAndContact of userAndContactFilteredList) {
              const registeredPhone = userAndContact.phone01;
              
              if (registeredPhone) {
                const cleanPhone = registeredPhone.replace(PHONE_REGEX, '');
    
                await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.create(
                  {
                    data: {
                      sequential_id: cloudServiceOrder.sequentialId,
                      defect: cloudServiceOrder.defect,
                      registered_phone: registeredPhone,
                      normalized_phone: cleanPhone && normalizePhoneService.normalizePhone(cleanPhone),
                      status: 'pending',
                      type: TYPE,
                      started_at: momentTimezone(cloudServiceOrder.beginDate).utc().toDate()
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
      } else {
        page += 1;
      }
    } while (!last);
  } catch (error: unknown) {
    loggerUtil.error(error instanceof Error ? error.message : String(error));
  }
};
