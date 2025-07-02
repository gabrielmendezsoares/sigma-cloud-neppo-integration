import momentTimezone from 'moment-timezone';
import { PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IDesktopServiceOrder, INeppoSatisfactionSurvey } from './interfaces/index.js';

const prisma = new PrismaClient();

export const createDesktopNeppoSatisfactionSurveys = async (): Promise<void> => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.QUERY_GATEWAY_BEARER_TOKEN as string));

  try {    
    const responseA = (
      await httpClientInstance.post<unknown>(
        'http://localhost:3042/api/v1/get/query-data-map', 
        { filterMap: { name: 'sigma_cloud_neppo_integration_get_service_order_list' } }
      )
    ).data.data?.sigma_cloud_neppo_integration_get_service_order_list;

    const desktopServiceOrderList = responseA?.data;
    
    if (responseA?.status && desktopServiceOrderList) {
      const neppoSatisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany();

      await Promise.allSettled(
        desktopServiceOrderList.map(
          async (desktopServiceOrder: IDesktopServiceOrder.IDesktopServiceOrder): Promise<any> => {
            if (neppoSatisfactionSurveyList.find((neppoSatisfactionSurvey: INeppoSatisfactionSurvey.INeppoSatisfactionSurvey): boolean => neppoSatisfactionSurvey.sequential_id === String(desktopServiceOrder.sequential_id) && neppoSatisfactionSurvey.type === 'desktop')) {
              return;
            }

            const responseB = (
              await httpClientInstance.post<unknown>(
                'http://localhost:3042/api/v1/get/query-data-map', 
                { 
                  filterMap: { name: 'sigma_cloud_neppo_integration_get_user_and_contact_list' },
                  sigma_cloud_neppo_integration_get_user_and_contact_list: {
                    variable_map: {
                      accountCode: {
                        dataType: 'VARCHAR(255)',
                        value: desktopServiceOrder.account_code
                      }
                    }
                  }
                }
              )
            ).data.data?.sigma_cloud_neppo_integration_get_user_and_contact_list;

            const userAndContactList = responseB?.data;
  
            if (responseB?.status && userAndContactList) {
              for (let index = 0; index < userAndContactList.length; index += 1) {
                const phone01 = userAndContactList[index].phone01
                  ? `55${ userAndContactList[index].phone01.replace(/\D/g, '').slice(-11) }`
                  : undefined;
      
                if (phone01?.length === 13) {
                  await prisma.neppo_satisfaction_surveys.create(
                    {
                      data: {
                        sequential_id: String(desktopServiceOrder.sequential_id),
                        defect: desktopServiceOrder.defect,
                        phone: phone01,
                        status: 'pending',
                        type: 'desktop',
                        started_at: momentTimezone(desktopServiceOrder.begin_date).utc().toDate()
                      }
                    }
                  );
                  
                  break;
                }
              }
            }
          }
        )
      );
    }
  } catch (error: unknown) {
    console.log(`Error | Timestamp: ${ momentTimezone().utc().format('DD-MM-YYYY HH:mm:ss') } | Path: src/services/createDesktopNeppoSatisfactionSurveys.service.ts | Location: createDesktopNeppoSatisfactionSurveys | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
