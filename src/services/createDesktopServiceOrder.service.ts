import { PrismaClient } from '@prisma/client/storage/client.js';
import { dateTimeFormatterUtil, HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { ISatisfactionSurvey, IServiceOrderDesktop } from './interfaces/index.js';

const prisma = new PrismaClient();

export const createDesktopSatisfactionSurvey = async (): Promise<void> => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.QUERY_GATEWAY_BEARER_TOKEN as string));

  try {
    const satisfactionSurveyList = await prisma.neppo_satisfaction_surveys.findMany();
    
    const serviceOrderList = (
      await httpClientInstance.post<any>(
        'http://localhost:3042/api/v1/get/query-data-map', 
        { filterMap: { name: 'sigma_desktop_service_order_1' } }
      )
    ).data.data.sigma_desktop_service_order_1.data;
    
    const serviceOrderFilteredList = serviceOrderList.filter((serviceOrder: IServiceOrderDesktop.IServiceOrderDesktop): boolean => !satisfactionSurveyList.map((satisfactionSurvey: ISatisfactionSurvey.ISatisfactionSurvey): string => satisfactionSurvey.service_order_number).includes(serviceOrder.service_order_number));  
    
    await Promise.allSettled(
      serviceOrderFilteredList.map(
        async (serviceOrder: IServiceOrderDesktop.IServiceOrderDesktop): Promise<any> => {
          const userAndContactList = (
            await httpClientInstance.post<any>(
              'http://localhost:3042/api/v1/get/query-data-map', 
              { 
                filterMap: { name: 'sigma_desktop_service_order_2' },
                sigma_desktop_service_order_2: {
                  parameter_map: {
                    csid: {
                      dataType: 'VARCHAR(255)',
                      value: serviceOrder.csid
                    }
                  }
                }
              }
            )
          ).data.data.sigma_desktop_service_order_2.data;

          for (let index = 0; index < userAndContactList.length; index += 1) {
            const phone01 = userAndContactList[index].phone01
              ? `55${ userAndContactList[index].phone01.replace(/\D/g, '').slice(-11) }`
              : undefined;

            if (phone01 && phone01.length === 13) {
              await prisma.neppo_satisfaction_surveys.create(
                {
                  data: {
                    service_order_number: serviceOrder.service_order_number,
                    csid: serviceOrder.csid,
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
    console.log(`Service | Timestamp: ${ dateTimeFormatterUtil.formatAsDayMonthYearHoursMinutesSeconds(dateTimeFormatterUtil.getLocalDate()) } | Name: createDesktopSatisfactionSurvey | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
