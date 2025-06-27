import momentTimezone from 'moment-timezone';
import { PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IDesktopServiceOrder, INeppoSatisfactionSurvey } from './interfaces/index.js';

const prisma = new PrismaClient();

export const createDesktopNeppoSatisfactionSurveys = async (): Promise<void> => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.QUERY_GATEWAY_BEARER_TOKEN as string));

  try {
    const neppoSatisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany();
    
    const responseA = (
      await httpClientInstance.post<unknown>(
        'http://localhost:3042/api/v1/get/query-data-map', 
        { filterMap: { name: 'sigma_cloud_neppo_integration_get_service_order_list' } }
      )
    ).data.data?.sigma_cloud_neppo_integration_get_service_order_list;

    const serviceOrderList = responseA?.data;
    
    if (responseA?.status && serviceOrderList) {
      const serviceOrderFilteredList = serviceOrderList.filter((serviceOrder: IDesktopServiceOrder.IDesktopServiceOrder): boolean => !neppoSatisfactionSurveyList.map((neppoSatisfactionSurvey: INeppoSatisfactionSurvey.INeppoSatisfactionSurvey): string => neppoSatisfactionSurvey.sequential_id).includes(String(serviceOrder.sequential_id)));  
    
      await Promise.allSettled(
        serviceOrderFilteredList.map(
          async (serviceOrder: IDesktopServiceOrder.IDesktopServiceOrder): Promise<any> => {
            const responseB = (
              await httpClientInstance.post<unknown>(
                'http://localhost:3042/api/v1/get/query-data-map', 
                { 
                  filterMap: { name: 'sigma_cloud_neppo_integration_get_user_and_contact_list' },
                  sigma_cloud_neppo_integration_get_user_and_contact_list: {
                    variable_map: {
                      accountCode: {
                        dataType: 'VARCHAR(255)',
                        value: serviceOrder.account_code
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
                        sequential_id: String(serviceOrder.sequential_id),
                        phone: phone01,
                        status: 'pending'
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
