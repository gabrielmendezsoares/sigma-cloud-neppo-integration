import { PrismaClient } from '@prisma/client/storage/client.js';
import { dateTimeFormatterUtil, HttpClientUtil, BearerStrategy } from '../../expressium/src/index.js';
import { IServiceOrderDesktop, IUserAndContact } from '../interfaces/index.js';

const prisma = new PrismaClient();

export const createDesktopSatisfactionSurvey = async () => { 
  const httpClientInstance = new HttpClientUtil.HttpClient();

  httpClientInstance.setAuthenticationStrategy(new BearerStrategy.BearerStrategy(process.env.QUERY_GATEWAY_BEARER_TOKEN as string));

  try {
    const serviceOrderList = await httpClientInstance.post<IServiceOrderDesktop.IServiceOrderDesktop[]>(
      'localhost:3042/api/v1/get/query-data-map', 
      { filterMap: { name: 'sigma_desktop_service_order_1' } }
    );

    await Promise.allSettled(
      serviceOrderList.data.map(
        async (serviceOrder: IServiceOrderDesktop.IServiceOrderDesktop): Promise<any> => {
          const userAndContactList = await httpClientInstance.post<IUserAndContact.IUserAndContact[]>(
            'localhost:3042/api/v1/get/query-data-map', 
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
          );

          userAndContactList.data.every(
            async (userAndContact: IUserAndContact.IUserAndContact): Promise<boolean> => {
              const phone01 = userAndContact.phone01
                ? parseInt(`55${ userAndContact.phone01.replace(/\D/g, '').slice(-11) }`, 10)
                : undefined;

              if (phone01) {
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

                return false;
              }

              return true;
            }
          );
        }
      )
    );
  } catch (error: unknown) {
    console.log(`Service | Timestamp: ${ dateTimeFormatterUtil.getLocalDate() } | Name: createDesktopSatisfactionSurvey | Error: ${ error instanceof Error ? error.message : String(error) }`);
  }
};
