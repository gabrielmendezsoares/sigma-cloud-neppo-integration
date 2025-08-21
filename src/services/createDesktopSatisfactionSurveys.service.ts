import momentTimezone from 'moment-timezone';
import { sigma_cloud_neppo_integration_satisfaction_surveys, PrismaClient } from '@prisma/client/storage/client.js';
import { HttpClientUtil, loggerUtil, BasicAndBearerStrategy } from '../../expressium/index.js';
import { normalizePhoneService } from './index.js';
import { IDesktopServiceOrder } from './interfaces/index.js';

const QUERY_GATEWAY_API_V1_GET_AUTHENTICATION_URL = `http://192.168.2.103:3042/api/v1/get/authentication`;
const QUERY_GATEWAY_API_V1_CREATE_QUERY_DATA_URL = `http://192.168.2.103:3042/api/v1/create/query-data`;
const TYPE = 'desktop';
const PHONE_REGEX = /\D/g;

const prisma = new PrismaClient();

export const createDesktopSatisfactionSurveys = async (): Promise<void> => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(
    new BasicAndBearerStrategy.BasicAndBearerStrategy(
      'get',
      QUERY_GATEWAY_API_V1_GET_AUTHENTICATION_URL,
      process.env.QUERY_GATEWAY_USERNAME as string,
      process.env.QUERY_GATEWAY_PASSWORD as string,
      undefined,
      undefined,
      undefined,
      (response: Axios.AxiosXHR<any>): string => response.data.data.token,
      (response: Axios.AxiosXHR<any>): number => response.data.data.expiresIn
    )
  );

  try {    
    const responseA = await httpClientInstance.post<any>(
      QUERY_GATEWAY_API_V1_CREATE_QUERY_DATA_URL, 
      { filterMap: { name: 'sigma_cloud_neppo_integration_get_service_order_list' } }
    );

    if (responseA.status === 200) {
      const sigmaCloudNeppoIntegrationSatisfactionSurveyList = await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.findMany();

      await Promise.allSettled(
        responseA.data.data.sigma_cloud_neppo_integration_get_service_order_list.map(
          async (desktopServiceOrder: IDesktopServiceOrder.IDesktopServiceOrder): Promise<void> => {
            if (sigmaCloudNeppoIntegrationSatisfactionSurveyList.find((sigmaCloudNeppoIntegrationSatisfactionSurvey: sigma_cloud_neppo_integration_satisfaction_surveys): boolean => sigmaCloudNeppoIntegrationSatisfactionSurvey.sequential_id === desktopServiceOrder.sequential_id && sigmaCloudNeppoIntegrationSatisfactionSurvey.type === TYPE)) {
              return;
            }

            const responseB = await httpClientInstance.post<any>(
              QUERY_GATEWAY_API_V1_CREATE_QUERY_DATA_URL, 
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
            );

            if (responseB.status === 200) {
              const userAndContactList = responseB.data.data.sigma_cloud_neppo_integration_get_user_and_contact_list;

              for (let index = 0; index < userAndContactList.length; index += 1) {
                const registeredPhone = userAndContactList[index]?.phone01;

                if (registeredPhone) {
                  const cleanPhone = registeredPhone.replace(PHONE_REGEX, '');
      
                  await prisma.sigma_cloud_neppo_integration_satisfaction_surveys.create(
                    {
                      data: {
                        sequential_id: desktopServiceOrder.sequential_id,
                        defect: desktopServiceOrder.defect,
                        registered_phone: registeredPhone,
                        normalized_phone: cleanPhone && normalizePhoneService.normalizePhone(cleanPhone),
                        status: 'pending',
                        type: TYPE,
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
    loggerUtil.error(error instanceof Error ? error.message : String(error));
  }
};
